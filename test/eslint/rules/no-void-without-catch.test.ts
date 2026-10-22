import { RuleTester } from 'eslint';
import { resolve } from 'node:path';

// eslint-disable-next-line no-restricted-syntax
import { noVoidWithoutCatch } from '../../../src/eslint/rules/no-void-without-catch';

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

// Helper: wraps test code with typed function declarations so the type
// checker has enough information to determine Promise vs non-Promise.
const withPromiseDeclarations = (code : string) : string => `
    declare function doSomething() : Promise<void>;
    declare function sendSlackNotification(ctx : unknown, opts : unknown) : Promise<void>;
    declare function insertMerchantRevenue(ctx : unknown, opts : unknown) : Promise<void>;
    declare function promiseTry<T>(fn : () => T) : Promise<Awaited<T>>;
    declare function foo() : Promise<void>;
    declare function bar(x : unknown) : unknown;
    declare function handleResult(x : unknown) : unknown;
    declare const errorTracker : (ctx : unknown, opts : unknown) => (err : unknown) => void;
    declare const noop : () => void;
    declare const context : unknown;
    declare const memoryPoolPromise : Promise<void>;
    ${ code }
`;

describe('no-void-without-catch', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    ruleTester.run('no-void-without-catch', noVoidWithoutCatch as any, {
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
                name: 'void with .catch(errorTracker(...))',
                filename,
                code: withPromiseDeclarations(
                    'void doSomething().catch(errorTracker(context, { type: "label" }));'
                )
            },
            {
                name: 'void with .catch(noop)',
                filename,
                code: withPromiseDeclarations(
                    'void doSomething().catch(noop);'
                )
            },
            {
                name: 'void with .catch() after chained call',
                filename,
                code: withPromiseDeclarations(
                    'void foo().then(bar).catch(errorTracker(context, { type: "label" }));'
                )
            },
            {
                name: 'void with .finally()',
                filename,
                code: withPromiseDeclarations(
                    'void memoryPoolPromise.finally(() => {});'
                )
            },
            {
                name: 'void 0 (not a call expression)',
                filename,
                code: 'void 0;'
            },
            {
                name: 'void on identifier (not a call expression)',
                filename,
                code: 'declare const someValue : string; void someValue;'
            },
            {
                name: 'awaited call (not fire-and-forget)',
                filename,
                code: withPromiseDeclarations(
                    'async function test() { await doSomething(); }'
                )
            },
            {
                name: 'void with .catch() with inline handler',
                filename,
                code: withPromiseDeclarations(
                    'void doSomething().catch(err => { console.error(err); });'
                )
            },
            {
                name: 'void on synchronous call (not a promise)',
                filename,
                code: `
                    declare function getBuffer() : { push(x : unknown) : number };
                    void getBuffer().push("test");
                `
            },
            {
                name: 'void on method returning non-promise',
                filename,
                code: `
                    declare const map : Map<string, string>;
                    void map.clear();
                `
            }
        ],

        invalid: [
            {
                name:   'void async call without .catch()',
                filename,
                code:   withPromiseDeclarations('void doSomething();'),
                errors: [ { messageId: 'missingCatch' as const } ]
            },
            {
                name:   'void async call with arguments without .catch()',
                filename,
                code:   withPromiseDeclarations('void sendSlackNotification(context, { message: "hello" });'),
                errors: [ { messageId: 'missingCatch' as const } ]
            },
            {
                name:   'void promiseTry without .catch()',
                filename,
                code:   withPromiseDeclarations('void promiseTry(async () => { await foo(); });'),
                errors: [ { messageId: 'missingCatch' as const } ]
            },
            {
                name:   'void chained .then() without .catch()',
                filename,
                code:   withPromiseDeclarations('void doSomething().then(handleResult);'),
                errors: [ { messageId: 'missingCatch' as const } ]
            }
        ]
    });
});
