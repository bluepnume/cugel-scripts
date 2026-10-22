import { RuleTester } from 'eslint';

// eslint-disable-next-line no-restricted-syntax
import { requireIndexBarrel } from '../../../src/eslint/rules/require-index-barrel';

import parser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
    languageOptions: {

        parser
    }
});

const filename = 'src/biz/thing/index.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
ruleTester.run('require-index-barrel', requireIndexBarrel as any, {
    valid: [
        {
            name: 'single export *',
            filename,
            code: `export * from './thing';`
        },
        {
            name: 'several export * lines',
            filename,
            code: `export * from './alpha';\nexport * from './beta';\nexport * from './gamma';`
        },
        {
            name: 'export * from a package',
            filename,
            code: `export * from 'some-package';`
        },
        {
            name: 'export type *',
            filename,
            code: `export type * from './types';`
        },
        {
            name: 'comments and eslint directives alongside export *',
            filename,
            code: `/* eslint no-console: off */\n\n// ordering matters here\nexport * from './second';\nexport * from './first';`
        },
        {
            name: 'empty file',
            filename,
            code: ``
        },
        {
            name:     'non-index file may contain anything',
            filename: 'src/biz/thing/thing.ts',
            code:     `import { foo } from './foo';\n\nexport const bar = () => foo;`
        },
        {
            name:     'index.tsx is not covered',
            filename: 'src/component/index.tsx',
            code:     `export const Component = () => null;`
        }
    ],

    invalid: [
        {
            name:   'named re-export',
            filename,
            code:   `export { foo } from './foo';`,
            errors: [ { messageId: 'namedReexport' } ]
        },
        {
            name:   'named type re-export',
            filename,
            code:   `export type { Foo } from './foo';`,
            errors: [ { messageId: 'namedReexport' } ]
        },
        {
            name:   'namespace re-export',
            filename,
            code:   `export * as foo from './foo';`,
            errors: [ { messageId: 'namespaceReexport' } ]
        },
        {
            name:   'import statement',
            filename,
            code:   `import { foo } from './foo';\n\nexport * from './foo';`,
            errors: [ { messageId: 'nonBarrelStatement', data: { description: 'an import' } } ]
        },
        {
            name:   'variable declaration',
            filename,
            code:   `export const FOO = 1;`,
            errors: [ { messageId: 'nonBarrelStatement', data: { description: 'a variable declaration' } } ]
        },
        {
            name:   'function declaration',
            filename,
            code:   `export function foo() {\n    return 1;\n}`,
            errors: [ { messageId: 'nonBarrelStatement', data: { description: 'a function declaration' } } ]
        },
        {
            name:   'type declaration',
            filename,
            code:   `export type Foo = string;`,
            errors: [ { messageId: 'nonBarrelStatement', data: { description: 'a type declaration' } } ]
        },
        {
            name:   'interface declaration',
            filename,
            code:   `export interface Foo {\n    bar : string;\n}`,
            errors: [ { messageId: 'nonBarrelStatement', data: { description: 'an interface declaration' } } ]
        },
        {
            name:   'enum declaration',
            filename,
            code:   `export enum Foo {\n    BAR = 'BAR'\n}`,
            errors: [ { messageId: 'nonBarrelStatement', data: { description: 'an enum declaration' } } ]
        },
        {
            name:   'default export',
            filename,
            code:   `export default 1;`,
            errors: [ { messageId: 'nonBarrelStatement', data: { description: 'a default export' } } ]
        },
        {
            name:   'local export list with no source',
            filename,
            code:   `const foo = 1;\n\nexport { foo };`,
            errors: [
                { messageId: 'nonBarrelStatement', data: { description: 'a variable declaration' } },
                { messageId: 'nonBarrelStatement', data: { description: 'a local export list' } }
            ]
        },
        {
            name:   'side-effecting statement',
            filename,
            code:   `console.log('hi');\n\nexport * from './foo';`,
            errors: [ { messageId: 'nonBarrelStatement', data: { description: 'a statement' } } ]
        },
        {
            name:   'every offending statement is reported',
            filename,
            code:   `import { foo } from './foo';\n\nexport const BAR = 1;\n\nexport { foo } from './foo';`,
            errors: [
                { messageId: 'nonBarrelStatement', data: { description: 'an import' } },
                { messageId: 'nonBarrelStatement', data: { description: 'a variable declaration' } },
                { messageId: 'namedReexport' }
            ]
        }
    ]
});
