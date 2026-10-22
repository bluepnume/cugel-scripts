import { RuleTester } from 'eslint';

// eslint-disable-next-line no-restricted-syntax
import { noUnusedLocals } from '../../../src/eslint/rules/no-unused-locals';

import parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
    languageOptions: {

        parser
    }
});

describe('no-unused-locals', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    ruleTester.run('no-unused-locals', noUnusedLocals as any, {
        valid: [
            {
                name: 'named class expression keeps its inner name',
                code: 'export const Made = class Inner {};'
            },
            {
                name: 'unused destructured variable is left for a human',
                code: `declare const source : { a : number, b : number }; const { a, b } = source; export const sum = a;`
            },
            {
                name: 'underscore-prefixed locals are deliberate',
                code: 'const _ignored = 1;'
            },
            {
                name: 'used const',
                code: 'const x = 1; console.log(x);'
            },
            {
                name: 'used function declaration',
                code: 'function foo() { return 1; } foo();'
            },
            {
                name: 'exported const',
                code: 'export const unused = 1;'
            },
            {
                name: 'exported function',
                code: 'export function unused() { return 1; }'
            },
            {
                name: 'export default function',
                code: 'export default function unused() { return 1; }'
            },
            {
                name: 'underscore-prefixed variable',
                code: 'const _unused = 1;'
            },
            {
                name: 'used arrow function',
                code: 'const fn = () => 1; fn();'
            },
            {
                name: 'parameter (not a local declaration)',
                code: 'function foo(x) { return; } foo();'
            },
            {
                name: 'named function expression assigned to used const',
                code: 'const foo = function foo() { return 1; }; foo();'
            },
            {
                name: 'named generator expression assigned to used const',
                code: 'const foo = async function * foo() { yield 1; }; foo();'
            },
            {
                name: 'used enum',
                code: 'enum Foo { A, B } console.log(Foo.A);'
            },
            {
                name: 'used class',
                code: 'class Foo {} new Foo();'
            },
            {
                name: 'used type alias',
                code: 'type Foo = string; const x: Foo = "hi"; console.log(x);'
            },
            {
                name: 'type parameter in generic',
                code: 'const foo = <T, U extends T>(): void => undefined; foo();'
            },
            {
                name: 'used in nested scope',
                code: 'const x = 1; function foo() { return x; } foo();'
            }
        ],
        invalid: [
            {
                name:   'unused const with CRLF line endings removes the whole line',
                code:   'const unused = 1;\r\nexport const kept = 2;\r\n',
                output: 'export const kept = 2;\r\n',
                errors: [ { messageId: 'unusedLocal' as const } ]
            },
            {
                name:   'unused const followed by trailing spaces and a newline',
                code:   'const unused = 1;   \nexport const kept = 2;\n',
                output: 'export const kept = 2;\n',
                errors: [ { messageId: 'unusedLocal' as const } ]
            },
            {
                name:   'unused const',
                code:   'const unused = 1;',
                output: '',
                errors: [ { messageId: 'unusedLocal' as const } ]
            },
            {
                name:   'unused let',
                code:   'let unused = 1;',
                output: '',
                errors: [ { messageId: 'unusedLocal' as const } ]
            },
            {
                name:   'unused type alias',
                code:   'type Foo = string;',
                output: '',
                errors: [ { messageId: 'unusedLocal' as const } ]
            },
            {
                name:   'unused enum',
                code:   'enum Foo { A, B }',
                output: '',
                errors: [ { messageId: 'unusedLocal' as const } ]
            },
            {
                name:   'unused arrow function',
                code:   'const unused = () => 1;',
                output: '',
                errors: [ { messageId: 'unusedLocal' as const } ]
            },
            {
                name:   'unused async arrow function',
                code:   'const unused = async () => { await Promise.resolve(); };',
                output: '',
                errors: [ { messageId: 'unusedLocal' as const } ]
            },
            {
                name:   'unused among used - first declarator',
                code:   'const unused = 1, used = 2; console.log(used);',
                output: 'const used = 2; console.log(used);',
                errors: [ { messageId: 'unusedLocal' as const } ]
            },
            {
                name:   'unused among used - last declarator',
                code:   'const used = 1, unused = 2; console.log(used);',
                output: 'const used = 1; console.log(used);',
                errors: [ { messageId: 'unusedLocal' as const } ]
            },
            {
                name:   'only written, never read',
                code:   'let x = 1; x = 2;',
                output: 'x = 2;',
                errors: [ { messageId: 'unusedLocal' as const } ]
            },
            {
                name:   'unused function declaration',
                code:   'function unused() { return 1; }',
                output: '',
                errors: [ { messageId: 'unusedLocal' as const } ]
            },
            {
                name:   'unused class declaration',
                code:   'class Foo {}',
                output: '',
                errors: [ { messageId: 'unusedLocal' as const } ]
            }
        ]
    });
});
