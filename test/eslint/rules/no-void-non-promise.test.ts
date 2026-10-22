import { RuleTester } from 'eslint';
import { resolve } from 'node:path';

// eslint-disable-next-line no-restricted-syntax
import { noVoidNonPromise } from '../../../src/eslint/rules/no-void-non-promise';

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

describe('no-void-non-promise', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    ruleTester.run('no-void-non-promise', noVoidNonPromise as any, {
        valid: [
            {
                name: 'other unary operators are ignored',
                filename,
                code: 'declare const n : number; const negative = -n; const flipped = !n; const typed = typeof n;'
            },
            {
                name: 'void on a Promise subclass instance',
                filename,
                code: `declare class Deferred extends Promise<void> {}; declare const deferred : Deferred; declare const noop : () => void; void deferred.catch(noop);`
            },
            {
                name: 'void on async function call',
                filename,
                code: 'declare function doSomething() : Promise<void>; void doSomething();'
            },
            {
                name: 'void on promise with .catch()',
                filename,
                code: `declare function doSomething() : Promise<void>; declare const noop : () => void; void doSomething().catch(noop);`
            },
            {
                name: 'void on promise with .then().catch()',
                filename,
                code: `declare function doSomething() : Promise<void>; declare const noop : () => void; void doSomething().then(noop).catch(noop);`
            },
            {
                name: 'void 0 (idiomatic undefined)',
                filename,
                code: 'void 0;'
            },
            {
                name: 'void on identifier (not a call expression)',
                filename,
                code: 'declare const someValue : string; void someValue;'
            }
        ],

        invalid: [
            {
                name:   'void on synchronous function returning number',
                filename,
                code:   'declare function getCount() : number; void getCount();',
                errors: [ { messageId: 'voidNonPromise' as const } ]
            },
            {
                name:   'void on synchronous function returning void',
                filename,
                code:   'declare function doSync() : void; void doSync();',
                errors: [ { messageId: 'voidNonPromise' as const } ]
            },
            {
                name: 'void on method chain returning non-promise',
                filename,
                code: `
                    declare function getBuffer() : { push(x : unknown) : number };
                    void getBuffer().push("test");
                `,
                errors: [ { messageId: 'voidNonPromise' as const } ]
            },
            {
                name:   'void on Map.clear()',
                filename,
                code:   'declare const map : Map<string, string>; void map.clear();',
                errors: [ { messageId: 'voidNonPromise' as const } ]
            }
        ]
    });
});
