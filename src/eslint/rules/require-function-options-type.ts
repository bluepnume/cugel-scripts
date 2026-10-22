import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

const messages = {
    inlineObjectType:
        `Object parameter type should be declared as \`type {{ expectedTypeName }} = ...\` instead of inline.`,
    wrongTypeName:
        `Options type should be named \`{{ expectedTypeName }}\` instead of \`{{ actualTypeName }}\`.`,
    typeNotAdjacent:
        `Options type \`{{ expectedTypeName }}\` should be declared directly before the function it's used by.`
} as const;

type RuleContext = TSESLint.RuleContext<keyof typeof messages, ReadonlyArray<never>>;

type FunctionNode =
    | TSESTree.ArrowFunctionExpression
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression;

// Capitalizes the first character of a camelCase name to produce PascalCase.
// This codebase uses camelCase exclusively for function names, so this is sufficient.
const toPascalCase = (name : string) : string =>
    name.charAt(0).toUpperCase() + name.slice(1);

// Only derives names from const/let/var declarations and function declarations.
// Object method properties and callbacks are intentionally skipped since the
// naming convention (FunctionNameOptions) doesn't apply cleanly to those cases.
const getFunctionName = (node : FunctionNode) : string | undefined => {
    if (node.type === 'FunctionDeclaration' && node.id) {
        return node.id.name;
    }

    if (
        node.parent.type === 'VariableDeclarator' &&
        node.parent.id.type === 'Identifier'
    ) {
        return node.parent.id.name;
    }

    return undefined;
};

// Walks up from the function node to find the top-level statement to insert
// the type declaration before. Returns undefined for non-module-level functions
// (e.g. nested inside blocks or other functions) to avoid invalid insertion.
const getInsertionNode = (
    node : FunctionNode
) : TSESTree.ProgramStatement | undefined => {
    const declaration : TSESTree.Node = node.parent.type === 'VariableDeclarator'
        ? node.parent.parent
        : node;

    const isExported = declaration.parent.type === 'ExportNamedDeclaration' ||
        declaration.parent.type === 'ExportDefaultDeclaration';

    const target = isExported
        ? declaration.parent
        : declaration;

    // Confirmed to be a direct child of Program, so it's a ProgramStatement.
    return target.parent?.type === 'Program'
        ? target as TSESTree.ProgramStatement
        : undefined;
};

type TypeNameIndex = {
    exists : (name : string) => boolean,
    findDeclarationId : (name : string) => TSESTree.Identifier | undefined,
    countReferences : (name : string) => number,
};

