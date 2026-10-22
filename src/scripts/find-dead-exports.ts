// Find dead exports by tracing every named import through the TypeScript
// compiler's symbol resolution (which transparently follows `export *` chains).
//
// "Used" = imported by name anywhere, OR transitively reachable from a public
// entry via any re-export.
//
// Catches dead code that knip and ts-unused-exports miss due to deep barrel
// re-export chains.

import type { ExportedDeclarations, SourceFile, Symbol as TsSymbol } from 'ts-morph';

import path from 'node:path';
import { Node, Project, SyntaxKind } from 'ts-morph';

export type PublicEntry = {
    // Path relative to root.
    readonly path : string,
    // `true`: everything reachable through this entry is used. `false`: the
    // entry re-exports types only, so only type-kind declarations count.
    readonly valueExports : boolean,
};

export type DeadExport = {
    readonly file : string,
    readonly name : string,
    readonly line : number,
};

export type FindDeadExportsOptions = {
    readonly root : string,
    // Files whose exports are the package's public surface.
    readonly entries ?: ReadonlyArray<PublicEntry>,
    // Path fragments whose definitions are never reported.
    readonly excludePaths ?: ReadonlyArray<string>,
    // Only files under these directories (relative to root) are candidates.
    readonly sourceDirs ?: ReadonlyArray<string>,
    // Strip the `export` keyword from dead declarations in place.
    readonly fix ?: boolean,
    readonly log ?: (line : string) => void,
};

export type FindDeadExportsResult = {
    readonly dead : ReadonlyArray<DeadExport>,
    readonly removed : number,
    readonly skipped : ReadonlyArray<DeadExport & { readonly reason : string }>,
};

const DEFAULT_EXCLUDED_PATHS = [ '/dist/', '/test/', '/scripts/', '/coverage/', '/node_modules/', '/.claude/' ];

