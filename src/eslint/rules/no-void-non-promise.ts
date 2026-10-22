import type ts from 'typescript';

import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';

const messages = {
    voidNonPromise:
        `The \`void\` operator should only be used on Promises. This expression does not return a Promise.`
} as const;

type RuleContext = TSESLint.RuleContext<keyof typeof messages, ReadonlyArray<never>>;

// Checks whether a type is a Promise (or thenable) by looking for a callable
// `then` property — either directly on the type or on its base types.
const isPromiseType = (type : ts.Type, checker : ts.TypeChecker) : boolean => {
    const thenProperty = type.getProperty('then');

    if (thenProperty) {
        const declaration = thenProperty.valueDeclaration ?? thenProperty.declarations?.[0];

        if (declaration) {
            const thenType = checker.getTypeOfSymbolAtLocation(thenProperty, declaration);

            if (thenType.getCallSignatures().length > 0) {
                return true;
            }
        }
    }

    // Only InterfaceType has base types — guard via the objectFlags check.
    if (type.isClassOrInterface()) {
        for (const baseType of checker.getBaseTypes(type)) {
            if (isPromiseType(baseType, checker)) {
                return true;
            }
        }
    }

    return false;
};

export const noVoidNonPromise = {
    meta: {
        type: 'problem',

        docs: {
            description:
                `Disallow the void operator on non-Promise expressions`
        },

        messages,

        schema: []
    },

    create: (context : RuleContext) => {
        const services = ESLintUtils.getParserServices(context);
        const checker = services.program.getTypeChecker();

        return {
            UnaryExpression: (node : TSESTree.UnaryExpression) => {
                if (node.operator !== 'void') {
                    return;
                }

                // void 0 is an idiomatic pattern for `undefined` — not relevant here.
                if (
                    node.argument.type === 'Literal' &&
                    node.argument.value === 0
                ) {
                    return;
                }

                // Only check call expressions — void on identifiers or other
                // non-call expressions is handled by other rules.
                if (node.argument.type !== 'CallExpression') {
                    return;
                }

                const tsNode = services.esTreeNodeToTSNodeMap.get(node.argument);
                const type = checker.getTypeAtLocation(tsNode);

                if (isPromiseType(type, checker)) {
                    return;
                }

                context.report({
                    node,
                    messageId: 'voidNonPromise'
                });
            }
        };
    }
} satisfies TSESLint.RuleModule<keyof typeof messages>;
