import { RuleTester } from 'eslint';
import { resolve } from 'node:path';

// eslint-disable-next-line no-restricted-syntax
import { noBrandedPrimitiveCast } from '../../../src/eslint/rules/no-branded-primitive-cast';

import parser from '@typescript-eslint/parser';

const tsconfigRootDir = resolve(import.meta.dirname, '../../..');

// RuleTester lints a virtual file; it sits outside tsconfig's include so the
// default project picks it up.
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

// Inline brand definitions so the tests don't depend on the project's domain types
// being stable. `Tagged`-style is `Primitive & { brand }`; `Opaque`-style is
// the same intersection pattern with a different shaped brand object.
const PRELUDE = `
    type Tagged<T, N extends string> = T & { readonly __tag : N };
    type Opaque<N, T> = T & { readonly __TYPE__ : N };
    type Cents = Tagged<number, 'Cents'>;
    type UUID = Tagged<\`\${ string }-\${ string }\`, 'UUID'>;
    type StripeID = Opaque<'StripeID', string>;
    type Email = \`\${ string }@\${ string }.\${ string }\`;
    type PlainAlias = string;
    type Status = 'open' | 'closed';
`;

describe('no-branded-primitive-cast', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    ruleTester.run('no-branded-primitive-cast', noBrandedPrimitiveCast as any, {
        valid: [
            {
                name: 'numeric literal cast to branded number',
                filename,
                code: `${ PRELUDE } const x = 0 as Cents;`
            },
            {
                name: 'negative numeric literal cast to branded number',
                filename,
                code: `${ PRELUDE } const x = -1 as Cents;`
            },
            {
                name: 'string literal cast to branded string',
                filename,
                code: `${ PRELUDE } const x = 'abc-def' as UUID;`
            },
            {
                name: 'template literal with no expressions cast to branded string',
                filename,
                code: `${ PRELUDE } const x = \`abc-def\` as UUID;`
            },
            {
                name: 'chained as const cast to branded type',
                filename,
                code: `${ PRELUDE } const x = (0 as const) as Cents;`
            },
            {
                name: 'cast to plain string (not branded)',
                filename,
                code: `declare const y : unknown; const x = y as string;`
            },
            {
                name: 'cast to plain number (not branded)',
                filename,
                code: `declare const y : unknown; const x = y as number;`
            },
            {
                name: 'cast to a plain type alias of string',
                filename,
                code: `${ PRELUDE } declare const y : unknown; const x = y as PlainAlias;`
            },
            {
                name: 'cast to string literal union (not a branded primitive)',
                filename,
                code: `${ PRELUDE } declare const y : unknown; const x = y as Status;`
            },
            {
                name: 'cast to an object type',
                filename,
                code: `declare const y : unknown; const x = y as { foo : number };`
            },
            {
                name: 'cast to any',
                filename,
                code: `declare const y : unknown; const x = y as any;`
            }
        ],

        invalid: [
            {
                name:   'variable cast to Tagged number brand',
                filename,
                code:   `${ PRELUDE } declare const v : number; const x = v as Cents;`,
                errors: [ { messageId: 'nonLiteralBrandedCast' as const } ]
            },
            {
                name:   'variable cast to Tagged template-literal brand',
                filename,
                code:   `${ PRELUDE } declare const v : string; const x = v as UUID;`,
                errors: [ { messageId: 'nonLiteralBrandedCast' as const } ]
            },
            {
                name:   'variable cast to Opaque string brand',
                filename,
                code:   `${ PRELUDE } declare const v : string; const x = v as StripeID;`,
                errors: [ { messageId: 'nonLiteralBrandedCast' as const } ]
            },
            {
                name:   'call expression cast to branded primitive',
                filename,
                code:   `${ PRELUDE } declare const fn : () => unknown; const x = fn() as Cents;`,
                errors: [ { messageId: 'nonLiteralBrandedCast' as const } ]
            },
            {
                name:   'arithmetic expression cast to branded primitive',
                filename,
                code:   `${ PRELUDE } declare const a : number; declare const b : number; const x = (a + b) as Cents;`,
                errors: [ { messageId: 'nonLiteralBrandedCast' as const } ]
            },
            {
                name:   'template literal with expressions cast to branded primitive',
                filename,
                code:   `${ PRELUDE } declare const a : string; declare const b : string; const x = \`\${ a }-\${ b }\` as UUID;`,
                errors: [ { messageId: 'nonLiteralBrandedCast' as const } ]
            },
            {
                name:   'nullish coalescing cast to branded union',
                filename,
                code:   `${ PRELUDE } declare const v : Cents | null; const x = (v ?? 0) as Cents | undefined;`,
                errors: [ { messageId: 'nonLiteralBrandedCast' as const } ]
            }
        ]
    });
});
