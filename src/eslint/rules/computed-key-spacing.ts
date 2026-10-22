import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

const messages = {
    missingSpaceAfterOpen:   'Expected space after `[` in computed property key.',
    missingSpaceBeforeClose: 'Expected space before `]` in computed property key.',
    extraSpaceAfterOpen:     'Expected exactly one space after `[` in computed property key.',
    extraSpaceBeforeClose:   'Expected exactly one space before `]` in computed property key.'
} as const;

type CheckableNode =
    | TSESTree.Property
    | TSESTree.MethodDefinition
    | TSESTree.TSPropertySignature
    | TSESTree.TSMethodSignature;

const isComputedKey = (node : CheckableNode) : boolean => {
    return node.computed && (node.parent.type === 'ObjectExpression' || node.parent.type === 'TSTypeLiteral');
};

export const computedKeySpacing = {
    meta: {
        type: 'layout',

        docs: {
            description: 'Enforce spaces inside brackets of computed keys in object literals and type literals'
        },

        fixable: 'whitespace',

        messages,

        schema: []
    },

    create: (context) => {
        const check = (node : CheckableNode) : void => {
            if (!isComputedKey(node)) {
                return;
            }

            const sourceCode = context.sourceCode;
            const key = node.key;

            const openBracket = sourceCode.getTokenBefore(key);
            const closeBracket = sourceCode.getTokenAfter(key);

            if (!openBracket || !closeBracket || openBracket.value !== '[' || closeBracket.value !== ']') {
                return;
            }

            const firstToken = sourceCode.getTokenAfter(openBracket);
            const lastToken = sourceCode.getTokenBefore(closeBracket);

            if (!firstToken || !lastToken) {
                return;
            }

            const spaceAfterOpen = firstToken.range[0] - openBracket.range[1];
            const spaceBeforeClose = closeBracket.range[0] - lastToken.range[1];

            if (spaceAfterOpen === 0) {
                context.report({
                    node,
                    messageId: 'missingSpaceAfterOpen',
                    loc:       openBracket.loc,
                    fix:       fixer => fixer.insertTextAfter(openBracket, ' ')
                });
            } else if (spaceAfterOpen > 1) {
                context.report({
                    node,
                    messageId: 'extraSpaceAfterOpen',
                    loc:       openBracket.loc,
                    fix:       fixer => fixer.replaceTextRange([ openBracket.range[1], firstToken.range[0] ], ' ')
                });
            }

            if (spaceBeforeClose === 0) {
                context.report({
                    node,
                    messageId: 'missingSpaceBeforeClose',
                    loc:       closeBracket.loc,
                    fix:       fixer => fixer.insertTextBefore(closeBracket, ' ')
                });
            } else if (spaceBeforeClose > 1) {
                context.report({
                    node,
                    messageId: 'extraSpaceBeforeClose',
                    loc:       closeBracket.loc,
                    fix:       fixer => fixer.replaceTextRange([ lastToken.range[1], closeBracket.range[0] ], ' ')
                });
            }
        };

        return {
            Property:            check,
            MethodDefinition:    check,
            TSPropertySignature: check,
            TSMethodSignature:   check
        };
    }
} satisfies TSESLint.RuleModule<keyof typeof messages>;
