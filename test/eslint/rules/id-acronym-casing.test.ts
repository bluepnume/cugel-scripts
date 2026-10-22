import { RuleTester } from 'eslint';

// eslint-disable-next-line no-restricted-syntax
import { idAcronymCasing } from '../../../src/eslint/rules/id-acronym-casing';

import parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
    languageOptions: {
        parser,
        parserOptions: { jsx: true }
    }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
ruleTester.run('id-acronym-casing', idAcronymCasing as any, {
    valid: [
        {
            name: 'already uppercase ID at end',
            code: `const fooID = 1;`
        },
        {
            name: 'plural IDs already uppercase',
            code: `const fooIDs = [];`
        },
        {
            name: 'standalone lowercase id is fine',
            code: `const id = 1;`
        },
        {
            name: 'id at start of identifier (idValue)',
            code: `const idValue = 1;`
        },
        {
            name: 'Identifier (Id at very start, no lowercase before)',
            code: `const Identifier = 1;`
        },
        {
            name: 'Idol (Id at very start, no lowercase before)',
            code: `const Idol = 1;`
        },
        {
            name: 'Id followed by lowercase letter (kIdleTimeout)',
            code: `const kIdleTimeout = 1;`
        },
        {
            name: 'no Id substring at all',
            code: `const totallyFine = 1;`
        },
        {
            name: 'non-aliased named import of external fooId is left alone',
            code: `import { fooId } from 'lib';`
        },
        {
            name: 'aliased import where local matches external is left alone',
            code: `import { fooId as fooId } from 'lib';`
        },
        {
            name: 're-export from external module is left alone',
            code: `export { fooId } from 'lib';`
        },
        {
            name: 'object key already uppercase',
            code: `const obj = { fooID: 1 };`
        },
        {
            name: 'string literal not used as property key',
            code: `const s = 'fooId';`
        }
    ],

    invalid: [
        {
            name:   'variable declaration with trailing Id',
            code:   `const fooId = 1;`,
            output: `const fooID = 1;`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'plural Ids at end',
            code:   `const fooIds = [];`,
            output: `const fooIDs = [];`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'Id followed by another word',
            code:   `const fooIdValue = 1;`,
            output: `const fooIDValue = 1;`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'function declaration',
            code:   `function getUserId() {}`,
            output: `function getUserID() {}`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'function parameter',
            code:   `function foo(userId) {}`,
            output: `function foo(userID) {}`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'arrow function parameter with type',
            code:   `const f = (userId: number) => userId;`,
            output: `const f = (userID: number) => userID;`,
            errors: [
                { messageId: 'useUpperCaseId' as const },
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'object literal property key',
            code:   `const obj = { userId: 1 };`,
            output: `const obj = { userID: 1 };`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'object shorthand property',
            code:   `const userId = 1; const obj = { userId };`,
            output: `const userID = 1; const obj = { userID };`,
            errors: [
                { messageId: 'useUpperCaseId' as const },
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'string-literal object key',
            code:   `const obj = { 'userId': 1 };`,
            output: `const obj = { 'userID': 1 };`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'double-quoted string-literal key',
            code:   `const obj = { "userId": 1 };`,
            output: `const obj = { "userID": 1 };`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'destructuring rename target',
            code:   `const { userId } = obj;`,
            output: `const { userID } = obj;`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'TS interface member',
            code:   `interface User { userId: string }`,
            output: `interface User { userID: string }`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'TS type literal member',
            code:   `type T = { userId: string };`,
            output: `type T = { userID: string };`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'TS interface string-literal member',
            code:   `interface User { 'userId': string }`,
            output: `interface User { 'userID': string }`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'class property',
            code:   `class Foo { userId = 1; }`,
            output: `class Foo { userID = 1; }`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'class method',
            code:   `class Foo { getUserId() { return 1; } }`,
            output: `class Foo { getUserID() { return 1; } }`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'enum member',
            code:   `enum E { fooId = 'x' }`,
            output: `enum E { fooID = 'x' }`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'reference site is also renamed',
            code:   `const userId = 1; const x = userId + 1;`,
            output: `const userID = 1; const x = userID + 1;`,
            errors: [
                { messageId: 'useUpperCaseId' as const },
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'member access is renamed',
            code:   `obj.userId;`,
            output: `obj.userID;`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'two Id substrings in one name',
            code:   `const userIdAndPostId = 1;`,
            output: `const userIDAndPostID = 1;`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'aliased named import renames only the local binding',
            code:   `import { foo as fooId } from 'lib';`,
            output: `import { foo as fooID } from 'lib';`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'default import local binding is renamed',
            code:   `import fooId from 'lib';`,
            output: `import fooID from 'lib';`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'namespace import local binding is renamed',
            code:   `import * as fooId from 'lib';`,
            output: `import * as fooID from 'lib';`,
            errors: [
                { messageId: 'useUpperCaseId' as const }
            ]
        },
        {
            name:   'local export specifier is renamed',
            code:   `const fooId = 1; export { fooId };`,
            output: `const fooID = 1; export { fooID };`,
            errors: [
                { messageId: 'useUpperCaseId' as const },
                { messageId: 'useUpperCaseId' as const }
            ]
        }
    ]
});
