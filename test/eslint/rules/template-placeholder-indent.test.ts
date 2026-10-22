/* eslint-disable no-template-curly-in-string -- test inputs contain literal placeholders */
import { RuleTester } from 'eslint';

import { templatePlaceholderIndent } from '../../../src';

import parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
    languageOptions: {
        parser,
        parserOptions: { ecmaVersion: 2022, sourceType: 'module' }
    }
});

const lines = (...parts : ReadonlyArray<string>) : string => parts.join('\n');

describe('template-placeholder-indent', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    ruleTester.run('template-placeholder-indent', templatePlaceholderIndent as any, {
        valid: [
            {
                name: 'single-line template literal',
                code: 'const s = `a ${ [ 1 ].map(x => x).join(\'\') } b`;'
            },
            {
                name: 'multiline template with single-line placeholders',
                code: lines(
                    'const s = `',
                    '    a ${ x }',
                    '    ${ y }',
                    '`;'
                )
            },
            {
                name: 'template with no placeholders',
                code: lines(
                    'const s = `',
                    '    plain',
                    '`;'
                )
            },
            {
                name: 'multiline placeholder on its own line, correctly indented',
                code: lines(
                    'const s = `',
                    '    a',
                    '    ${',
                    '        [ 1 ].map(x => {',
                    '            return x;',
                    '        }).join(\'\')',
                    '    }',
                    '`;'
                )
            },
            {
                name: 'blank lines before the placeholder are skipped when finding the prior indent',
                code: lines(
                    'const s = `',
                    '    a',
                    '',
                    '    ${',
                    '        [ 1 ].map(x => {',
                    '            return x;',
                    '        }).join(\'\')',
                    '    }',
                    '`;'
                )
            },
            {
                name: 'multiline placeholder opening on the template start line',
                code: lines(
                    'const s = `${',
                    '    [ 1 ].map(x => {',
                    '        return x;',
                    '    }).join(\'\')',
                    '    }`;'
                )
            },
            {
                name: 'multiline placeholder sharing a line with text',
                code: lines(
                    'const s = `',
                    '    foo ${',
                    '        [ 1 ].map(x => {',
                    '            return x;',
                    '        }).join(\'\')',
                    '    }',
                    '`;'
                )
            },
            {
                name: 'first placeholder with no content line before it falls back to template indent',
                code: lines(
                    '    const s = `',
                    '        ${',
                    '            [ 1 ].map(x => {',
                    '                return x;',
                    '            }).join(\'\')',
                    '        }',
                    '    `;'
                )
            }
        ],

        invalid: [
            {
                name: 'multiline placeholder value starts and ends on the brace lines',
                code: lines(
                    'const s = `',
                    '    a',
                    '    ${[ 1 ].map(x => {',
                    '        return x;',
                    '    }).join(\'\')}',
                    '`;'
                ),
                output: lines(
                    'const s = `',
                    '    a',
                    '    ${',
                    '[ 1 ].map(x => {',
                    '        return x;',
                    '    }).join(\'\')',
                    '}',
                    '`;'
                ),
                errors: [
                    { messageId: 'invalidPlaceholderOpenNewline' },
                    { messageId: 'invalidPlaceholderCloseNewline' }
                ]
            },
            {
                name: 'opening brace under-indented',
                code: lines(
                    'const s = `',
                    '    a',
                    '  ${',
                    '        [ 1 ].map(x => {',
                    '            return x;',
                    '        }).join(\'\')',
                    '    }',
                    '`;'
                ),
                output: lines(
                    'const s = `',
                    '    a',
                    '    ${',
                    '        [ 1 ].map(x => {',
                    '            return x;',
                    '        }).join(\'\')',
                    '    }',
                    '`;'
                ),
                errors: [
                    { messageId: `invalidPlaceholderOpenIndentation`, data: { actualIndentation: 2, expectedIndentation: 4 } }
                ]
            },
            {
                name: 'opening brace over-indented',
                code: lines(
                    'const s = `',
                    '    a',
                    '        ${',
                    '        [ 1 ].map(x => {',
                    '            return x;',
                    '        }).join(\'\')',
                    '    }',
                    '`;'
                ),
                output: lines(
                    'const s = `',
                    '    a',
                    '    ${',
                    '        [ 1 ].map(x => {',
                    '            return x;',
                    '        }).join(\'\')',
                    '    }',
                    '`;'
                ),
                errors: [
                    { messageId: `invalidPlaceholderOpenIndentation`, data: { actualIndentation: 8, expectedIndentation: 4 } }
                ]
            },
            {
                name: 'single-line placeholder on its own line with a wrong brace indent',
                code: lines(
                    'const s = `',
                    '    a',
                    '  ${ x }',
                    '`;'
                ),
                output: lines(
                    'const s = `',
                    '    a',
                    '    ${ x }',
                    '`;'
                ),
                errors: [
                    { messageId: `invalidPlaceholderOpenIndentation`, data: { actualIndentation: 2, expectedIndentation: 4 } }
                ]
            },
            {
                name: 'placeholder value under-indented',
                code: lines(
                    'const s = `',
                    '    a',
                    '    ${',
                    '    [ 1 ].map(x => {',
                    '        return x;',
                    '    }).join(\'\')',
                    '    }',
                    '`;'
                ),
                output: lines(
                    'const s = `',
                    '    a',
                    '    ${',
                    '        [ 1 ].map(x => {',
                    '        return x;',
                    '    }).join(\'\')',
                    '    }',
                    '`;'
                ),
                errors: [
                    { messageId: `invalidPlaceholderIndentation`, data: { actualIndentation: 4, expectedIndentation: 8 } }
                ]
            },
            {
                name: 'placeholder value over-indented',
                code: lines(
                    'const s = `',
                    '    a',
                    '    ${',
                    '            [ 1 ].map(x => {',
                    '            return x;',
                    '        }).join(\'\')',
                    '    }',
                    '`;'
                ),
                output: lines(
                    'const s = `',
                    '    a',
                    '    ${',
                    '        [ 1 ].map(x => {',
                    '            return x;',
                    '        }).join(\'\')',
                    '    }',
                    '`;'
                ),
                errors: [
                    { messageId: `invalidPlaceholderIndentation`, data: { actualIndentation: 12, expectedIndentation: 8 } }
                ]
            },
            {
                name: 'closing brace under-indented',
                code: lines(
                    'const s = `',
                    '    a',
                    '    ${',
                    '        [ 1 ].map(x => {',
                    '            return x;',
                    '        }).join(\'\')',
                    '}',
                    '`;'
                ),
                output: lines(
                    'const s = `',
                    '    a',
                    '    ${',
                    '        [ 1 ].map(x => {',
                    '            return x;',
                    '        }).join(\'\')',
                    '    }',
                    '`;'
                ),
                errors: [
                    { messageId: `invalidPlaceholderCloseIndentation`, data: { actualIndentation: 0, expectedIndentation: 4 } }
                ]
            },
            {
                name: 'closing brace over-indented',
                code: lines(
                    'const s = `',
                    '    a',
                    '    ${',
                    '        [ 1 ].map(x => {',
                    '            return x;',
                    '        }).join(\'\')',
                    '        }',
                    '`;'
                ),
                output: lines(
                    'const s = `',
                    '    a',
                    '    ${',
                    '        [ 1 ].map(x => {',
                    '            return x;',
                    '        }).join(\'\')',
                    '    }',
                    '`;'
                ),
                errors: [
                    { messageId: `invalidPlaceholderCloseIndentation`, data: { actualIndentation: 8, expectedIndentation: 4 } }
                ]
            },
            {
                name: 'shared-line placeholder with a mis-indented value',
                code: lines(
                    'const s = `',
                    '    foo ${',
                    '    [ 1 ].map(x => {',
                    '        return x;',
                    '    }).join(\'\')',
                    '    }',
                    '`;'
                ),
                output: lines(
                    'const s = `',
                    '    foo ${',
                    '        [ 1 ].map(x => {',
                    '        return x;',
                    '    }).join(\'\')',
                    '    }',
                    '`;'
                ),
                errors: [
                    { messageId: `invalidPlaceholderIndentation`, data: { actualIndentation: 4, expectedIndentation: 8 } }
                ]
            },
            {
                name: 'placeholder opening on the template start line with a mis-indented value',
                code: lines(
                    'const s = `${',
                    '[ 1 ].map(x => {',
                    '    return x;',
                    '}).join(\'\')',
                    '    }`;'
                ),
                output: lines(
                    'const s = `${',
                    '    [ 1 ].map(x => {',
                    '    return x;',
                    '}).join(\'\')',
                    '    }`;'
                ),
                errors: [
                    { messageId: `invalidPlaceholderIndentation`, data: { actualIndentation: 0, expectedIndentation: 4 } }
                ]
            }
        ]
    });
});

/* eslint-enable no-template-curly-in-string */
