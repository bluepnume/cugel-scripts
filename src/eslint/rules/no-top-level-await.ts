import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

const messages = {
    topLevelAwaitNotAllowed: 'Top-level await is not allowed.'
} as const;

const isTopLevel = (node : TSESTree.AwaitExpression) : boolean => {
    let currentNode : TSESTree.AwaitExpression | TSESTree.AwaitExpression['parent'] = node;

    while (currentNode.parent !== currentNode) {
        if (!('type' in currentNode.parent)) {
            return false;
        }

        if (currentNode.parent.type === 'Program') {
            return true;
        }

        if (
            currentNode.parent.type === 'FunctionDeclaration' ||
            currentNode.parent.type === 'FunctionExpression' ||
            currentNode.parent.type === 'ArrowFunctionExpression'
        ) {
            return false;
        }

        currentNode = currentNode.parent;
    }

    return false;
};

export const noTopLevelAwait = {
    meta: {
        type: 'problem',

        docs: {
            description: 'Disallow top level await'
        },

        messages,

        schema: []
    },

    create: (context) => {
        return {
            AwaitExpression: (node) => {
                if (isTopLevel(node)) {
                    context.report({
                        node,
                        messageId: 'topLevelAwaitNotAllowed'
                    });
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<keyof typeof messages>;
