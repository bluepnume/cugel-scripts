import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

const messages = {
    unusedLocal: '\'{{ name }}\' is declared but never used.'
} as const;

const isExported = (node : TSESTree.Node) : boolean => {
    return node.parent?.type === 'ExportNamedDeclaration' || node.parent?.type === 'ExportDefaultDeclaration';
};

const getRemovalRange = (node : TSESTree.Node, sourceCode : TSESLint.SourceCode) : [number, number] => {
    const start = node.range[0];
    let end = node.range[1];
    const tokenAfter = sourceCode.getTokenAfter(node);

    if (tokenAfter?.range[0] !== end) {
        const text = sourceCode.getText();

        while (end < text.length && (text[end] === ' ' || text[end] === '\t')) {
            end += 1;
        }

        if (text[end] === '\n') {
            end += 1;
        } else if (text[end] === '\r' && text[end + 1] === '\n') {
            end += 2;
        }
    }

    return [ start, end ];
};

export const noUnusedLocals = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Detect and optionally remove unused local declarations'
        },
        fixable: 'code',
        messages,
        schema:  []
    },

    create: (context) => {
        return {
            'Program:exit': () => {
                const sourceCode = context.sourceCode;
                const scope = sourceCode.getScope(sourceCode.ast);

                const checkScope = (currentScope : TSESLint.Scope.Scope) : void => {
                    for (const variable of currentScope.variables) {
                        if (variable.defs.length === 0) {
                            continue;
                        }

                        const def = variable.defs[0];

                        if (
                            !def ||
                            (
                                def.type !== 'Variable' &&
                                def.type !== 'Type' &&
                                def.type !== 'TSEnumName' &&
                                def.type !== 'FunctionName' &&
                                def.type !== 'ClassName'
                            )
                        ) {
                            continue;
                        }

                        // skip type parameters and mapped type variables
                        if (def.type === 'Type' && def.node.type !== 'TSTypeAliasDeclaration') {
                            continue;
                        }

                        // a class declaration registers its name in BOTH the
                        // outer scope and the class's own scope (for self-
                        // reference). Only report from the outer scope.
                        if (def.type === 'ClassName' && currentScope.type === 'class') {
                            continue;
                        }

                        // named function/class EXPRESSIONS bind their name
                        // inside their own body (for self-reference); skip
                        // those — we only care about top-level declarations.
                        if (def.type === 'FunctionName' && def.node.type !== 'FunctionDeclaration') {
                            continue;
                        }

                        if (def.type === 'ClassName' && def.node.type !== 'ClassDeclaration') {
                            continue;
                        }

                        if (variable.name.startsWith('_')) {
                            continue;
                        }

                        // skip destructured variables — removing one can break siblings
                        if (def.type === 'Variable' && def.node.id.type !== 'Identifier') {
                            continue;
                        }

                        const declarationNode = def.type === 'Variable'
                            ? def.parent
                            : def.node;

                        if (isExported(declarationNode)) {
                            continue;
                        }

                        const hasRead = variable.references.some(ref => ref.isRead());

                        if (hasRead) {
                            continue;
                        }

                        context.report({
                            node:      declarationNode,
                            messageId: 'unusedLocal',
                            data:      { name: variable.name },

                            fix: (fixer) => {
                                if (
                                    def.type === 'Variable' &&
                                    def.parent.declarations.length > 1
                                ) {
                                    const declarator = def.node;
                                    const declarations : ReadonlyArray<TSESTree.Node> = def.parent.declarations;
                                    const index = declarations.indexOf(declarator);
                                    const prev = declarations[index - 1];
                                    const next = declarations[index + 1];

                                    const removeStart = index === 0
                                        ? declarator.range[0]
                                        : prev?.range[1] ?? declarator.range[0];

                                    const removeEnd = index === 0
                                        ? next?.range[0] ?? declarator.range[1]
                                        : declarator.range[1];

                                    return fixer.removeRange([ removeStart, removeEnd ]);
                                }

                                const [ start, end ] = getRemovalRange(declarationNode, sourceCode);
                                return fixer.removeRange([ start, end ]);
                            }
                        });
                    }

                    for (const childScope of currentScope.childScopes) {
                        checkScope(childScope);
                    }
                };

                checkScope(scope);
            }
        };
    }
} satisfies TSESLint.RuleModule<keyof typeof messages>;
