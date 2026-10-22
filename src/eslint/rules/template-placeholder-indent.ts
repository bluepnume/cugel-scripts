import { assertExists } from './lib';

import type { TSESTree } from '@typescript-eslint/typescript-estree';
import type { TSESLint } from '@typescript-eslint/utils';

const INDENTATION_LEVEL = 4;

const getLineIndent = (line : string) : number => {
    const indentation = line.match(/^\s*/)?.[0].length;

    if (typeof indentation !== 'number') {
        throw new TypeError('Expected to find indentation');
    }

    return indentation;
};

// Mirrors ESLint's internal `astUtils.isTokenOnSameLine`, which is not part
// of its public API.
const isTokenOnSameLine = (left : TSESTree.Token, right : TSESTree.Token) : boolean =>
    left.loc.end.line === right.loc.start.line;

const messages = {
    invalidPlaceholderOpenNewline:      `Expected newline after placeholder opening bracket`,
    invalidPlaceholderCloseNewline:     `Expected newline before placeholder closing bracket`,
    invalidPlaceholderOpenIndentation:  `Invalid indentation for placeholder opening bracket. Expected {{ expectedIndentation }} but found {{ actualIndentation }}.`,
    invalidPlaceholderIndentation:      `Invalid indentation for placeholder value. Expected {{ expectedIndentation }} but found {{ actualIndentation }}.`,
    invalidPlaceholderCloseIndentation: `Invalid indentation for placeholder closing bracket. Expected {{ expectedIndentation }} but found {{ actualIndentation }}.`
} as const;