// Pre-computes a lookup index of all type names in the program body (type
// aliases, interfaces, imports, and re-exports) so that repeated checks
// across multiple function nodes are O(1) instead of O(N) per lookup.
const buildTypeNameIndex = (
    programBody : ReadonlyArray<TSESTree.ProgramStatement>
) : TypeNameIndex => {
    const knownNames = new Set<string>();
    const declarationIds = new Map<string, TSESTree.Identifier>();

    const isObjectTypeDeclaration = (
        statement : TSESTree.TSTypeAliasDeclaration | TSESTree.TSInterfaceDeclaration
    ) : boolean =>
        statement.type === 'TSInterfaceDeclaration' ||
        statement.typeAnnotation.type === 'TSTypeLiteral';

    for (const statement of programBody) {
        if (
            statement.type === 'TSTypeAliasDeclaration' ||
            statement.type === 'TSInterfaceDeclaration'
        ) {
            knownNames.add(statement.id.name);

            // Only track object-type declarations for rename checks — enums,
            // unions, and other non-object types are not options types.
            if (isObjectTypeDeclaration(statement)) {
                declarationIds.set(statement.id.name, statement.id);
            }
        }

        if (statement.type === 'ExportNamedDeclaration') {
            const decl = statement.declaration;

            // Exported types are tracked for existence (to avoid duplicate
            // insertions) but NOT added to declarationIds — renaming an
            // exported type would break other files that import it.
            if (
                decl?.type === 'TSTypeAliasDeclaration' ||
                decl?.type === 'TSInterfaceDeclaration'
            ) {
                knownNames.add(decl.id.name);
            }

            for (const specifier of statement.specifiers) {
                if (specifier.exported.type === 'Identifier') {
                    knownNames.add(specifier.exported.name);
                }
            }
        }

        if (statement.type === 'ImportDeclaration') {
            for (const specifier of statement.specifiers) {
                knownNames.add(specifier.local.name);
            }
        }
    }

    // Count all TSTypeReference usages per name so we can skip types that are
    // referenced in multiple places (e.g. as a field type and a parameter type).
    const referenceCounts = new Map<string, number>();

    const countRefs = (node : TSESTree.Node) : void => {
        if (
            node.type === 'TSTypeReference' &&
            node.typeName.type === 'Identifier'
        ) {
            const name = node.typeName.name;

            referenceCounts.set(name, (referenceCounts.get(name) ?? 0) + 1);
        }

        for (const key of Object.keys(node)) {
            if (key === 'parent') {
                continue;
            }

            const value = (node as unknown as Record<string, unknown>)[key];

            if (Array.isArray(value)) {
                for (const item of value) {
                    if (item && typeof item === 'object' && 'type' in item) {
                        countRefs(item as TSESTree.Node);
                    }
                }
            } else if (value && typeof value === 'object' && 'type' in value) {
                countRefs(value as TSESTree.Node);
            }
        }
    };

    for (const statement of programBody) {
        countRefs(statement);
    }

    return {
        exists:            (name) => knownNames.has(name),
        findDeclarationId: (name) => declarationIds.get(name),
        countReferences:   (name) => referenceCounts.get(name) ?? 0
    };
};

type FixFunction =
    | ((fixer : TSESLint.RuleFixer) => TSESLint.RuleFix | ReadonlyArray<TSESLint.RuleFix>)
    | undefined;

// Extracts the generic type parameters text from a function node so the
// autofix can forward them to the extracted type declaration.
const getGenericsText = (
    node : FunctionNode,
    sourceCode : TSESLint.SourceCode
) : { genericsText : string, genericsNames : string } => {
    if (!node.typeParameters) {
        return { genericsText: '', genericsNames: '' };
    }

    const fullText = sourceCode.getText(node.typeParameters);

    const genericsNames = node.typeParameters.params
        .map(param => param.name.name)
        .join(', ');

    // Strip the surrounding < > from the full text to get just the params.
    return {
        genericsText: fullText.slice(1, -1),
        genericsNames
    };
};

type BuildInlineFixOptions = {
    insertionNode : TSESTree.Node | undefined,
    alreadyExists : boolean,
    typeNode : TSESTree.TSTypeLiteral,
    expectedTypeName : string,
    typeText : string,
    genericsText : string,
    genericsNames : string,
};

// When the type already exists, the fix only replaces the inline type with
// the name — TypeScript itself will catch any shape mismatch at compile time.
const buildInlineFix = ({
    insertionNode,
    alreadyExists,
    typeNode,
    expectedTypeName,
    typeText,
    genericsText,
    genericsNames
} : BuildInlineFixOptions) : FixFunction => {
    const referenceText = genericsNames
        ? `${ expectedTypeName }<${ genericsNames }>`
        : expectedTypeName;

    if (alreadyExists) {
        return (fixer : TSESLint.RuleFixer) : TSESLint.RuleFix =>
            fixer.replaceText(typeNode, referenceText);
    }

    if (!insertionNode) {
        return undefined;
    }

    const declaration = genericsText
        ? `type ${ expectedTypeName }<${ genericsText }> = ${ typeText };\n\n`
        : `type ${ expectedTypeName } = ${ typeText };\n\n`;

    return (fixer : TSESLint.RuleFixer) : ReadonlyArray<TSESLint.RuleFix> => [
        fixer.insertTextBefore(insertionNode, declaration),
        fixer.replaceText(typeNode, referenceText)
    ];
};

