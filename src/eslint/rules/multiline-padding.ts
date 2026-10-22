import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

const messages = {
    expectedBlankLineAroundFunctionProperty:
        'Expected blank line around object property whose value is a function.'
} as const;

const isFunctionValued = (prop : TSESTree.ObjectLiteralElement) : boolean => {
    if (prop.type !== 'Property') {
        return false;
    }

    const value = prop.value;
    return value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression';
};

const isMultiline = (prop : TSESTree.ObjectLiteralElement) : boolean => {
    return prop.loc.start.line !== prop.loc.end.line;
};

export const multilinePadding = {
    meta: {
        type: 'layout',

        docs: {
            description:
                'Require blank lines around adjacent object properties whose values are multiline functions'
        },

        fixable: 'whitespace',

        messages,

        schema: []
    },

    create: (context) => {
        const sourceCode = context.sourceCode;

        const checkObjectExpression = (node : TSESTree.ObjectExpression) : void => {
            for (let i = 1; i < node.properties.length; i++) {
                const prev = node.properties[i - 1];
                const curr = node.properties[i];

                if (!prev || !curr) {
                    continue;
                }

                const prevTriggers = isFunctionValued(prev) && isMultiline(prev);
                const currTriggers = isFunctionValued(curr) && isMultiline(curr);

                if (!prevTriggers && !currTriggers) {
                    continue;
                }

                const tokenAfterPrev = sourceCode.getTokenAfter(prev);

                const prevEndLine = tokenAfterPrev?.value === ','
                    ? tokenAfterPrev.loc.end.line
                    : prev.loc.end.line;

                const commentsBefore = sourceCode.getCommentsBefore(curr);
                const firstLeading = commentsBefore[0];

                const currStartLine = firstLeading
                    ? firstLeading.loc.start.line
                    : curr.loc.start.line;

                if (currStartLine - prevEndLine >= 2) {
                    continue;
                }

                const insertAfter = tokenAfterPrev?.value === ','
                    ? tokenAfterPrev
                    : prev;

                context.report({
                    node:      curr,
                    messageId: 'expectedBlankLineAroundFunctionProperty',
                    fix:       fixer => fixer.insertTextAfter(insertAfter, '\n')
                });
            }
        };

        return {
            ObjectExpression: checkObjectExpression
        };
    }
} satisfies TSESLint.RuleModule<keyof typeof messages>;
