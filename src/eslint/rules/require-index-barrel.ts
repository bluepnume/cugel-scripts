import path from 'node:path';

import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

const messages = {
    namedReexport:
        'Barrel `index.ts` files may only contain `export * from \'...\'`. ' +
        'Re-export the whole module instead of picking out names.',
    namespaceReexport:
        'Barrel `index.ts` files may only contain `export * from \'...\'`. ' +
        '`export * as ns from \'...\'` nests the exports under a namespace instead of flattening them.',
    nonBarrelStatement:
        'Barrel `index.ts` files may only contain `export * from \'...\'`, but this file has {{ description }}. ' +
        'Move it into a sibling module and `export *` from there.'
} as const;

type RuleContext = TSESLint.RuleContext<keyof typeof messages, ReadonlyArray<never>>;

type Statement = TSESTree.Program['body'][number];

const STATEMENT_DESCRIPTIONS : Record<string, string> = {
    ClassDeclaration:         'a class declaration',
    ExportDefaultDeclaration: 'a default export',
    ExportNamedDeclaration:   'a local export list',
    ExpressionStatement:      'a statement',
    FunctionDeclaration:      'a function declaration',
    ImportDeclaration:        'an import',
    TSDeclareFunction:        'a function declaration',
    TSEnumDeclaration:        'an enum declaration',
    TSInterfaceDeclaration:   'an interface declaration',
    TSModuleDeclaration:      'a module declaration',
    TSTypeAliasDeclaration:   'a type declaration',
    VariableDeclaration:      'a variable declaration'
};

// `export const foo = 1` is an ExportNamedDeclaration wrapping the real
// declaration — describe what is being declared, not the export keyword.
const describeStatement = (statement : Statement) : string => {
    const described = statement.type === 'ExportNamedDeclaration' && statement.declaration
        ? statement.declaration.type
        : statement.type;

    return STATEMENT_DESCRIPTIONS[described] ?? 'other code';
};

export const requireIndexBarrel = {
    meta: {
        type: 'problem',

        docs: {
            description:
                'Enforce that `index.ts` barrel files contain nothing but `export * from \'...\'` re-exports.'
        },

        messages,

        schema: []
    },

    create: (context : RuleContext) => {
        if (path.basename(context.filename) !== 'index.ts') {
            return {};
        }

        return {
            Program: (node : TSESTree.Program) => {
                for (const statement of node.body) {
                    if (statement.type === 'ExportAllDeclaration') {
                        // `export * as ns from './foo'` sets `exported`; a flat
                        // `export * from './foo'` leaves it null.
                        if (statement.exported) {
                            context.report({
                                node:      statement,
                                messageId: 'namespaceReexport'
                            });
                        }

                        continue;
                    }

                    if (statement.type === 'ExportNamedDeclaration' && statement.source) {
                        context.report({
                            node:      statement,
                            messageId: 'namedReexport'
                        });

                        continue;
                    }

                    context.report({
                        node:      statement,
                        messageId: 'nonBarrelStatement',
                        data:      {
                            description: describeStatement(statement)
                        }
                    });
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<keyof typeof messages>;
