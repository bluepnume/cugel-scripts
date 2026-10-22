import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

// Matches the project's @stylistic/max-len `code` setting in eslint.config.ts.
const MAX_LEN = 120;

const messages = {
    convertStringToTemplate:
        `Line exceeds max length — convert this string to a template literal (backticks) so the line is exempt from max-len.`
} as const;

// Re-encode the parsed string value as the body of a template literal:
//   - escape backslashes first so subsequent escapes don't double-escape
//   - escape backticks (would otherwise close the template)
//   - escape `${` (would otherwise start an interpolation)
const encodeForTemplateLiteral = (value : string) : string => {
    return value
        .replaceAll('\\', `\\\\`)
        .replaceAll('`', `\\\``)
        .replaceAll('${', `\\\${`);
};

const isSkippableParent = (node : TSESTree.Literal) : boolean => {
    const parent = node.parent;

    // Import / export source strings must be plain string literals.
    if (
        parent.type === 'ImportDeclaration' ||
        parent.type === 'ExportAllDeclaration' ||
        parent.type === 'ExportNamedDeclaration' ||
        parent.type === 'ImportExpression'
    ) {
        return true;
    }

    // Object/class property keys can't be plain template literals
    // (they would need to become computed keys, a larger structural change).
    if (
        (
            parent.type === 'Property' ||
            parent.type === 'PropertyDefinition' ||
            parent.type === 'MethodDefinition' ||
            parent.type === 'TSPropertySignature' ||
            parent.type === 'TSMethodSignature'
        ) &&
        parent.key === node
    ) {
        return true;
    }

    // JSX attribute values can't be replaced 1:1 — `attr='foo'`
    // would have to become `attr={`foo`}`.
    if (parent.type === 'JSXAttribute') {
        return true;
    }

    // String literals used as TS literal types (`type X = 'foo'`) — different
    // syntactic form, leave them alone.
    if (parent.type === 'TSLiteralType') {
        return true;
    }

    return false;
};

export const preferTemplateOnLongLines = {
    meta: {
        type: 'layout',

        docs: {
            description:
                `On lines longer than max-len, convert string literals to template literals so the line is exempt from the max-len rule.`
        },

        fixable: 'code',

        messages,

        schema: []
    },

    create: (context) => {
        const sourceCode = context.sourceCode;
        const lines = sourceCode.lines;

        // Lines that already contain at least one template literal are exempt
        // from max-len via the @stylistic/max-len `ignoreTemplateLiterals`
        // option, so we should not re-encode strings on those lines.
        const linesWithTemplateLiteral = new Set<number>();
        const candidates : Array<{ node : TSESTree.Literal, value : string }> = [];

        return {
            'TemplateLiteral': (node : TSESTree.TemplateLiteral) => {
                for (let line = node.loc.start.line; line <= node.loc.end.line; line++) {
                    linesWithTemplateLiteral.add(line);
                }
            },

            'Literal': (node : TSESTree.Literal) => {
                if (typeof node.value !== 'string') {
                    return;
                }

                if (node.loc.start.line !== node.loc.end.line) {
                    return;
                }

                if (isSkippableParent(node)) {
                    return;
                }

                const lineIndex = node.loc.start.line - 1;
                const lineText = lines[lineIndex];

                if (!lineText || lineText.length <= MAX_LEN) {
                    return;
                }

                candidates.push({ node, value: node.value });
            },

            'Program:exit': () => {
                for (const { node, value } of candidates) {
                    if (linesWithTemplateLiteral.has(node.loc.start.line)) {
                        continue;
                    }

                    context.report({
                        node,
                        messageId: 'convertStringToTemplate',

                        fix: fixer => {
                            const encoded = encodeForTemplateLiteral(value);

                            return fixer.replaceText(node, `\`${ encoded }\``);
                        }
                    });
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<keyof typeof messages>;
