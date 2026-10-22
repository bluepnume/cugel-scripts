import { RuleTester } from 'eslint';

// eslint-disable-next-line no-restricted-syntax
import { zodSchemaDeclaration } from '../../../src/eslint/rules/zod-schema-declaration';

import parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
    languageOptions: {

        parser,
        parserOptions: { sourceType: 'module' }
    }
});

describe('zod-schema-declaration', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    ruleTester.run('zod-schema-declaration', zodSchemaDeclaration as any, {
        valid: [
            {
                name: 'destructured declaration is not a schema declaration',
                code: `const { shape } = z.object({ a: z.string() });`
            },
            {
                name: 'declaration without an initialiser',
                code: `let fooSchema;`
            },
            // --- Module-level + camelCase + ends in Schema ---

            {
                name: 'simple z.object schema at module level',
                code: `const fooSchema = z.object({ a: z.string() });`
            },
            {
                name: 'exported z.string schema at module level',
                code: `export const fooSchema = z.string();`
            },
            {
                name: 'chained z schema with .optional()',
                code: `const fooSchema = z.string().optional();`
            },
            {
                name: 'multi-word camelCase ending in Schema',
                code: `const httpRequestSchema = z.object({});`
            },
            {
                name: 'z4 alias is recognized',
                code: `const fooSchema = z4.string();`
            },

            // --- Non-zod variables are ignored ---

            {
                name: 'non-zod variable named badly is ignored',
                code: `const FOO_BAR = 1;`
            },
            {
                name: 'non-zod variable inside a function is ignored',
                code: `const make = () => { const x = 1; return x; };`
            },
            {
                name: 'function call that returns a non-schema is ignored',
                code: `const result = computeStuff();`
            },
            {
                name: 'parsed value (z.parse terminal) is not a schema',
                code: `const parsed = z.string().parse(input);`
            },
            {
                name: 'parsed value (safeParse terminal) is not a schema',
                code: `const parsed = z.string().safeParse(input);`
            },

            // --- Schemas built from custom helpers (not z/z4) are ignored ---
            //     `enumSchema(...)` and similar wrappers don't have `z.` at
            //     their root callee. They're enforced separately by other
            //     rules (e.g. enum-declaration's module-level requirement).

            {
                name: 'enumSchema-built variable is not flagged by this rule',
                code: `const wrong_name = enumSchema(FOO);`
            },

            // --- Builders that return a schema directly without binding pass ---

            {
                name: 'function returning a schema without binding to a variable',
                code: `
                    const makeSchema = () => z.string().optional();
                `
            }
        ],

        invalid: [
            // --- Module-level violation ---

            {
                name:   'zod schema declared inside an arrow function',
                code:   `const make = () => { const fooSchema = z.string(); return fooSchema; };`,
                errors: [ { messageId: 'schemaNotModuleLevel' as const } ]
            },
            {
                name:   'zod schema declared inside a function declaration',
                code:   `function make() { const fooSchema = z.string(); return fooSchema; }`,
                errors: [ { messageId: 'schemaNotModuleLevel' as const } ]
            },
            {
                name:   'zod schema declared inside a nested block',
                code:   `const make = () => { { const fooSchema = z.object({}); } };`,
                errors: [ { messageId: 'schemaNotModuleLevel' as const } ]
            },

            // --- Naming violations (autofixable) ---

            {
                name:   'name with no word characters falls back to a placeholder',
                code:   `const __ = z.string();`,
                output: `const somethingSchema = z.string();`,
                errors: [ { messageId: 'schemaNameInvalid' as const } ]
            },
            {
                name:   'snake_case name with schema suffix gets camelCased',
                code:   `const foo_bar_schema = z.string();`,
                output: `const fooBarSchema = z.string();`,
                errors: [ { messageId: 'schemaNameInvalid' as const } ]
            },
            {
                name:   'PascalCase name with Schema suffix',
                code:   `const FooSchema = z.string();`,
                output: `const fooSchema = z.string();`,
                errors: [ { messageId: 'schemaNameInvalid' as const } ]
            },
            {
                name:   'camelCase name missing Schema suffix',
                code:   `const fooBar = z.string();`,
                output: `const fooBarSchema = z.string();`,
                errors: [ { messageId: 'schemaNameInvalid' as const } ]
            },
            {
                name:   'lowercased "schema" suffix gets the S capitalized',
                code:   `const fooschema = z.string();`,
                output: `const fooSchema = z.string();`,
                errors: [ { messageId: 'schemaNameInvalid' as const } ]
            },
            {
                name:   'SCREAMING_SNAKE name converted',
                code:   `const FOO_BAR = z.string();`,
                output: `const fooBarSchema = z.string();`,
                errors: [ { messageId: 'schemaNameInvalid' as const } ]
            },
            {
                name:   'name with consecutive uppercase splits correctly',
                code:   `const XMLParser = z.string();`,
                output: `const xmlParserSchema = z.string();`,
                errors: [ { messageId: 'schemaNameInvalid' as const } ]
            },

            // --- Already-camelCase names: preserve acronyms, only fix the suffix ---

            {
                name:   'camelCase with embedded acronyms is left alone except for Schema suffix',
                code:   `const postMockWebhookSMSAPIQuery = z.object({});`,
                output: `const postMockWebhookSMSAPIQuerySchema = z.object({});`,
                errors: [ { messageId: 'schemaNameInvalid' as const } ]
            },
            {
                name:   'camelCase with single acronym preserved',
                code:   `const getMarketingListAPIRequest = z.object({});`,
                output: `const getMarketingListAPIRequestSchema = z.object({});`,
                errors: [ { messageId: 'schemaNameInvalid' as const } ]
            },

            // --- Naming autofix renames in-file usages too ---

            {
                name:   'usages of the renamed schema are updated in-file',
                code:   `const fooBar = z.object({}); const wrapped = fooBar.optional(); export { fooBar };`,
                output: `const fooBarSchema = z.object({}); const wrapped = fooBarSchema.optional(); export { fooBarSchema };`,
                errors: [ { messageId: 'schemaNameInvalid' as const } ]
            },

            // --- Combined violations ---

            {
                name:   'wrongly named schema inside a function: both errors fire',
                code:   `const make = () => { const fooBar = z.string(); return fooBar; };`,
                output: `const make = () => { const fooBarSchema = z.string(); return fooBarSchema; };`,
                errors: [
                    { messageId: 'schemaNotModuleLevel' as const },
                    { messageId: 'schemaNameInvalid' as const }
                ]
            }
        ]
    });
});