export const templatePlaceholderIndent = {
    meta: {
        type: 'layout',

        docs: {
            description: 'Require newlines before and after template placeholder values with multiline content'
        },

        fixable: 'whitespace',

        messages,

        schema: []
    },

    create: (context) => {
        const sourceCode = context.sourceCode;
        const lines = sourceCode.getLines();

        const getLineAt = (lineNumber : number) : string => {
            return assertExists(lines[lineNumber - 1]);
        };

        return {
            TemplateLiteral: (templateLiteral) => {
                if (templateLiteral.expressions.length === 0) {
                    return;
                }

                const isMultiLineTemplateLiteral = sourceCode.getText(templateLiteral).includes('\n');

                if (!isMultiLineTemplateLiteral) {
                    return;
                }

                for (const placeholderExpression of templateLiteral.expressions) {
                    const isMultiLineChildExpression = sourceCode.getText(placeholderExpression).includes('\n');

                    const firstPlaceholderExpressionToken = sourceCode.getFirstToken(placeholderExpression);

                    if (!firstPlaceholderExpressionToken) {
                        throw new Error('Expected to find first token');
                    }

                    const placeholderOpeningBraceToken = sourceCode.getTokenBefore(firstPlaceholderExpressionToken);

                    if (!placeholderOpeningBraceToken) {
                        throw new Error('Expected to find opening placeholder token');
                    }

                    const lastPlaceholderExpressionToken = sourceCode.getLastToken(placeholderExpression);

                    if (!lastPlaceholderExpressionToken) {
                        throw new Error('Expected to find last token');
                    }

                    const placeholderClosingBraceToken = sourceCode.getTokenAfter(lastPlaceholderExpressionToken);

                    if (!placeholderClosingBraceToken) {
                        throw new Error('Expected to find closing placeholder token');
                    }

                    const templateStartLine = getLineAt(templateLiteral.loc.start.line);
                    const placeholderStartLine = getLineAt(placeholderOpeningBraceToken.loc.end.line);

                    const templateStartLineIndentation = getLineIndent(templateStartLine);

                    const isPlaceholderOnOpeningLine = (
                        placeholderOpeningBraceToken.loc.end.line === templateLiteral.loc.start.line
                    );

                    const isClosingPlaceholderOnClosingLine = (
                        placeholderClosingBraceToken.loc.start.line === templateLiteral.loc.end.line &&
                        placeholderClosingBraceToken.loc.start.column + 1 === templateLiteral.loc.end.column
                    );

                    const isPlaceholderOnSharedLine = !(/^\s+$/).test(placeholderStartLine.slice(0, placeholderOpeningBraceToken.loc.end.column - 2));

                    const isPlaceholderOpenOnSameLineAsPlaceholderValue = (
                        isTokenOnSameLine(placeholderOpeningBraceToken, firstPlaceholderExpressionToken)
                    );

                    const isPlaceholderCloseOnSameLineAsPlaceholderValue = (
                        isTokenOnSameLine(lastPlaceholderExpressionToken, placeholderClosingBraceToken)
                    );

                    let indentationPriorToPlaceholder : number | undefined;

                    for (
                        let lineNumber = (
                            isPlaceholderOnSharedLine
                                ? placeholderOpeningBraceToken.loc.end.line
                                : placeholderOpeningBraceToken.loc.end.line - 1
                        );
                        lineNumber > templateLiteral.loc.start.line;
                        lineNumber -= 1
                    ) {
                        const line = getLineAt(lineNumber);

                        if (!line.trim()) {
                            continue;
                        }

                        indentationPriorToPlaceholder = getLineIndent(line);
                        break;
                    }

                    let actualPlaceholderOpeningBraceIndent : number | undefined;
                    let expectedPlaceholderOpeningBraceIndent : number | undefined;

                    const actualPlaceholderValueIndent = firstPlaceholderExpressionToken.loc.start.column;
                    const actualPlaceholderClosingBraceIndent = placeholderClosingBraceToken.loc.start.column;

                    let expectedPlaceholderValueIndent : number | undefined;
                    let expectedPlaceholderClosingBraceIndent : number | undefined;

                    if (isPlaceholderOnOpeningLine) {
                        expectedPlaceholderValueIndent = templateStartLineIndentation + INDENTATION_LEVEL;
                    } else if (isPlaceholderOnSharedLine) {
                        expectedPlaceholderValueIndent = getLineIndent(placeholderStartLine) + INDENTATION_LEVEL;
                    } else {
                        actualPlaceholderOpeningBraceIndent = placeholderOpeningBraceToken.loc.end.column - 2;

                        expectedPlaceholderOpeningBraceIndent = (
                            indentationPriorToPlaceholder ??
                            templateStartLineIndentation + INDENTATION_LEVEL
                        );

                        if (isMultiLineChildExpression) {
                            expectedPlaceholderValueIndent = expectedPlaceholderOpeningBraceIndent + INDENTATION_LEVEL;
                        }
                    }

                    if (!isClosingPlaceholderOnClosingLine) {
                        expectedPlaceholderClosingBraceIndent = (
                            indentationPriorToPlaceholder ??
                            templateStartLineIndentation + INDENTATION_LEVEL
                        );
                    }

                    if (
                        isMultiLineChildExpression &&
                        isPlaceholderOpenOnSameLineAsPlaceholderValue
                    ) {
                        context.report({
                            loc: {
                                start: {
                                    line:   placeholderOpeningBraceToken.loc.end.line,
                                    column: placeholderOpeningBraceToken.loc.end.column - 2
                                },
                                end: placeholderOpeningBraceToken.loc.end
                            },
                            messageId: 'invalidPlaceholderOpenNewline',

                            fix: fixer => {
                                return fixer.insertTextAfter(placeholderOpeningBraceToken, '\n');
                            }
                        });
                    } else if (
                        typeof actualPlaceholderOpeningBraceIndent === 'number' &&
                        typeof expectedPlaceholderOpeningBraceIndent === 'number' &&
                        actualPlaceholderOpeningBraceIndent !== expectedPlaceholderOpeningBraceIndent
                    ) {
                        const actualIndentation = actualPlaceholderOpeningBraceIndent;
                        const expectedIndentation = expectedPlaceholderOpeningBraceIndent;

                        context.report({
                            loc: {
                                start: {
                                    line:   placeholderOpeningBraceToken.loc.end.line,
                                    column: placeholderOpeningBraceToken.loc.end.column - 2
                                },
                                end: placeholderOpeningBraceToken.loc.end
                            },
                            messageId: 'invalidPlaceholderOpenIndentation',
                            data:      {
                                actualIndentation,
                                expectedIndentation
                            },

                            fix: fixer => {
                                if (actualIndentation < expectedIndentation) {
                                    return fixer.insertTextBeforeRange(
                                        [
                                            placeholderOpeningBraceToken.range[1] - 2,
                                            placeholderOpeningBraceToken.range[1]
                                        ],
                                        ' '.repeat(expectedIndentation - actualIndentation)
                                    );
                                } else {
                                    return fixer.removeRange([
                                        placeholderOpeningBraceToken.range[1] - 2 - (
                                            actualIndentation - expectedIndentation
                                        ),
                                        placeholderOpeningBraceToken.range[1] - 2
                                    ]);
                                }
                            }
                        });
                    } else if (
                        isMultiLineChildExpression &&
                        typeof expectedPlaceholderValueIndent === 'number' &&
                        actualPlaceholderValueIndent !== expectedPlaceholderValueIndent
                    ) {
                        const actualIndentation = actualPlaceholderValueIndent;
                        const expectedIndentation = expectedPlaceholderValueIndent;

                        context.report({
                            loc:       firstPlaceholderExpressionToken.loc,
                            messageId: 'invalidPlaceholderIndentation',
                            data:      {
                                actualIndentation,
                                expectedIndentation
                            },

                            fix: fixer => {
                                if (actualIndentation < expectedIndentation) {
                                    return fixer.insertTextBefore(
                                        firstPlaceholderExpressionToken,
                                        ' '.repeat(expectedIndentation - actualIndentation)
                                    );
                                } else {
                                    return fixer.removeRange([
                                        firstPlaceholderExpressionToken.range[0] - (
                                            actualIndentation - expectedIndentation
                                        ),
                                        firstPlaceholderExpressionToken.range[0]
                                    ]);
                                }
                            }
                        });
                    }

                    if (
                        isMultiLineChildExpression &&
                        isPlaceholderCloseOnSameLineAsPlaceholderValue
                    ) {
                        context.report({
                            loc: {
                                start: placeholderClosingBraceToken.loc.start,
                                end:   {
                                    line:   placeholderClosingBraceToken.loc.start.line,
                                    column: placeholderClosingBraceToken.loc.start.column + 1
                                }
                            },
                            messageId: 'invalidPlaceholderCloseNewline',

                            fix: fixer => {
                                return fixer.insertTextBefore(placeholderClosingBraceToken, '\n');
                            }
                        });
                    } else if (
                        isMultiLineChildExpression &&
                        typeof expectedPlaceholderClosingBraceIndent === 'number' &&
                        actualPlaceholderClosingBraceIndent !== expectedPlaceholderClosingBraceIndent
                    ) {
                        const actualIndentation = actualPlaceholderClosingBraceIndent;
                        const expectedIndentation = expectedPlaceholderClosingBraceIndent;

                        context.report({
                            loc: {
                                start: placeholderClosingBraceToken.loc.start,
                                end:   {
                                    line:   placeholderClosingBraceToken.loc.start.line,
                                    column: placeholderClosingBraceToken.loc.start.column + 1
                                }
                            },
                            messageId: 'invalidPlaceholderCloseIndentation',
                            data:      {
                                actualIndentation,
                                expectedIndentation
                            },

                            fix: fixer => {
                                if (actualIndentation < expectedIndentation) {
                                    return fixer.insertTextBefore(
                                        placeholderClosingBraceToken,
                                        ' '.repeat(expectedIndentation - actualIndentation)
                                    );
                                } else {
                                    return fixer.removeRange([
                                        placeholderClosingBraceToken.range[0] - (
                                            actualIndentation - expectedIndentation
                                        ),
                                        placeholderClosingBraceToken.range[0]
                                    ]);
                                }
                            }
                        });
                    }
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<keyof typeof messages>;
