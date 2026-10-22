import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

const messages = {
    noInNarrowing: `Avoid using the \`in\` operator to narrow discriminated unions. Use the discriminant property instead (e.g. \`obj.type === 'foo'\`). The \`in\` operator is fragile — if a property is added or removed from a variant, the check silently breaks without a type error.`
} as const;

export const noInOperatorNarrowing = {
    meta: {
        type: 'suggestion',

        docs: {
            description: 'Disallow using the `in` operator for type narrowing'
        },

        messages,

        schema: []
    },

    create: (context) => {
        return {
            BinaryExpression: (node : TSESTree.BinaryExpression) => {
                if (node.operator !== 'in') {
                    return;
                }

                context.report({
                    node,
                    messageId: 'noInNarrowing'
                });
            }
        };
    }
} satisfies TSESLint.RuleModule<keyof typeof messages>;