type BuildRenameFixOptions = {
    declarationId : TSESTree.Identifier | undefined,
    actualTypeName : string,
    expectedTypeName : string,
    sourceCode : TSESLint.SourceCode,
};

// Renames a wrongly-named type by replacing the declaration and all
// TSTypeReference nodes in the file that use the old name.
const buildRenameFix = ({
    declarationId,
    actualTypeName,
    expectedTypeName,
    sourceCode
} : BuildRenameFixOptions) : FixFunction => {
    const referenceNodes : Array<TSESTree.Identifier> = [];

    // Walk the entire AST to find all TSTypeReference nodes using the old name.
    const visit = (node : TSESTree.Node) : void => {
        if (
            node.type === 'TSTypeReference' &&
            node.typeName.type === 'Identifier' &&
            node.typeName.name === actualTypeName
        ) {
            referenceNodes.push(node.typeName);
        }

        for (const key of Object.keys(node)) {
            if (key === 'parent') {
                continue;
            }

            const value = (node as unknown as Record<string, unknown>)[key];

            if (Array.isArray(value)) {
                for (const item of value) {
                    if (item && typeof item === 'object' && 'type' in item) {
                        visit(item as TSESTree.Node);
                    }
                }
            } else if (value && typeof value === 'object' && 'type' in value) {
                visit(value as TSESTree.Node);
            }
        }
    };

    visit(sourceCode.ast);

    const allNodes = declarationId
        ? [ declarationId, ...referenceNodes ]
        : referenceNodes;

    if (allNodes.length === 0) {
        return undefined;
    }

    return (fixer : TSESLint.RuleFixer) : ReadonlyArray<TSESLint.RuleFix> =>
        allNodes.map(node => fixer.replaceText(node, expectedTypeName));
};

// Walks up from a type declaration's identifier to its program-level
// statement. The caller supplies a `declarationId` from the type index,
// which only stores non-exported top-level declarations — so the parent
// chain is always Identifier → TSTypeAliasDeclaration | TSInterfaceDeclaration
// → Program. The unreachable cases return undefined as a defensive fallback.
const getTypeStatement = (
    declarationId : TSESTree.Identifier
) : TSESTree.ProgramStatement | undefined => {
    const declaration = declarationId.parent;

    if (
        declaration.type !== 'TSTypeAliasDeclaration' &&
        declaration.type !== 'TSInterfaceDeclaration'
    ) {
        return undefined;
    }

    // Confirmed to be a direct child of Program, so it's a ProgramStatement.
    return declaration.parent.type === 'Program'
        ? declaration
        : undefined;
};

type PendingRenameReport = {
    typeAnnotation : TSESTree.TSTypeReference,
    expectedTypeName : string,
    actualTypeName : string,
};

type PendingAdjacencyReport = {
    typeAnnotation : TSESTree.TSTypeReference,
    functionStatement : TSESTree.ProgramStatement,
    expectedTypeName : string,
};

// Moves the type declaration so it sits directly before the function. Removes
// the type from its original position (consuming surrounding whitespace) and
// re-inserts the same text immediately before the function statement.
type BuildMoveFixOptions = {
    typeStatement : TSESTree.ProgramStatement,
    typeStmtIdx : number,
    functionStatement : TSESTree.ProgramStatement,
    programBody : ReadonlyArray<TSESTree.ProgramStatement>,
    sourceCode : TSESLint.SourceCode,
};

