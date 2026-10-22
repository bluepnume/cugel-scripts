import type ts from 'typescript';

import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';

const messages = {
    missingCatch:
        `Fire-and-forget async must have \`.catch(errorTracker(...))\` to avoid silently swallowing errors.`
} as const;

type RuleContext = TSESLint.RuleContext<keyof typeof messages, ReadonlyArray<never>>;

// Checks whether a CallExpression is a `.catch(...)` or `.finally(...)` call,
// which indicates the promise rejection is being handled.
const isErrorHandlingCall = (node : TSESTree.CallExpression) : boolean => {
    if (node.callee.type !== 'MemberExpression') {
        return false;
    }

    const property = node.callee.property;

    return (
        property.type === 'Identifier' &&
        (property.name === 'catch' || property.name === 'finally')
    );
};

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

export const noVoidWithoutCatch = {
    meta: {
        type: 'problem',

        docs: {
            description:
                `Require .catch() on fire-and-forget async calls using the void operator`
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

                // Only flag void on call expressions — void on other expressions
                // (e.g. void 0) is a different pattern and not fire-and-forget.
                if (node.argument.type !== 'CallExpression') {
                    return;
                }

                if (isErrorHandlingCall(node.argument)) {
                    return;
                }

                const tsNode = services.esTreeNodeToTSNodeMap.get(node.argument);
                const type = checker.getTypeAtLocation(tsNode);

                if (!isPromiseType(type, checker)) {
                    return;
                }

                context.report({
                    node,
                    messageId: 'missingCatch'
                });
            }
        };
    }
} satisfies TSESLint.RuleModule<keyof typeof messages>;
