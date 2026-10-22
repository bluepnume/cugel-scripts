import { RuleTester } from 'eslint';

import { noTopLevelAwait } from '../../../src';

import parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
    languageOptions: {
        parser,
        parserOptions: { ecmaVersion: 2022, sourceType: 'module' }
    }
});

describe('no-top-level-await', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    ruleTester.run('no-top-level-await', noTopLevelAwait as any, {
        valid: [
            {
                name: 'await inside an async arrow function',
                code: 'const run = async () => { await Promise.resolve(); };'
            },
            {
                name: 'await inside an async function declaration',
                code: 'async function run() { await Promise.resolve(); }'
            },
            {
                name: 'await inside an async function expression',
                code: 'const run = async function () { await Promise.resolve(); };'
            },
            {
                name: 'await nested in a block inside a function',
                code: 'const run = async () => { if (true) { for (const x of [ 1 ]) { await Promise.resolve(x); } } };'
            },
            {
                name: 'await inside an async method',
                code: 'const obj = { async run() { await Promise.resolve(); } };'
            },
            {
                name: 'no await at all',
                code: 'const value = Promise.resolve();'
            }
        ],

        invalid: [
            {
                name:   'bare top-level await statement',
                code:   'await Promise.resolve();',
                errors: [ { messageId: 'topLevelAwaitNotAllowed' } ]
            },
            {
                name:   'top-level await in a declaration',
                code:   'const value = await Promise.resolve(1);',
                errors: [ { messageId: 'topLevelAwaitNotAllowed' } ]
            },
            {
                name:   'top-level await inside a block',
                code:   'if (true) { await Promise.resolve(); }',
                errors: [ { messageId: 'topLevelAwaitNotAllowed' } ]
            },
            {
                name:   'top-level await inside a loop',
                code:   'for (const x of [ 1 ]) { await Promise.resolve(x); }',
                errors: [ { messageId: 'topLevelAwaitNotAllowed' } ]
            },
            {
                name:   'top-level await inside a try block',
                code:   'try { await Promise.resolve(); } catch {}',
                errors: [ { messageId: 'topLevelAwaitNotAllowed' } ]
            },
            {
                name:   'two top-level awaits report twice',
                code:   'await a(); await b();',
                errors: [ { messageId: 'topLevelAwaitNotAllowed' }, { messageId: 'topLevelAwaitNotAllowed' } ]
            }
        ]
    });
});