export const findDeadExports = ({
    root,
    entries = [ { path: 'src/index.ts', valueExports: true } ],
    excludePaths = [],
    sourceDirs = [ 'src' ],
    fix = false,
    log = () => undefined
} : FindDeadExportsOptions) : FindDeadExportsResult => {
    const FIX_MODE = fix;
    const PROJECT_ROOT = path.resolve(root);
    const EXCLUDED_DEFINITION_PATHS = [ ...DEFAULT_EXCLUDED_PATHS, ...excludePaths ];

    const PUBLIC_ENTRIES : ReadonlyArray<{ path : string, valueExports : boolean }> = entries.map(entry => ({
        path:         path.join(PROJECT_ROOT, entry.path),
        valueExports: entry.valueExports
    }));

    const SOURCE_DIR_PREFIXES = sourceDirs.map(dir => `${ path.join(PROJECT_ROOT, dir) }${ path.sep }`);

    const isTypeOnlyDeclaration = (decl : ExportedDeclarations) : boolean => {
        const kind = decl.getKind();

        return (
            kind === SyntaxKind.InterfaceDeclaration ||
            kind === SyntaxKind.TypeAliasDeclaration
        );
    };

    const isExcludedDefinition = (filePath : string) : boolean => {
        return EXCLUDED_DEFINITION_PATHS.some(p => filePath.includes(p));
    };

    const getPublicEntry = (filePath : string) : { valueExports : boolean } | undefined => {
        return PUBLIC_ENTRIES.find(entry => path.normalize(filePath) === path.normalize(entry.path));
    };

    const isPublicEntry = (filePath : string) : boolean => {
        return getPublicEntry(filePath) !== undefined;
    };

    const getDeclarationName = (decl : ExportedDeclarations) : string | undefined => {
        return Node.hasName(decl)
            ? decl.getName()
            : undefined;
    };

    const project = new Project({
        tsConfigFilePath:            path.join(PROJECT_ROOT, 'tsconfig.json'),
        skipAddingFilesFromTsConfig: false
    });

    const sourceFiles = project.getSourceFiles();

    // 1. Catalogue every exported definition in src/ (excluding public-entry files).
    const definitions = new Map<string, { file : string, name : string, decl : ExportedDeclarations }>();

    for (const file of sourceFiles) {
        const filePath = file.getFilePath();

        if (isExcludedDefinition(filePath) || isPublicEntry(filePath)) {
            continue;
        }

        if (!SOURCE_DIR_PREFIXES.some(prefix => filePath.startsWith(prefix))) {
            continue;
        }

        for (const [ name, decls ] of file.getExportedDeclarations()) {
            for (const decl of decls) {
            // We only catalogue origin declarations (skip re-exported aliases).
                if (decl.getSourceFile().getFilePath() !== filePath) {
                    continue;
                }

                const declName = getDeclarationName(decl);

                if (declName !== undefined && declName !== name) {
                    continue;
                }

                definitions.set(`${ filePath }::${ name }`, { file: filePath, name, decl });
            }
        }
    }

    const used = new Set<string>();

    const markUsedBySymbol = (symbol : TsSymbol | undefined) : void => {
        if (!symbol) {
            return;
        }

        const aliased = symbol.getAliasedSymbol() ?? symbol;

        for (const decl of aliased.getDeclarations()) {
            const declFile = decl.getSourceFile().getFilePath();

            const declName = Node.hasName(decl)
                ? decl.getName()
                : aliased.getName();

            if (!declName) {
                continue;
            }

            used.add(`${ declFile }::${ declName }`);
        }
    };

    // 2. Public-entry files: walk every export they expose and mark transitively-
    //    reached definitions as used. For type-only entries, only mark type-kind
    //    declarations.
    for (const file of sourceFiles) {
        const entry = getPublicEntry(file.getFilePath());

        if (!entry) {
            continue;
        }

        for (const [ , decls ] of file.getExportedDeclarations()) {
            for (const decl of decls) {
                if (!entry.valueExports && !isTypeOnlyDeclaration(decl)) {
                    continue;
                }

                const declName = getDeclarationName(decl);

                if (declName) {
                    used.add(`${ decl.getSourceFile().getFilePath() }::${ declName }`);
                }
            }
        }
    }

    // 3. Walk every named import / export-from in the project. Resolve via the
    //    compiler (which handles barrel chains automatically) and mark the origin.
    for (const file of sourceFiles) {
        for (const imp of file.getImportDeclarations()) {
            for (const named of imp.getNamedImports()) {
                markUsedBySymbol(named.getSymbol());
            }

            if (imp.getNamespaceImport()) {
            // `import * as X from 'm'` — pulls in every export of m.
                const target = imp.getModuleSpecifierSourceFile();

                if (target) {
                    for (const [ , decls ] of target.getExportedDeclarations()) {
                        for (const decl of decls) {
                            const declName = getDeclarationName(decl);

                            if (declName) {
                                used.add(`${ decl.getSourceFile().getFilePath() }::${ declName }`);
                            }
                        }
                    }
                }
            }
        }

        for (const exp of file.getExportDeclarations()) {
        // `export * from './y'` does NOT mark as used on its own — usage
        // must come from a real consumer down the chain. (Public entries
        // are handled above as a special case.)
            if (exp.isNamespaceExport() || exp.getNamedExports().length === 0) {
                continue;
            }

            for (const named of exp.getNamedExports()) {
                markUsedBySymbol(named.getSymbol());
            }
        }
    }

    // 3.5 Dynamic imports — `import(literal)` (typically `await import(...)`).
    //     Static walks miss the destructured names because the binding identifiers
    //     resolve to the local var, not the source export. Resolve the specifier
    //     ourselves, then mark the destructured names (or every export, if the
    //     call result is used without destructuring).
    const resolveRelativeSpecifier = (file : SourceFile, specifier : string) : SourceFile | undefined => {
        if (!specifier.startsWith('.')) {
            return undefined;
        }

        const base = path.resolve(path.dirname(file.getFilePath()), specifier);

        const candidates = [
        `${ base }.ts`,
        `${ base }.tsx`,
        path.join(base, 'index.ts'),
        path.join(base, 'index.tsx')
        ];

        for (const candidate of candidates) {
            const sf = project.getSourceFile(candidate);

            if (sf) {
                return sf;
            }
        }

        return undefined;
    };

    const markAllExportsOf = (target : SourceFile) : void => {
        for (const [ , decls ] of target.getExportedDeclarations()) {
            for (const decl of decls) {
                const declName = getDeclarationName(decl);

                if (declName) {
                    used.add(`${ decl.getSourceFile().getFilePath() }::${ declName }`);
                }
            }
        }
    };

    const markNamesFromModule = (target : SourceFile, names : ReadonlyArray<string>) : void => {
        const targetExports = target.getExportedDeclarations();

        for (const name of names) {
            const decls = targetExports.get(name);

            if (!decls) {
                continue;
            }

            for (const decl of decls) {
                const declName = getDeclarationName(decl) ?? name;

                used.add(`${ decl.getSourceFile().getFilePath() }::${ declName }`);
            }
        }
    };

    for (const file of sourceFiles) {
        file.forEachDescendant(node => {
            if (!Node.isCallExpression(node)) {
                return;
            }

            if (node.getExpression().getKind() !== SyntaxKind.ImportKeyword) {
                return;
            }

            const args = node.getArguments();

            if (args.length === 0 || !Node.isStringLiteral(args[0])) {
                return;
            }

            const target = resolveRelativeSpecifier(file, args[0].getLiteralValue());

            if (!target) {
                return;
            }

            let cursor : Node | undefined = node.getParent();

            while (cursor && Node.isAwaitExpression(cursor)) {
                cursor = cursor.getParent();
            }

            if (cursor && Node.isVariableDeclaration(cursor)) {
                const nameNode = cursor.getNameNode();

                if (Node.isObjectBindingPattern(nameNode)) {
                    const names : Array<string> = [];

                    for (const element of nameNode.getElements()) {
                        const propNode = element.getPropertyNameNode();

                        names.push(
                            propNode
                                ? propNode.getText()
                                : element.getName()
                        );
                    }

                    markNamesFromModule(target, names);
                    return;
                }
            }

            markAllExportsOf(target);
        });
    }

    // 4. Walk every Identifier in the project. Resolve to its declaration and
    //    mark as used. This catches in-file references (including `typeof X`,
    //    type references, function calls) so we don't flag symbols whose only
    //    consumer is the file that defines them.
    //
    //    Excludes the binding identifier of the declaration itself — otherwise
    //    every export trivially "references itself".
    const candidateNames = new Set<string>();

    for (const { name } of definitions.values()) {
        candidateNames.add(name);
    }

    const isOwnBindingIdentifier = (node : Node) : boolean => {
        const parent = node.getParent();

        if (!parent) {
            return false;
        }

        if (
            Node.isVariableDeclaration(parent) ||
            Node.isFunctionDeclaration(parent) ||
            Node.isClassDeclaration(parent) ||
            Node.isInterfaceDeclaration(parent) ||
            Node.isTypeAliasDeclaration(parent) ||
            Node.isEnumDeclaration(parent)
        ) {
            return parent.getNameNode() === node;
        }

        return false;
    };

    for (const file of sourceFiles) {
        file.forEachDescendant(node => {
            if (!Node.isIdentifier(node)) {
                return;
            }

            if (!candidateNames.has(node.getText())) {
                return;
            }

            if (isOwnBindingIdentifier(node)) {
                return;
            }

            markUsedBySymbol(node.getSymbol());
        });
    }

    // 4. Anything not in `used` is dead.
    const dead : Array<{ file : string, name : string, line : number, decl : ExportedDeclarations }> = [];

    for (const { file, name, decl } of definitions.values()) {
        if (!used.has(`${ file }::${ name }`)) {
            dead.push({ file, name, line: decl.getStartLineNumber(), decl });
        }
    }

    dead.sort((a, b) => {
        return a.file === b.file
            ? a.line - b.line
            : a.file.localeCompare(b.file);
    });

    // 5. In fix mode, strip the `export` keyword from each dead declaration.
    //    A subsequent ESLint pass (deadCodeEslintConfig) collapses the now-unused
    //    locals; side-effect-only declarations are left for human review.
    let removed = 0;
    const skipped : Array<DeadExport & { reason : string }> = [];

    if (FIX_MODE) {
        const filesTouched = new Set<ReturnType<ExportedDeclarations['getSourceFile']>>();

        for (const entry of dead) {
            const { decl } = entry;

            let target : Node = decl;

            if (Node.isVariableDeclaration(decl)) {
                const stmt = decl.getVariableStatement();

                if (!stmt) {
                    skipped.push({ file: entry.file, name: entry.name, line: entry.line, reason: `no variable statement` });
                    continue;
                }

                target = stmt;
            }

            if (
                Node.isVariableStatement(target) ||
                Node.isFunctionDeclaration(target) ||
                Node.isClassDeclaration(target) ||
                Node.isInterfaceDeclaration(target) ||
                Node.isTypeAliasDeclaration(target) ||
                Node.isEnumDeclaration(target) ||
                Node.isModuleDeclaration(target)
            ) {
                if (target.isExported()) {
                    target.setIsExported(false);
                    filesTouched.add(target.getSourceFile());
                    removed += 1;
                    continue;
                }

                skipped.push({ file: entry.file, name: entry.name, line: entry.line, reason: 'not directly exported' });
                continue;
            }

            skipped.push({
                file:   entry.file,
                name:   entry.name,
                line:   entry.line,
                reason: `unsupported node kind: ${ target.getKindName() }`
            });
        }

        for (const file of filesTouched) {
        // eslint-disable-next-line n/no-sync
            file.saveSync();
        }

        log(`Removed export keyword from ${ removed } declaration(s) across ${ filesTouched.size } file(s).`);

        for (const entry of skipped) {
            log(`Skipped ${ entry.file }:${ entry.line }  ${ entry.name }  (${ entry.reason })`);
        }
    } else if (dead.length === 0) {
        log('No dead exports found.');
    } else {
        log(`${ dead.length } dead export(s):`);

        for (const entry of dead) {
            log(`${ entry.file }:${ entry.line }  ${ entry.name }`);
        }
    }

    return {
        dead: dead.map(({ file, name, line }) => ({ file, name, line })),
        removed,
        skipped
    };
};
