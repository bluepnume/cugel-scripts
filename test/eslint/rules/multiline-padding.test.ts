import { RuleTester } from 'eslint';

// eslint-disable-next-line no-restricted-syntax
import { multilinePadding } from '../../../src/eslint/rules/multiline-padding';

import parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
    languageOptions: {

        parser,
        parserOptions: { jsx: true }
    }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
ruleTester.run('multiline-padding', multilinePadding as any, {
    valid: [
        {
            name: 'spread followed by a padded multiline function',

            code: `
                const base = {};
                const x = {
                    ...base,

                    handler: () => {
                        return 1;
                    }
                };
            `
        },
        {
            name: 'all single-line properties',
            code: `const x = { a: 1, b: 2, c: 3 };`
        },
        {
            name: 'two multiline non-function properties may be tight',
            code: `
                const x = {
                    a: {
                        nested: 1
                    },
                    b: {
                        nested: 2
                    }
                };
            `
        },
        {
            name: 'function property surrounded by blank lines',
            code: `
                const x = {
                    a: 1,

                    handler: () => {
                        return 1;
                    },

                    b: 2
                };
            `
        },
        {
            name: 'two function properties separated by blank line',
            code: `
                const x = {
                    handler: () => {
                        return 1;
                    },

                    config: () => {
                        return 2;
                    }
                };
            `
        },
        {
            name: 'single-line function property may be tight',
            code: `const x = { a: 1, handler: () => 1, b: 2 };`
        },
        {
            name: 'function property at start of object',
            code: `
                const x = {
                    handler: () => {
                        return 1;
                    },

                    a: 1
                };
            `
        },
        {
            name: 'function property at end of object',
            code: `
                const x = {
                    a: 1,

                    handler: () => {
                        return 1;
                    }
                };
            `
        },
        {
            name: 'method shorthand surrounded by blanks',
            code: `
                const x = {
                    a: 1,

                    handler() {
                        return 1;
                    },

                    b: 2
                };
            `
        },
        {
            name: 'empty object',
            code: `const x = {};`
        }
    ],

    invalid: [
        {
            name: 'spread directly followed by a multiline function',

            code: `
                const base = {};
                const x = {
                    ...base,
                    handler: () => {
                        return 1;
                    }
                };
            `,

            output: `
                const base = {};
                const x = {
                    ...base,

                    handler: () => {
                        return 1;
                    }
                };
            `,

            errors: [
                { messageId: 'expectedBlankLineAroundFunctionProperty' as const }
            ]
        },
        {
            name: 'multiline arrow function followed by single-line prop',

            code: `
                const x = {
                    handler: () => {
                        return 1;
                    },
                    b: 2
                };
            `,

            output: `
                const x = {
                    handler: () => {
                        return 1;
                    },

                    b: 2
                };
            `,

            errors: [
                { messageId: 'expectedBlankLineAroundFunctionProperty' as const }
            ]
        },
        {
            name: 'single-line prop followed by multiline arrow function',

            code: `
                const x = {
                    a: 1,
                    handler: () => {
                        return 1;
                    }
                };
            `,

            output: `
                const x = {
                    a: 1,

                    handler: () => {
                        return 1;
                    }
                };
            `,

            errors: [
                { messageId: 'expectedBlankLineAroundFunctionProperty' as const }
            ]
        },
        {
            name: 'multiline function followed by multiline object value',

            code: `
                const x = {
                    handler: () => {
                        return 1;
                    },
                    config: {
                        enabled: true
                    }
                };
            `,

            output: `
                const x = {
                    handler: () => {
                        return 1;
                    },

                    config: {
                        enabled: true
                    }
                };
            `,

            errors: [
                { messageId: 'expectedBlankLineAroundFunctionProperty' as const }
            ]
        },
        {
            name: 'method shorthand without blank line before',

            code: `
                const x = {
                    a: 1,
                    handler() {
                        return 1;
                    }
                };
            `,

            output: `
                const x = {
                    a: 1,

                    handler() {
                        return 1;
                    }
                };
            `,

            errors: [
                { messageId: 'expectedBlankLineAroundFunctionProperty' as const }
            ]
        },
        {
            name: 'function expression value without blank line',

            code: `
                const x = {
                    a: 1,
                    handler: function () {
                        return 1;
                    }
                };
            `,

            output: `
                const x = {
                    a: 1,

                    handler: function () {
                        return 1;
                    }
                };
            `,

            errors: [
                { messageId: 'expectedBlankLineAroundFunctionProperty' as const }
            ]
        }
    ]
});
