import { RuleTester } from 'eslint';

// eslint-disable-next-line no-restricted-syntax
import { preferTemplateOnLongLines } from '../../../src/eslint/rules/prefer-template-on-long-lines';

import parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
    languageOptions: {

        parser,
        parserOptions: { jsx: true }
    }
});

// 130 chars long, single-quoted
const longSingle = `                                throw new Error({ message: 'Expected discriminated union mapped sub union type to have shape' });`;

// 130 chars long, after fix to backticks
const longSingleFixed = `                                throw new Error({ message: \`Expected discriminated union mapped sub union type to have shape\` });`;

const longDouble = `                                throw new Error({ message: "Expected discriminated union mapped sub union type to have shape" });`;
const longDoubleFixed = `                                throw new Error({ message: \`Expected discriminated union mapped sub union type to have shape\` });`;

describe('prefer-template-on-long-lines', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    ruleTester.run('prefer-template-on-long-lines', preferTemplateOnLongLines as any, {
        valid: [
            {
                name: 'short line with a string',
                code: `const x = 'short';`
            },
            {
                name: 'long line that already contains a template literal',

                code: `const veryLongVariableName = \`this is already a long template literal that exceeds the maximum allowed line length easily \${ x }\`;`
            },
            {
                name: 'long line where the string is an import source',
                code: `import { somethingWithAReallyLongName } from 'a-module-with-an-equally-long-name-just-to-bust-past-120-cols-here-yes';`
            },
            {
                name: 'long line where the string is an object key',
                code: `const x = { 'this-is-a-very-long-property-key-that-pushes-the-line-past-the-allowed-limit-easily': someValue };`
            },
            {
                name: 'long line where the string is a TS literal type',
                code: `type X = 'this-is-a-very-long-literal-type-string-that-pushes-this-line-well-past-the-limit-of-120-chars-easily';`
            },
            {
                name: 'long line where the string is a JSX attribute',
                code: `const el = <div className='very-long-tailwind-class-list-with-many-classes-that-pushes-the-line-past-120-chars-easily-now'/>;`
            }
        ],

        invalid: [
            {
                name:   'long line with a single-quoted string',
                code:   longSingle,
                output: longSingleFixed,
                errors: [ { messageId: 'convertStringToTemplate' as const } ]
            },
            {
                name:   'long line with a double-quoted string',
                code:   longDouble,
                output: longDoubleFixed,
                errors: [ { messageId: 'convertStringToTemplate' as const } ]
            },
            {
                name:   'long line where the string contains a backtick is escaped',
                code:   `                                throw new Error({ message: 'this contains a backtick: \` and is super long way over 120 chars please' });`,
                output: `                                throw new Error({ message: \`this contains a backtick: \\\` and is super long way over 120 chars please\` });`,
                errors: [ { messageId: 'convertStringToTemplate' as const } ]
            },
            {
                name: 'long line where the string contains a placeholder is escaped',

                code: `                                throw new Error({ message: 'this contains a placeholder: \${ name } and is super long way over 120 chars please' });`,

                output: `                                throw new Error({ message: \`this contains a placeholder: \\\${ name } and is super long way over 120 chars please\` });`,
                errors: [ { messageId: 'convertStringToTemplate' as const } ]
            }
        ]
    });
});
