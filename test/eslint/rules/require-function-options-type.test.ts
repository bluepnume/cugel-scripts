import { RuleTester } from 'eslint';

// eslint-disable-next-line no-restricted-syntax
import { requireFunctionOptionsType } from '../../../src/eslint/rules/require-function-options-type';

import parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
    languageOptions: {

        parser
    }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
ruleTester.run('require-function-options-type', requireFunctionOptionsType as any, {
    valid: [
        // --- Correct usage ---

        {
            name: 'correctly named options type on arrow function',
            code: `
                type FooOptions = { bar : string };
                const foo = (opts : FooOptions) => {};
            `
        },
        {
            name: 'correctly named options type on function declaration',
            code: `
                type FooOptions = { bar : string };
                function foo(opts : FooOptions) {}
            `
        },
        {
            name: 'correctly named options type with context param',
            code: `
                type FooOptions = { bar : string };
                const foo = (context : any, opts : FooOptions) => {};
            `
        },
        {
            name: 'no params',
            code: `const foo = () => {};`
        },
        {
            name: 'primitive param type (not an object)',
            code: `const foo = (x : string) => {};`
        },
        {
            name: 'no type annotation on param',
            code: `const foo = (opts) => {};`
        },
        {
            name: 'callback (not a named function)',
            code: `[1].map((x : { a : string }) => x);`
        },
        {
            name: 'object method (not a named function)',
            code: `const obj = { method(opts : { a : string }) {} };`
        },

        // --- Generic type param on the function (not an options type) ---

        {
            name: 'generic type param used as last param type',
            code: `
                const tableSchema = <T extends object>(schema : T) => {};
            `
        },

        // --- Imported type (not local, should be ignored) ---

        {
            name: 'imported type used as param type',
            code: `
                import type { SomeOptions } from './types';
                const foo = (opts : SomeOptions) => {};
            `
        },

        // --- Exported type (should not be renamed) ---

        {
            name: 'exported type used as param type',
            code: `
                export type ShopifyOrderResponse = { id : string };
                const mapShopifyOrder = (order : ShopifyOrderResponse) => {};
            `
        },

        // --- Shared type across multiple functions ---

        {
            name: 'type shared by multiple functions is not flagged',
            code: `
                type CustomerStoreOptions = { id : string };
                const getCart = (opts : CustomerStoreOptions) => {};
                const getOrder = (opts : CustomerStoreOptions) => {};
            `
        },

        // --- Type referenced in multiple places (domain type) ---

        {
            name: 'type used as both field type and param type is not flagged',
            code: `
                type Snapshot = { id : string };
                type Report = { snapshot : Snapshot };
                const extractData = (data : Snapshot) => {};
            `
        },

        // --- Non-object types (enums, unions) should not be flagged ---

        {
            name: 'union type used as param type is not flagged',
            code: `
                type AIModel = 'gpt-4' | 'claude';
                const getAIPlatform = (model : AIModel) => {};
            `
        },
        {
            name: 'intersection type used as param type is not flagged',
            code: `
                type Combined = string & { brand : 'id' };
                const process = (id : Combined) => {};
            `
        },

        // --- Nested function (no insertion point, no existing type) ---

        {
            name: 'nested function with inline type is skipped (no fix possible)',
            code: `
                const outer = () => {
                    const inner = (opts : { a : string }) => {};
                };
            `
        },

        // --- Type already directly before the function ---

        {
            name: 'options type directly before exported function',
            code: `
                type FooOptions = { bar : string };
                export const foo = (opts : FooOptions) => {};
            `
        },

        // --- Adjacency skipped when type is shared by multiple functions ---

        {
            name: 'shared type is not flagged for adjacency even if non-adjacent',
            code: `
                type FooOptions = { bar : string };
                const x = 1;
                const foo = (opts : FooOptions) => {};
                const bar = (opts : FooOptions) => {};
            `
        },

        // --- Adjacency skipped for types referenced as field types ---

        {
            name: 'type referenced as a field type elsewhere is not flagged for adjacency',
            code: `
                type FooOptions = { bar : string };
                type Wrapper = { inner : FooOptions };
                const x = 1;
                const foo = (opts : FooOptions) => {};
            `
        },

        // --- Adjacency not enforced for exported types (consistent with rename) ---

        {
            name: 'non-adjacent exported options type is not flagged',
            code: `
                export type FooOptions = { bar : string };
                const x = 1;
                const foo = (opts : FooOptions) => {};
            `
        }
    ],

    invalid: [
        // --- Inline object type on arrow function ---

        {
            name:   'inline object type on arrow function',
            code:   `const foo = (opts : { bar : string }) => {};`,
            errors: [ { messageId: 'inlineObjectType' } ],
            output: `type FooOptions = { bar : string };\n\nconst foo = (opts : FooOptions) => {};`
        },

        // --- Inline object type on function declaration ---

        {
            name:   'inline object type on function declaration',
            code:   `function foo(opts : { bar : string }) {}`,
            errors: [ { messageId: 'inlineObjectType' } ],
            output: `type FooOptions = { bar : string };\n\nfunction foo(opts : FooOptions) {}`
        },

        // --- Inline object type with (context, opts) pattern ---

        {
            name:   'inline object type as last param with context first',
            code:   `const foo = (context : any, opts : { bar : string }) => {};`,
            errors: [ { messageId: 'inlineObjectType' } ],
            output: `type FooOptions = { bar : string };\n\nconst foo = (context : any, opts : FooOptions) => {};`
        },

        // --- Inline type on exported function ---

        {
            name:   'inline object type on exported arrow function',
            code:   `export const foo = (opts : { bar : string }) => {};`,
            errors: [ { messageId: 'inlineObjectType' } ],
            output: `type FooOptions = { bar : string };\n\nexport const foo = (opts : FooOptions) => {};`
        },

        // --- Default param value ---

        {
            name:   'inline object type with default value',
            code:   `const foo = (opts : { bar : string } = {}) => {};`,
            errors: [ { messageId: 'inlineObjectType' } ],
            output: `type FooOptions = { bar : string };\n\nconst foo = (opts : FooOptions = {}) => {};`
        },

        // --- When the expected type already exists, just replace the inline type ---

        {
            name: 'inline type replaced with existing named type',
            code: `
                type FooOptions = { bar : string };
                const foo = (opts : { bar : string }) => {};
            `,
            errors: [ { messageId: 'inlineObjectType' } ],
            output: `
                type FooOptions = { bar : string };
                const foo = (opts : FooOptions) => {};
            `
        },

        // --- Wrongly named local type (single use, single reference) ---

        {
            name: 'wrongly named local type gets renamed',
            code: `
                type FooOpts = { bar : string };
                const foo = (opts : FooOpts) => {};
            `,
            errors: [ { messageId: 'wrongTypeName' } ],
            output: `
                type FooOptions = { bar : string };
                const foo = (opts : FooOptions) => {};
            `
        },

        // --- Generic function with inline object type ---

        {
            name:   'generic function extracts type with generic params',
            code:   `const foo = <T extends string>(opts : { bar : T }) => {};`,
            errors: [ { messageId: 'inlineObjectType' } ],
            output: `type FooOptions<T extends string> = { bar : T };\n\nconst foo = <T extends string>(opts : FooOptions<T>) => {};`
        },

        // --- Destructured param with wrongly named type ---

        {
            name: 'destructured param with wrongly named local type',
            code: `
                type WrongName = { bar : string };
                const foo = ({ bar } : WrongName) => {};
            `,
            errors: [ { messageId: 'wrongTypeName' } ],
            output: `
                type FooOptions = { bar : string };
                const foo = ({ bar } : FooOptions) => {};
            `
        },

        // --- Inline destructured param ---

        {
            name:   'inline object type on destructured param',
            code:   `const foo = ({ bar } : { bar : string }) => {};`,
            errors: [ { messageId: 'inlineObjectType' } ],
            output: `type FooOptions = { bar : string };\n\nconst foo = ({ bar } : FooOptions) => {};`
        },

        // --- Adjacency: type separated from function by another statement ---

        {
            name:   'options type with statement between it and the function',
            code:   `type FooOptions = { bar : string };\n\nconst x = 1;\n\nconst foo = (opts : FooOptions) => {};`,
            errors: [ { messageId: 'typeNotAdjacent' } ],
            output: `const x = 1;\n\ntype FooOptions = { bar : string };\n\nconst foo = (opts : FooOptions) => {};`
        },

        // --- Adjacency: type comes after the function ---

        {
            name:   'options type declared after the function',
            code:   `const foo = (opts : FooOptions) => {};\n\ntype FooOptions = { bar : string };`,
            errors: [ { messageId: 'typeNotAdjacent' } ],
            output: `type FooOptions = { bar : string };\n\nconst foo = (opts : FooOptions) => {};`
        },

        // --- Adjacency: function is exported, type is several statements above ---

        {
            name:   'exported function with type separated by other statements',
            code:   `type FooOptions = { bar : string };\n\nconst x = 1;\n\nexport const foo = (opts : FooOptions) => {};`,
            errors: [ { messageId: 'typeNotAdjacent' } ],
            output: `const x = 1;\n\ntype FooOptions = { bar : string };\n\nexport const foo = (opts : FooOptions) => {};`
        },

        // --- Adjacency: interface declaration ---

        {
            name:   'interface options type separated from function',
            code:   `interface FooOptions { bar : string }\n\nconst x = 1;\n\nconst foo = (opts : FooOptions) => {};`,
            errors: [ { messageId: 'typeNotAdjacent' } ],
            output: `const x = 1;\n\ninterface FooOptions { bar : string }\n\nconst foo = (opts : FooOptions) => {};`
        },

        // --- Adjacency: type declared after an exported function ---

        {
            name:   'options type declared after an exported function',
            code:   `export const foo = (opts : FooOptions) => {};\n\ntype FooOptions = { bar : string };`,
            errors: [ { messageId: 'typeNotAdjacent' } ],
            output: `type FooOptions = { bar : string };\n\nexport const foo = (opts : FooOptions) => {};`
        },

        // --- Adjacency: function declaration (vs arrow function) ---

        {
            name:   'function declaration with non-adjacent options type',
            code:   `type FooOptions = { bar : string };\n\nconst x = 1;\n\nfunction foo(opts : FooOptions) {}`,
            errors: [ { messageId: 'typeNotAdjacent' } ],
            output: `const x = 1;\n\ntype FooOptions = { bar : string };\n\nfunction foo(opts : FooOptions) {}`
        }
    ]
});
