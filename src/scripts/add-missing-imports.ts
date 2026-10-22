/* eslint-disable n/no-sync -- TypeScript language service requires sync I/O */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';

export type AddMissingImportsOptions = {
    readonly root : string,
    // Files to fix; when omitted, every file in the tsconfig program.
    readonly files ?: ReadonlyArray<string>,
    readonly log ?: (line : string) => void,
};

// Adds imports for every "cannot find name" diagnostic the TypeScript language
// service can resolve, preferring in-repo sources over bare module names.
// Returns the files it changed.
export const addMissingImports = ({
    root,
    files: requestedFiles,
    log = () => undefined
} : AddMissingImportsOptions) : Array<string> => {
    const all = requestedFiles === undefined;
    const explicitFiles = (requestedFiles ?? []).map(f => resolve(root, f));

    const configPath = ts.findConfigFile(root, f => ts.sys.fileExists(f), 'tsconfig.json');

    if (!configPath) {
        throw new Error(`No tsconfig.json found from ${ root }`);
    }

    const configFile = ts.readConfigFile(configPath, f => ts.sys.readFile(f));
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(configPath));

    const rootFiles = new Set([ ...parsed.fileNames, ...explicitFiles ]);

    const files = all
        ? parsed.fileNames.filter(f => !f.endsWith('.d.ts'))
        : explicitFiles;

    // In-memory overlay of edited files, so each applied import fix is visible to
    // the language service on the next iteration (a constant script version would
    // cache the pre-edit text and stop us iterating).
    const overlayContent = new Map<string, string>();
    const overlayVersion = new Map<string, number>();

    const currentContent = (f : string) : string | undefined =>
        overlayContent.get(f) ?? (existsSync(f)
            ? readFileSync(f, 'utf8')
            : undefined);

    const host : ts.LanguageServiceHost = {
        getScriptFileNames: () => [ ...rootFiles ],
        getScriptVersion:   f => String(overlayVersion.get(resolve(f)) ?? 0),

        getScriptSnapshot: f => {
            const content = currentContent(resolve(f));

            return content === undefined
                ? undefined
                : ts.ScriptSnapshot.fromString(content);
        },

        getCurrentDirectory:    () => root,
        getCompilationSettings: () => parsed.options,
        getDefaultLibFileName:  opts => ts.getDefaultLibFilePath(opts),
        fileExists:             f => ts.sys.fileExists(f),
        readFile:               f => ts.sys.readFile(f),
        readDirectory:          (...a : Parameters<typeof ts.sys.readDirectory>) => ts.sys.readDirectory(...a),
        directoryExists:        f => ts.sys.directoryExists(f),
        getDirectories:         f => ts.sys.getDirectories(f)
    };

    const service = ts.createLanguageService(host, ts.createDocumentRegistry());

    const formatOptions : ts.FormatCodeSettings = {
        indentSize:                     4,
        tabSize:                        4,
        convertTabsToSpaces:            true,
        insertSpaceAfterCommaDelimiter: true
    };

    const preferences : ts.UserPreferences = {
        importModuleSpecifierPreference: 'shortest',
        quotePreference:                 'single'
    };

    // "Cannot find name" family — the diagnostics a missing import resolves.
    const MISSING_NAME_CODES = new Set([ 2304, 2503, 2552, 2663, 2693 ]);

    // Apply a set of file changes into the overlay (newest offset first so earlier
    // spans stay valid), bumping each touched file's version.
    const applyFileChanges = (changes : ReadonlyArray<ts.FileTextChanges>) : void => {
        for (const fileChange of changes) {
            const target = resolve(fileChange.fileName);
            let next = currentContent(target) ?? '';

            for (const edit of [ ...fileChange.textChanges ].toSorted((a, b) => b.span.start - a.span.start)) {
                next = next.slice(0, edit.span.start) + edit.newText + next.slice(edit.span.start + edit.span.length);
            }

            overlayContent.set(target, next);
            overlayVersion.set(target, (overlayVersion.get(target) ?? 0) + 1);
        }
    };

    const missingNameDiagnostics = (file : string) : ReadonlyArray<ts.Diagnostic> =>
        service.getSemanticDiagnostics(file)
            .filter(diagnostic => diagnostic.start !== undefined && MISSING_NAME_CODES.has(diagnostic.code));

    // `getCodeFixesAtPosition` can hit an internal TS formatter assertion on some
    // type-heavy files; treat a throw as "no candidates here" so one bad position
    // never aborts the run (the combined-fix fallback below mops up).
    const safeCodeFixesAtPosition = (file : string, diagnostic : ts.Diagnostic) : ReadonlyArray<ts.CodeFixAction> => {
        try {
            return service.getCodeFixesAtPosition(
                file,
                diagnostic.start ?? 0,
                (diagnostic.start ?? 0) + (diagnostic.length ?? 0),
                [ diagnostic.code ],
                formatOptions,
                preferences
            );
        } catch {
            return [];
        }
    };

    // The module a "fixMissingImport" action imports from, parsed off its
    // description (e.g. Import 'run' from "../../lib").
    const importSpecifier = (fix : ts.CodeFixAction) : string =>
        ((/from ["']([^"']+)["']/).exec(fix.description))?.[1] ?? '';

    // Prefer an in-repo (relative) source over a bare node/external module, so an
    // ambiguous name like `run` resolves to ../../lib, not 'node:test'.
    const chooseImportFix = (fixes : ReadonlyArray<ts.CodeFixAction>) : ts.CodeFixAction | undefined => {
        const importFixes = fixes.filter(fix => fix.fixName === 'import');

        return importFixes.find(fix => importSpecifier(fix).startsWith('.')) ?? importFixes[0];
    };

    for (const file of files) {
    // Resolve missing-import diagnostics one at a time, re-reading after each
    // fix (one import can clear several occurrences). The guard bounds the loop
    // against a name no import can satisfy.
        for (let guard = 0; guard < 500; guard++) {
            const fix = missingNameDiagnostics(file)
                .map(diagnostic => chooseImportFix(safeCodeFixesAtPosition(file, diagnostic)))
                .find(candidate => candidate !== undefined);

            if (fix === undefined) {
                break;
            }

            applyFileChanges(fix.changes);
        }

        // Fallback for names the per-position path couldn't resolve (a formatter
        // crash there). TS's combined fix may not honour the repo-first preference,
        // but it's better than leaving the import missing. Reads the overlay, so it
        // only adds what's still missing.
        if (missingNameDiagnostics(file).length > 0) {
            try {
                applyFileChanges(service.getCombinedCodeFix(
                    { type: 'file', fileName: file },
                    'fixMissingImport',
                    formatOptions,
                    preferences
                ).changes);
            } catch {
            // Give up on this file; leave its remaining imports for a human.
            }
        }
    }

    const updated : Array<string> = [];

    for (const [ target, content ] of overlayContent) {
        writeFileSync(target, content);
        updated.push(target);
        log(`Updated ${ relative(root, target) }`);
    }

    return updated;
};
/* eslint-enable n/no-sync */
