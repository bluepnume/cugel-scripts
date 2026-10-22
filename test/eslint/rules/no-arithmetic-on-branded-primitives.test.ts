import { RuleTester } from 'eslint';
import { resolve } from 'node:path';

// eslint-disable-next-line no-restricted-syntax
import { noArithmeticOnBrandedPrimitives } from '../../../src/eslint/rules/no-arithmetic-on-branded-primitives';

import parser from '@typescript-eslint/parser';

const tsconfigRootDir = resolve(import.meta.dirname, '../../..');
const filename = resolve(tsconfigRootDir, 'src/index.ts');

const ruleTester = new RuleTester({
    languageOptions: {

        parser,

        parserOptions: {
            project: './tsconfig.json',
            tsconfigRootDir
        }
    }
});

// Inline brand definitions so the tests don't depend on the project's domain
// types staying stable.
const PRELUDE = `
    type Tagged<T, N extends string> = T & { readonly __tag : N };
    type Opaque<N, T> = T & { readonly __TYPE__ : N };
    type Cents = Tagged<number, 'Cents'>;
    type Milliseconds = Tagged<number, 'Milliseconds'>;
    type Dollars = Tagged<number, 'Dollars'>;
    type StripeID = Opaque<'StripeID', string>;
    type Email = \`\${ string }@\${ string }.\${ string }\`;
`;

