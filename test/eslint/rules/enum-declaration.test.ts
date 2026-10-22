import { RuleTester } from 'eslint';

// eslint-disable-next-line no-restricted-syntax
import { enumDeclaration } from '../../../src/eslint/rules/enum-declaration';

import parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
    languageOptions: {

        parser,
        parserOptions: { sourceType: 'module' }
    }
});

describe('enum-declaration', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    ruleTester.run('enum-declaration', enumDeclaration as any, {
        valid: [
            // --- Module-level + string values + initialized ---

            {
                name: 'module-level enum with string values',
                code: `enum FOO { A = 'a', B = 'b' }`
            },
            {
                name: 'exported module-level enum with string values',
                code: `export enum FOO { A = 'a' }`
            },
            {
                name: 'enum with template-literal string values',
                code: `enum FOO { A = \`a\`, B = \`b\` }`
            },
            {
                name: 'declare enum at module level with string values',
                code: `declare enum FOO { A = 'a' }`
            },
            {
                name: 'multiple module-level enums with string values',
                code: `
                    enum FOO { A = 'a' }
                    export enum BAR { B = 'b' }
                `
            },
            {
                name: 'no enums in the file',
                code: `const x = 1; const f = () => 2;`
            },
            {
                name: 'const-asserted object inside a function is not a TS enum',
                code: `
                    const make = () => {
                        const FOO = { A: 'a', B: 'b' } as const;
                        return FOO;
                    };
                `
            },
            {
                name: 'string-key enum members (rare but legal)',
                code: `enum FOO { 'A-B' = 'ab' }`
            },

            // --- Uppercase-naming pass-through ---

            {
                name: 'short uppercase name',
                code: `enum F { A = 'a' }`
            },
            {
                name: 'uppercase name with digits',
                code: `enum FOO_2 { A = 'a' }`
            },
            {
                name: 'string-key (quoted) members are exempt from uppercase check',
                code: `enum FOO { 'lowercase-key' = 'x' }`
            }
        ],

        invalid: [
            // --- Not module-level ---

            {
                name:   'enum inside arrow function body',
                code:   `const make = () => { enum FOO { A = 'a' } return FOO; };`,
                errors: [ { messageId: 'enumNotModuleLevel' as const } ]
            },
            {
                name:   'enum inside function declaration body',
                code:   `function make() { enum FOO { A = 'a' } return FOO; }`,
                errors: [ { messageId: 'enumNotModuleLevel' as const } ]
            },
            {
                name:   'enum inside an if-block',
                code:   `if (true) { enum FOO { A = 'a' } }`,
                errors: [ { messageId: 'enumNotModuleLevel' as const } ]
            },
            {
                name:   'enum inside a bare block',
                code:   `{ enum FOO { A = 'a' } }`,
                errors: [ { messageId: 'enumNotModuleLevel' as const } ]
            },
            {
                name:   'enum nested two levels deep',
                code:   `const outer = () => { const inner = () => { enum FOO { A = 'a' } return FOO; }; return inner; };`,
                errors: [ { messageId: 'enumNotModuleLevel' as const } ]
            },

            // --- Empty enums ---

            {
                name:   'empty enum',
                code:   `enum FOO {}`,
                errors: [ { messageId: 'enumEmpty' as const } ]
            },
            {
                name:   'empty exported enum',
                code:   `export enum FOO {}`,
                errors: [ { messageId: 'enumEmpty' as const } ]
            },
            {
                name:   'empty nested enum reports both errors',
                code:   `const make = () => { enum FOO {} return FOO; };`,
                errors: [
                    { messageId: 'enumNotModuleLevel' as const },
                    { messageId: 'enumEmpty' as const }
                ]
            },

            // --- Missing initializers (one error per enum, not per member) ---
            //     Autofixed by inserting `= '<lowercased-key>'` for each
            //     missing member.

            {
                name:   'single member without initializer',
                code:   `enum FOO { A }`,
                output: `enum FOO { A = 'a' }`,
                errors: [ { messageId: 'enumMembersMissingInitializer' as const } ]
            },
            {
                name:   'all members without initializers reports once and fills all',
                code:   `enum FOO { A, B, C }`,
                output: `enum FOO { A = 'a', B = 'b', C = 'c' }`,
                errors: [ { messageId: 'enumMembersMissingInitializer' as const } ]
            },
            {
                name:   'mixed: some members initialized, some not — only fills the missing ones',
                code:   `enum FOO { A = 'a', B, C = 'c' }`,
                output: `enum FOO { A = 'a', B = 'b', C = 'c' }`,
                errors: [ { messageId: 'enumMembersMissingInitializer' as const } ]
            },
            {
                name:   'screaming-snake-case key gets lowercased',
                code:   `enum FOO { FOO_BAR }`,
                output: `enum FOO { FOO_BAR = 'foo_bar' }`,
                errors: [ { messageId: 'enumMembersMissingInitializer' as const } ]
            },
            {
                name:   'string-key member gets lowercased',
                code:   `enum FOO { 'A-B' }`,
                output: `enum FOO { 'A-B' = 'a-b' }`,
                errors: [ { messageId: 'enumMembersMissingInitializer' as const } ]
            },

            // --- Non-string values (one error per enum, not per member) ---

            {
                name:   'numeric value',
                code:   `enum FOO { A = 0 }`,
                errors: [ { messageId: 'enumMembersNotString' as const } ]
            },
            {
                name:   'numeric values across all members reports once',
                code:   `enum HTTP_STATUS { OK = 200, NOT_FOUND = 404 }`,
                errors: [ { messageId: 'enumMembersNotString' as const } ]
            },
            {
                name:   'boolean value',
                code:   `enum FOO { A = true }`,
                errors: [ { messageId: 'enumMembersNotString' as const } ]
            },
            {
                name:   'identifier value',
                code:   `const x = 'a'; enum FOO { A = x }`,
                errors: [ { messageId: 'enumMembersNotString' as const } ]
            },
            {
                name:   'member-expression value (computed)',
                code:   `enum FOO { A = OTHER.B }`,
                errors: [ { messageId: 'enumMembersNotString' as const } ]
            },
            {
                name:   'template literal with expression is not a plain string',
                code:   `enum FOO { A = \`a-\${ x }\` }`,
                errors: [ { messageId: 'enumMembersNotString' as const } ]
            },
            {
                name:   'mixed: string and numeric values',
                code:   `enum FOO { A = 'a', B = 1, C = 'c' }`,
                errors: [ { messageId: 'enumMembersNotString' as const } ]
            },

            // --- A single eslint-disable above the enum suppresses every
            //     violation: verify that the report node is `node.id` (not
            //     individual members) for both kinds of member-level errors.
            //     If reports landed on members, the disable comment would
            //     only suppress the first one. ---

            {
                name:   'all member errors land on the enum id (single suppression point)',
                code:   `enum FOO { A, B = 1, C }`,
                output: `enum FOO { A = 'a', B = 1, C = 'c' }`,
                errors: [
                    {
                        messageId: 'enumMembersMissingInitializer' as const,
                        line:      1,
                        column:    6
                    },
                    {
                        messageId: 'enumMembersNotString' as const,
                        line:      1,
                        column:    6
                    }
                ]
            },

            // --- Combinations ---

            {
                name: 'nested enum with non-string value: both errors fire on the enum id',
                code: `
                    const make = () => {
                        enum BAD { A = 1 }
                        return BAD;
                    };
                `,
                errors: [
                    { messageId: 'enumNotModuleLevel' as const },
                    { messageId: 'enumMembersNotString' as const }
                ]
            },
            {
                name: 'nested enum with missing initializer: both errors fire; missing value is autofixed',
                code: `
                    const make = () => {
                        enum BAD { A }
                        return BAD;
                    };
                `,
                output: `
                    const make = () => {
                        enum BAD { A = 'a' }
                        return BAD;
                    };
                `,
                errors: [
                    { messageId: 'enumNotModuleLevel' as const },
                    { messageId: 'enumMembersMissingInitializer' as const }
                ]
            },
            {
                name: 'mixed file: module-level passes, nested fails',
                code: `
                    enum OK { A = 'a' }
                    const make = () => {
                        enum BAD { B = 'b' }
                        return BAD;
                    };
                `,
                errors: [ { messageId: 'enumNotModuleLevel' as const } ]
            },

            // --- Uppercase enforcement on enum name (autofix renames in-file refs) ---

            {
                name:   'lowercase enum name is renamed everywhere in the file',
                code:   `enum bleh { BLO = 'blo', BLI = 'bli' } const x = bleh.BLO;`,
                output: `enum BLEH { BLO = 'blo', BLI = 'bli' } const x = BLEH.BLO;`,
                errors: [ { messageId: 'enumNameNotUppercase' as const } ]
            },
            {
                name:   'PascalCase enum name is converted to UPPER_SNAKE_CASE',
                code:   `enum DigitalOceanEnvType { PROD = 'prod' } const x = DigitalOceanEnvType.PROD;`,
                output: `enum DIGITAL_OCEAN_ENV_TYPE { PROD = 'prod' } const x = DIGITAL_OCEAN_ENV_TYPE.PROD;`,
                errors: [ { messageId: 'enumNameNotUppercase' as const } ]
            },
            {
                name:   'camelCase enum name is converted to UPPER_SNAKE_CASE',
                code:   `enum myEnumName { A = 'a' }`,
                output: `enum MY_ENUM_NAME { A = 'a' }`,
                errors: [ { messageId: 'enumNameNotUppercase' as const } ]
            },
            {
                name:   'consecutive-uppercase-then-lowercase splits correctly (XMLParser → XML_PARSER)',
                code:   `enum XMLParser { A = 'a' }`,
                output: `enum XML_PARSER { A = 'a' }`,
                errors: [ { messageId: 'enumNameNotUppercase' as const } ]
            },

            // --- Uppercase enforcement on member names (autofix renames in-file accesses) ---

            {
                name:   'lowercase member name is renamed everywhere in the file',
                code:   `enum FOO { blo = 'blo' } const x = FOO.blo;`,
                output: `enum FOO { BLO = 'blo' } const x = FOO.BLO;`,
                errors: [ { messageId: 'enumMembersNotUppercase' as const } ]
            },
            {
                name:   'PascalCase member is converted',
                code:   `enum FOO { SomeMember = 'x' } const x = FOO.SomeMember;`,
                output: `enum FOO { SOME_MEMBER = 'x' } const x = FOO.SOME_MEMBER;`,
                errors: [ { messageId: 'enumMembersNotUppercase' as const } ]
            },
            {
                name:   'multiple non-uppercase members reported once and all renamed',
                code:   `enum FOO { a = 'a', b = 'b' } const x = [ FOO.a, FOO.b ];`,
                output: `enum FOO { A = 'a', B = 'b' } const x = [ FOO.A, FOO.B ];`,
                errors: [ { messageId: 'enumMembersNotUppercase' as const } ]
            },
            {
                name:   'mixed: uppercase member kept, lowercase member renamed',
                code:   `enum FOO { OK = 'ok', bad = 'bad' } const x = [ FOO.OK, FOO.bad ];`,
                output: `enum FOO { OK = 'ok', BAD = 'bad' } const x = [ FOO.OK, FOO.BAD ];`,
                errors: [ { messageId: 'enumMembersNotUppercase' as const } ]
            },
            {
                name: 'two separate enums each have their members renamed (no cross-contamination)',
                code: `
                    enum FOO { bad = 'bad' }
                    const a = FOO.bad;
                    enum OTHER { bad = 'other-bad' }
                    const b = OTHER.bad;
                `,
                output: `
                    enum FOO { BAD = 'bad' }
                    const a = FOO.BAD;
                    enum OTHER { BAD = 'other-bad' }
                    const b = OTHER.BAD;
                `,
                errors: [
                    { messageId: 'enumMembersNotUppercase' as const },
                    { messageId: 'enumMembersNotUppercase' as const }
                ]
            },

            // --- Combined: both name and members wrongly cased.
            //     Note: ESLint composes the multiple RuleFixes from a single
            //     report into one transactional range. The name-rename fix
            //     and the member-rename fix span the same enum body, so they
            //     overlap and only one applies per pass. Real `eslint --fix`
            //     loops to convergence; RuleTester only runs one pass, so
            //     this test asserts the partial one-pass result. ---

            {
                name:   'both name and members wrong: one pass renames the name, members converge on next pass',
                code:   `enum bleh { blo = 'blo' } const x = bleh.blo;`,
                output: `enum BLEH { blo = 'blo' } const x = BLEH.blo;`,
                errors: [
                    { messageId: 'enumNameNotUppercase' as const },
                    { messageId: 'enumMembersNotUppercase' as const }
                ]
            }
        ]
    });
});
