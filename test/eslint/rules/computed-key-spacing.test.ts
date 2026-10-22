import { RuleTester } from 'eslint';

// eslint-disable-next-line no-restricted-syntax
import { computedKeySpacing } from '../../../src/eslint/rules/computed-key-spacing';

import parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
    languageOptions: {

        parser,
        parserOptions: { jsx: true }
    }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
ruleTester.run('computed-key-spacing', computedKeySpacing as any, {
    valid: [
        {
            name: 'computed key with spaces',
            code: `const x = { [ foo ]: 1 };`
        },
        {
            name: 'computed key with expression and spaces',
            code: `const x = { [ 'a' + 'b' ]: 1 };`
        },
        {
            name: 'static key (not computed)',
            code: `const x = { foo: 1 };`
        },
        {
            name: 'computed member access (not object key)',
            code: `const x = obj[foo];`
        },
        {
            name: 'computed destructuring (not object literal)',
            code: `const { [key]: val } = obj;`
        },
        {
            name: 'array literal with no spaces (not object key)',
            code: `const x = [1, 2, 3];`
        },
        {
            name: 'computed key in type with spaces',
            code: `type X = { [ K in keyof T ]: T[K] };`
        },
        {
            name: 'computed key in type with enum value and spaces',
            code: `type X = { [ FOO.BAR ]: string };`
        }
    ],

    invalid: [
        {
            name:   'missing both spaces',
            code:   `const x = { [foo]: 1 };`,
            output: `const x = { [ foo ]: 1 };`,
            errors: [
                { messageId: 'missingSpaceAfterOpen' as const },
                { messageId: 'missingSpaceBeforeClose' as const }
            ]
        },
        {
            name:   'missing space after open bracket',
            code:   `const x = { [foo ]: 1 };`,
            output: `const x = { [ foo ]: 1 };`,
            errors: [
                { messageId: 'missingSpaceAfterOpen' as const }
            ]
        },
        {
            name:   'missing space before close bracket',
            code:   `const x = { [ foo]: 1 };`,
            output: `const x = { [ foo ]: 1 };`,
            errors: [
                { messageId: 'missingSpaceBeforeClose' as const }
            ]
        },
        {
            name:   'computed method key missing spaces',
            code:   `const x = { [foo]() {} };`,
            output: `const x = { [ foo ]() {} };`,
            errors: [
                { messageId: 'missingSpaceAfterOpen' as const },
                { messageId: 'missingSpaceBeforeClose' as const }
            ]
        },
        {
            name:   'expression key missing spaces',
            code:   `const x = { ['a' + 'b']: 1 };`,
            output: `const x = { [ 'a' + 'b' ]: 1 };`,
            errors: [
                { messageId: 'missingSpaceAfterOpen' as const },
                { messageId: 'missingSpaceBeforeClose' as const }
            ]
        },
        {
            name:   'type computed key missing both spaces',
            code:   `type X = { [FOO.BAR]: string };`,
            output: `type X = { [ FOO.BAR ]: string };`,
            errors: [
                { messageId: 'missingSpaceAfterOpen' as const },
                { messageId: 'missingSpaceBeforeClose' as const }
            ]
        },
        {
            name:   'type computed key missing space after open',
            code:   `type X = { [FOO.BAR ]: string };`,
            output: `type X = { [ FOO.BAR ]: string };`,
            errors: [
                { messageId: 'missingSpaceAfterOpen' as const }
            ]
        },
        {
            name:   'type computed key missing space before close',
            code:   `type X = { [ FOO.BAR]: string };`,
            output: `type X = { [ FOO.BAR ]: string };`,
            errors: [
                { messageId: 'missingSpaceBeforeClose' as const }
            ]
        },
        {
            name:   'extra spaces after open bracket',
            code:   `const x = { [  foo ]: 1 };`,
            output: `const x = { [ foo ]: 1 };`,
            errors: [
                { messageId: 'extraSpaceAfterOpen' as const }
            ]
        },
        {
            name:   'extra spaces before close bracket',
            code:   `const x = { [ foo  ]: 1 };`,
            output: `const x = { [ foo ]: 1 };`,
            errors: [
                { messageId: 'extraSpaceBeforeClose' as const }
            ]
        },
        {
            name:   'extra spaces on both sides',
            code:   `const x = { [  foo  ]: 1 };`,
            output: `const x = { [ foo ]: 1 };`,
            errors: [
                { messageId: 'extraSpaceAfterOpen' as const },
                { messageId: 'extraSpaceBeforeClose' as const }
            ]
        },
        {
            name:   'type computed key extra spaces on both sides',
            code:   `type X = { [  FOO.BAR  ]: string };`,
            output: `type X = { [ FOO.BAR ]: string };`,
            errors: [
                { messageId: 'extraSpaceAfterOpen' as const },
                { messageId: 'extraSpaceBeforeClose' as const }
            ]
        }
    ]
});