describe('no-arithmetic-on-branded-primitives', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    ruleTester.run('no-arithmetic-on-branded-primitives', noArithmeticOnBrandedPrimitives as any, {
        valid: [
            {
                name: 'arithmetic on plain numbers',
                filename,
                code: `${ PRELUDE } declare const a : number; declare const b : number; const c = a + b;`
            },
            {
                name: 'comparison of two branded values',
                filename,
                code: `${ PRELUDE } declare const a : Cents; declare const b : Cents; const c = a < b;`
            },
            {
                name: 'equality of two branded values',
                filename,
                code: `${ PRELUDE } declare const a : Cents; declare const b : Cents; const c = a === b;`
            },
            {
                name: 'string concat on Email (template literal, not branded intersection)',
                filename,
                code: `${ PRELUDE } declare const a : Email; declare const b : Email; const c = a + b;`
            },
            {
                name: 'compound assignment on plain number',
                filename,
                code: `let a = 1; a += 2;`
            }
        ],

        invalid: [
            {
                name:   'addition of two Cents — autofix to add()',
                filename,
                code:   `${ PRELUDE } declare const a : Cents; declare const b : Cents; const c = a + b;`,
                output: `${ PRELUDE } declare const a : Cents; declare const b : Cents; const c = add(a, b);`,
                errors: [ { messageId: 'arithmeticOnBranded' as const } ]
            },
            {
                name:   'subtraction of two Milliseconds — autofix to subtract()',
                filename,
                code:   `${ PRELUDE } declare const a : Milliseconds; declare const b : Milliseconds; const c = a - b;`,
                output: `${ PRELUDE } declare const a : Milliseconds; declare const b : Milliseconds; const c = subtract(a, b);`,
                errors: [ { messageId: 'arithmeticOnBranded' as const } ]
            },
            {
                name:   'multiplication of two Cents — autofix to multiply()',
                filename,
                code:   `${ PRELUDE } declare const a : Cents; declare const b : Cents; const c = a * b;`,
                output: `${ PRELUDE } declare const a : Cents; declare const b : Cents; const c = multiply(a, b);`,
                errors: [ { messageId: 'arithmeticOnBranded' as const } ]
            },
            {
                name:   'division of two Cents — autofix to divide()',
                filename,
                code:   `${ PRELUDE } declare const a : Cents; declare const b : Cents; const c = a / b;`,
                output: `${ PRELUDE } declare const a : Cents; declare const b : Cents; const c = divide(a, b);`,
                errors: [ { messageId: 'arithmeticOnBranded' as const } ]
            },
            {
                name:   'modulo of two Milliseconds — autofix to modulo()',
                filename,
                code:   `${ PRELUDE } declare const a : Milliseconds; declare const b : Milliseconds; const c = a % b;`,
                output: `${ PRELUDE } declare const a : Milliseconds; declare const b : Milliseconds; const c = modulo(a, b);`,
                errors: [ { messageId: 'arithmeticOnBranded' as const } ]
            },
            {
                name:   'cross-brand addition (Cents + Dollars) — autofix to add()',
                filename,
                code:   `${ PRELUDE } declare const a : Cents; declare const b : Dollars; const c = a + b;`,
                output: `${ PRELUDE } declare const a : Cents; declare const b : Dollars; const c = add(a, b);`,
                errors: [ { messageId: 'arithmeticOnBranded' as const } ]
            },
            {
                name:   'Opaque string IDs concatenation — autofix to add()',
                filename,
                code:   `${ PRELUDE } declare const a : StripeID; declare const b : StripeID; const c = a + b;`,
                output: `${ PRELUDE } declare const a : StripeID; declare const b : StripeID; const c = add(a, b);`,
                errors: [ { messageId: 'arithmeticOnBranded' as const } ]
            },
            {
                name:   'compound += on identifier LHS — autofix duplicates LHS',
                filename,
                code:   `${ PRELUDE } declare let a : Cents; declare const b : Cents; a += b;`,
                output: `${ PRELUDE } declare let a : Cents; declare const b : Cents; a = add(a, b);`,
                errors: [ { messageId: 'compoundAssignmentOnBranded' as const } ]
            },
            {
                name:   'compound -= on identifier LHS — autofix duplicates LHS',
                filename,
                code:   `${ PRELUDE } declare let a : Milliseconds; declare const b : Milliseconds; a -= b;`,
                output: `${ PRELUDE } declare let a : Milliseconds; declare const b : Milliseconds; a = subtract(a, b);`,
                errors: [ { messageId: 'compoundAssignmentOnBranded' as const } ]
            },
            {
                // LHS contains `++`, so the `lhs = helper(lhs, rhs)` rewrite
                // would evaluate `i++` twice. Refuse to autofix; the violation
                // is still reported. `output: null` asserts the fixer skipped.
                name:   'compound += on side-effecting LHS (i++) — reports but does not autofix',
                filename,
                code:   `${ PRELUDE } declare const arr : Array<Cents>; declare let i : number; declare const b : Cents; arr[i++] += b;`,
                output: null,
                errors: [ { messageId: 'compoundAssignmentOnBranded' as const } ]
            },
            {
                // ESLint --fix runs multiple passes until stable. RuleTester only
                // applies the fixer ONCE, so the recorded `output` shows the inner
                // rewrite; the outer pair fires on the next pass. With the rule
                // broadened to one-sided cases, both the inner (Cents + Cents)
                // and outer ((a + b) + Cents — i.e. number + Cents) fire on the
                // first pass.
                name:   'chained arithmetic — autofix rewrites the inner pair, both pairs reported',
                filename,
                code:   `${ PRELUDE } declare const a : Cents; declare const b : Cents; declare const c : Cents; const d = a + b + c;`,
                output: `${ PRELUDE } declare const a : Cents; declare const b : Cents; declare const c : Cents; const d = add(a, b) + c;`,
                errors: [
                    { messageId: 'arithmeticOnBranded' as const },
                    { messageId: 'arithmeticOnBranded' as const }
                ]
            },
            {
                name:   'branded + numeric literal — flagged (one-sided), autofix to add()',
                filename,
                code:   `${ PRELUDE } declare const a : Cents; const c = a + 1;`,
                output: `${ PRELUDE } declare const a : Cents; const c = add(a, 1);`,
                errors: [ { messageId: 'arithmeticOnBranded' as const } ]
            },
            {
                name:   'branded * plain number — flagged (one-sided), autofix to multiply()',
                filename,
                code:   `${ PRELUDE } declare const a : Cents; declare const b : number; const c = a * b;`,
                output: `${ PRELUDE } declare const a : Cents; declare const b : number; const c = multiply(a, b);`,
                errors: [ { messageId: 'arithmeticOnBranded' as const } ]
            },
            {
                name:   'plain number / branded — flagged (one-sided), autofix to divide()',
                filename,
                code:   `${ PRELUDE } declare const a : Cents; const c = 100 / a;`,
                output: `${ PRELUDE } declare const a : Cents; const c = divide(100, a);`,
                errors: [ { messageId: 'arithmeticOnBranded' as const } ]
            },
            {
                name:   'branded += numeric literal — flagged (one-sided), autofix duplicates LHS',
                filename,
                code:   `${ PRELUDE } declare let a : Cents; a += 5;`,
                output: `${ PRELUDE } declare let a : Cents; a = add(a, 5);`,
                errors: [ { messageId: 'compoundAssignmentOnBranded' as const } ]
            }
        ]
    });
});
