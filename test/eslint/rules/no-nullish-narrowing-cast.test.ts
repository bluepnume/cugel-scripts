import { RuleTester } from 'eslint';
import { resolve } from 'node:path';

// eslint-disable-next-line no-restricted-syntax
import { noNullishNarrowingCast } from '../../../src/eslint/rules/no-nullish-narrowing-cast';

import parser from '@typescript-eslint/parser';

const tsconfigRootDir = resolve(import.meta.dirname, '../../..');
const filename = resolve(tsconfigRootDir, 'rule-under-test.ts');

const ruleTester = new RuleTester({
    languageOptions: {

        parser,

        parserOptions: {
            // A default project (one file plus the libs) is the supported way
            // to type-check RuleTester snippets, and behaves the same on
            // every platform, unlike substituting a real project file.
            projectService: {
                allowDefaultProject: [ '*.ts' ],
                defaultProject:      'tsconfig.json'
            },
            tsconfigRootDir
        }
    }
});

describe('no-nullish-narrowing-cast', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    ruleTester.run('no-nullish-narrowing-cast', noNullishNarrowingCast as any, {
        valid: [
            {
                name: 'cast to unknown subsumes nullish',
                filename,
                code: `declare const foo : number | null | undefined; const bar = foo as unknown;`
            },
            {
                name: 'cast to any subsumes nullish',
                filename,
                code: `declare const foo : number | undefined; const bar = foo as any;`
            },
            {
                name: 'cast between non-nullable unions',
                filename,
                code: `declare const foo : number | string; const bar = foo as number | string | boolean;`
            },
            {
                name: 'cast that adds undefined to the type',
                filename,
                code: `const foo = 5 as number | undefined;`
            },
            {
                name: 'cast that preserves undefined',
                filename,
                code: `declare const foo : number | undefined; const bar = foo as number | undefined;`
            },
            {
                name: 'cast that preserves null',
                filename,
                code: `declare const foo : number | null; const bar = foo as number | null;`
            },
            {
                name: 'cast to a wider nullable type',
                filename,
                code: `declare const foo : number | undefined; const bar = foo as string | number | undefined;`
            },
            {
                name: 'cast unrelated to nullishness',
                filename,
                code: `declare const foo : string; const bar = foo as 'open' | 'closed';`
            },
            {
                name: 'cast from unknown to a non-nullable type',
                filename,
                code: `declare const foo : unknown; const bar = foo as number;`
            },
            {
                name: 'cast from any to a non-nullable type',
                filename,
                code: `declare const foo : any; const bar = foo as number;`
            },
            {
                name: 'cast nullable value to unknown',
                filename,
                code: `declare const foo : number | undefined; const bar = foo as unknown;`
            },
            {
                name: 'cast nullable value to any',
                filename,
                code: `declare const foo : number | null; const bar = foo as any;`
            },
            {
                name: 'as const on a literal',
                filename,
                code: `const bar = 'hello' as const;`
            },
            {
                name: 'cast a non-nullable value to a non-nullable type',
                filename,
                code: `declare const foo : number; const bar = foo as 5;`
            },
            {
                name: 'cast that keeps null but removes a non-nullish member',
                filename,
                code: `declare const foo : number | string | null; const bar = foo as number | null;`
            }
        ],

        invalid: [
            {
                name:   'cast removes undefined from a wide union',
                filename,
                code:   `declare const foo : number | string | boolean | undefined; const bar = foo as number | string | boolean;`,
                errors: [ { messageId: 'removesNullish' as const, data: { removed: 'undefined' } } ]
            },
            {
                name:   'cast removes undefined (the canonical case)',
                filename,
                code:   `declare const foo : number | undefined; const bar = foo as number;`,
                errors: [ { messageId: 'removesNullish' as const, data: { removed: 'undefined' } } ]
            },
            {
                name:   'cast removes null',
                filename,
                code:   `declare const foo : number | null; const bar = foo as number;`,
                errors: [ { messageId: 'removesNullish' as const, data: { removed: 'null' } } ]
            },
            {
                name:   'cast removes both null and undefined',
                filename,
                code:   `declare const foo : number | null | undefined; const bar = foo as number;`,
                errors: [ { messageId: 'removesNullish' as const, data: { removed: 'null | undefined' } } ]
            },
            {
                name:   'cast removes undefined but keeps null',
                filename,
                code:   `declare const foo : number | null | undefined; const bar = foo as number | null;`,
                errors: [ { messageId: 'removesNullish' as const, data: { removed: 'undefined' } } ]
            },
            {
                name:   'cast removes null but keeps undefined',
                filename,
                code:   `declare const foo : number | null | undefined; const bar = foo as number | undefined;`,
                errors: [ { messageId: 'removesNullish' as const, data: { removed: 'null' } } ]
            },
            {
                name:   'cast removes undefined from a string type',
                filename,
                code:   `declare const foo : string | undefined; const bar = foo as string;`,
                errors: [ { messageId: 'removesNullish' as const, data: { removed: 'undefined' } } ]
            },
            {
                name:   'cast removes undefined from an object type',
                filename,
                code:   `declare const foo : { x : number } | undefined; const bar = foo as { x : number };`,
                errors: [ { messageId: 'removesNullish' as const, data: { removed: 'undefined' } } ]
            },
            {
                name:   'cast removes undefined from a call expression result',
                filename,
                code:   `declare const fn : () => number | undefined; const bar = fn() as number;`,
                errors: [ { messageId: 'removesNullish' as const, data: { removed: 'undefined' } } ]
            },
            {
                name:   'angle-bracket-style cast also flagged',
                filename,
                code:   `declare const foo : number | undefined; const bar = <number>foo;`,
                errors: [ { messageId: 'removesNullish' as const, data: { removed: 'undefined' } } ]
            },
            {
                name:   'cast a property access that is optional',
                filename,
                code:   `declare const foo : { x ? : number }; const bar = foo.x as number;`,
                errors: [ { messageId: 'removesNullish' as const, data: { removed: 'undefined' } } ]
            },
            {
                name:   'cast removes undefined while changing the non-nullish constituent',
                filename,
                code:   `declare const foo : number | undefined; const bar = foo as string;`,
                errors: [ { messageId: 'removesNullish' as const, data: { removed: 'undefined' } } ]
            }
        ]
    });
});