const buildMoveFix = ({
    typeStatement,
    typeStmtIdx,
    functionStatement,
    programBody,
    sourceCode
} : BuildMoveFixOptions) : FixFunction => {
    const typeText = sourceCode.getText(typeStatement);
    const nextStatement = programBody[typeStmtIdx + 1];
    const previousStatement = programBody[typeStmtIdx - 1];
    const isTypeLast = !nextStatement;

    // Default to consuming the type and the trailing whitespace up to the next
    // statement. When the type is the last statement, there's no trailing
    // whitespace to consume, so consume the leading whitespace from the
    // previous statement instead — otherwise the move leaves a stray blank
    // line at the end of the file.
    const removeStart = isTypeLast
        ? (previousStatement?.range[1] ?? typeStatement.range[0])
        : typeStatement.range[0];

    const removeEnd = isTypeLast
        ? typeStatement.range[1]
        : nextStatement.range[0];

    return (fixer : TSESLint.RuleFixer) : ReadonlyArray<TSESLint.RuleFix> => [
        fixer.removeRange([ removeStart, removeEnd ]),
        fixer.insertTextBefore(functionStatement, `${ typeText }\n\n`)
    ];
};

// Extracts the type annotation from a parameter, handling both plain params
// like `opts : { ... }` and default-value params like `opts : { ... } = {}`.
const getParamTypeAnnotation = (
    param : TSESTree.Parameter
) : TSESTree.TypeNode | undefined => {
    if (param.type === 'TSParameterProperty') {
        return undefined;
    }

    // Default params: `(opts : { bar : string } = {})` — the type annotation
    // is on the AssignmentPattern's `left` node, not the AssignmentPattern itself.
    return param.type === `AssignmentPattern`
        ? param.left.typeAnnotation?.typeAnnotation
        : param.typeAnnotation?.typeAnnotation;
};

