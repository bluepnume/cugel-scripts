import { RuleTester } from 'eslint';

// eslint-disable-next-line no-restricted-syntax
import { noInOperatorNarrowing } from '../../../src/eslint/rules/no-in-operator-narrowing';

import parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
    languageOptions: {

        parser
    }
});

describe('no-in-operator-narrowing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    ruleTester.run('no-in-operator-narrowing', noInOperatorNarrowing as any, {
        valid: [
            {
                name: 'discriminant check with ===',
                code: `if (obj.type === 'foo') {}`
            },
            {
                name: 'switch on discriminant',
                code: `switch (obj.type) { case 'foo': break; }`
            },
            {
                name: 'property access with dot notation',
                code: `const x = obj.foo;`
            },
            {
                name: 'optional chaining',
                code: `const x = obj?.foo;`
            },
            {
                name: 'typeof check',
                code: `if (typeof obj === 'string') {}`
            },
            {
                name: 'instanceof check',
                code: `if (obj instanceof Error) {}`
            },
            {
                name: 'for-of loop (not for-in)',
                code: `for (const item of items) {}`
            }
        ],

        invalid: [
            {
                name:   'in operator in if condition',
                code:   `if ('foo' in obj) {}`,
                errors: [ { messageId: 'noInNarrowing' as const } ]
            },
            {
                name:   'in operator in ternary',
                code:   `const x = 'foo' in obj ? 1 : 2;`,
                errors: [ { messageId: 'noInNarrowing' as const } ]
            },
            {
                name:   'in operator with variable key',
                code:   `if (key in obj) {}`,
                errors: [ { messageId: 'noInNarrowing' as const } ]
            },
            {
                name:   'in operator in else-if',
                code:   `if (false) {} else if ('bar' in obj) {}`,
                errors: [ { messageId: 'noInNarrowing' as const } ]
            },
            {
                name:   'in operator in logical expression',
                code:   `const x = 'foo' in obj && obj.foo;`,
                errors: [ { messageId: 'noInNarrowing' as const } ]
            },
            {
                name:   'in operator in while condition',
                code:   `while ('next' in node) { node = node.next; }`,
                errors: [ { messageId: 'noInNarrowing' as const } ]
            },
            {
                name:   'in operator assigned to variable',
                code:   `const hasFoo = 'foo' in obj;`,
                errors: [ { messageId: 'noInNarrowing' as const } ]
            },
            {
                name:   'in operator with complex expression',
                code:   `if ('billingAddressID' in instrument) {}`,
                errors: [ { messageId: 'noInNarrowing' as const } ]
            }
        ]
    });
});