export const requireFunctionOptionsType = {
    meta: {
        type: 'suggestion',

        docs: {
            description:
                `Require object parameter types to be declared as named types instead of inline`
        },

        fixable: 'code',

        messages,

        schema: []
    },

    create: (context : RuleContext) => {
        const program = context.sourceCode.ast;
        const typeIndex = buildTypeNameIndex(program.body);

        // Tracks how many functions reference each type name as a parameter
        // type. Shared types (used by multiple functions) are intentional and
        // should not be flagged for renaming.
        const typeUsageCounts = new Map<string, number>();

        const pendingRenames : Array<PendingRenameReport> = [];
        const pendingAdjacency : Array<PendingAdjacencyReport> = [];

        const checkFunction = (node : FunctionNode) : void => {
            const functionName = getFunctionName(node);

            if (!functionName) {
                return;
            }

            // Only check the last param — the codebase convention is (context, opts)
            // where the options object is always the last parameter.
            const lastParam = node.params.at(-1);

            if (!lastParam) {
                return;
            }

            const typeAnnotation = getParamTypeAnnotation(lastParam);
            const pascalFunctionName = toPascalCase(functionName);
            const expectedTypeName = `${ pascalFunctionName }Options`;

            // Case 1: Named type reference defined in the same file — check the
            // name matches convention. We only flag types with a local declaration
            // so that generics, imports, and external types are left alone.
            if (
                typeAnnotation?.type === 'TSTypeReference' &&
                typeAnnotation.typeName.type === 'Identifier' &&
                typeIndex.findDeclarationId(typeAnnotation.typeName.name)
            ) {
                const actualTypeName = typeAnnotation.typeName.name;

                typeUsageCounts.set(
                    actualTypeName,
                    (typeUsageCounts.get(actualTypeName) ?? 0) + 1
                );

                if (actualTypeName === expectedTypeName) {
                    // Defer adjacency reports until Program:exit so we can
                    // skip shared types (used by multiple functions or in
                    // other contexts like field types).
                    const insertionNode = getInsertionNode(node);

                    if (insertionNode) {
                        pendingAdjacency.push({
                            typeAnnotation,
                            functionStatement: insertionNode,
                            expectedTypeName
                        });
                    }

                    return;
                }

                // Defer rename reports until Program:exit so we can skip shared types.
                pendingRenames.push({
                    typeAnnotation,
                    expectedTypeName,
                    actualTypeName
                });

                return;
            }

            // Case 2: Inline object type — extract to a named type declaration.
            if (typeAnnotation?.type !== 'TSTypeLiteral') {
                return;
            }

            const insertionNode = getInsertionNode(node);
            const alreadyExists = typeIndex.exists(expectedTypeName);

            // Skip nested functions where we can't insert a type and it doesn't
            // already exist — reporting without a fix is confusing.
            if (!insertionNode && !alreadyExists) {
                return;
            }

            const typeText = context.sourceCode.getText(typeAnnotation);

            const { genericsText, genericsNames } = getGenericsText(
                node, context.sourceCode
            );

            context.report({
                node:      typeAnnotation,
                messageId: 'inlineObjectType',
                data:      { expectedTypeName },
                fix:       buildInlineFix({
                    insertionNode,
                    alreadyExists,
                    typeNode: typeAnnotation,
                    expectedTypeName,
                    typeText,
                    genericsText,
                    genericsNames
                })
            });
        };

        return {
            'ArrowFunctionExpression': checkFunction,
            'FunctionDeclaration':     checkFunction,
            'FunctionExpression':      checkFunction,

            // Report rename and adjacency violations after all functions have
            // been visited, so we can skip types that are shared by multiple
            // functions or referenced elsewhere in the file (e.g. as a field
            // type).
            'Program:exit': () => {
                for (const { typeAnnotation, expectedTypeName, actualTypeName } of pendingRenames) {
                    // Skip types used as params by multiple functions.
                    if ((typeUsageCounts.get(actualTypeName) ?? 0) > 1) {
                        continue;
                    }

                    // Skip types referenced more than once in the file — they're
                    // domain types used in other contexts (field types, return
                    // types, etc.), not just an options type for one function.
                    if (typeIndex.countReferences(actualTypeName) > 1) {
                        continue;
                    }

                    context.report({
                        node:      typeAnnotation,
                        messageId: 'wrongTypeName',
                        data:      { expectedTypeName, actualTypeName },
                        fix:       buildRenameFix({
                            declarationId: typeIndex.findDeclarationId(actualTypeName),
                            actualTypeName,
                            expectedTypeName,
                            sourceCode:    context.sourceCode
                        })
                    });
                }

                for (const { typeAnnotation, functionStatement, expectedTypeName } of pendingAdjacency) {
                    // Skip types shared by multiple functions — moving a
                    // shared type to one specific function is misleading.
                    if ((typeUsageCounts.get(expectedTypeName) ?? 0) > 1) {
                        continue;
                    }

                    // Skip types referenced elsewhere (e.g. as a field type)
                    // since they're domain types, not single-use options types.
                    if (typeIndex.countReferences(expectedTypeName) > 1) {
                        continue;
                    }

                    // Exported types are not in the declaration index, so this
                    // also implicitly skips them (consistent with rename).
                    const declarationId = typeIndex.findDeclarationId(expectedTypeName);

                    if (!declarationId) {
                        continue;
                    }

                    const typeStatement = getTypeStatement(declarationId);

                    if (!typeStatement) {
                        continue;
                    }

                    const programBody = program.body;
                    const typeStmtIdx = programBody.indexOf(typeStatement);
                    const funcStmtIdx = programBody.indexOf(functionStatement);

                    // Defensive: both nodes were resolved as program-level
                    // earlier, so indexOf should always find them.
                    if (funcStmtIdx === -1 || typeStmtIdx === -1) {
                        continue;
                    }

                    if (typeStmtIdx === funcStmtIdx - 1) {
                        continue;
                    }

                    context.report({
                        node:      typeAnnotation,
                        messageId: 'typeNotAdjacent',
                        data:      { expectedTypeName },
                        fix:       buildMoveFix({
                            typeStatement,
                            typeStmtIdx,
                            functionStatement,
                            programBody,
                            sourceCode: context.sourceCode
                        })
                    });
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<keyof typeof messages>;
