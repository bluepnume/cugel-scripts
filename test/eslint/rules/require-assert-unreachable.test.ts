import { RuleTester } from 'eslint';
import { resolve } from 'node:path';

// eslint-disable-next-line no-restricted-syntax
import { requireAssertUnreachable } from '../../../src/eslint/rules/require-assert-unreachable';

import parser from '@typescript-eslint/parser';

const tsconfigRootDir = resolve(import.meta.dirname, '../../..');

// RuleTester uses a virtual filename; point to a real file the tsconfig includes.
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

const ENUM_DECL = `enum STATUS { ACTIVE = 'active', INACTIVE = 'inactive' }`;

describe('require-assert-unreachable', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    ruleTester.run('require-assert-unreachable', requireAssertUnreachable as any, {
        valid: [
            {
                name: 'switch on a nullable enum with a block-wrapped assertUnreachable default',
                filename,
                code: `
                    declare const assertUnreachable : (x : never) => Error;
                    declare const doX : () => void;
                    ${ ENUM_DECL }
                    declare const status : STATUS | undefined | null;
                    switch (status) {
                        case STATUS.ACTIVE: doX(); break;
                        case STATUS.INACTIVE: doX(); break;
                        case undefined: doX(); break;
                        case null: doX(); break;
                        default: { ; throw assertUnreachable(status); }
                    }
                `
            },
            {
                name: 'switch on a string union is not an enum switch',
                filename,
                code: `
                    declare const doX : () => void;
                    declare const kind : 'a' | 'b';
                    switch (kind) {
                        case 'a': doX(); break;
                        case 'b': doX(); break;
                    }
                `
            },
            {
                name: 'switch on a union mixing an enum and a string literal is not an enum switch',
                filename,
                code: `
                    declare const doX : () => void;
                    ${ ENUM_DECL }
                    declare const value : STATUS | 'other';
                    switch (value) {
                        case STATUS.ACTIVE: doX(); break;
                        default: doX();
                    }
                `
            },
            {
                name: 'switch on only undefined is not an enum switch',
                filename,
                code: `
                    declare const doX : () => void;
                    declare const value : undefined;
                    switch (value) {
                        default: doX();
                    }
                `
            },
            {
                name: 'enum switch with assertUnreachable default',
                filename,
                code: `
                    declare const assertUnreachable : (x : never) => Error;
                    declare const doX : () => void;
                    declare const doY : () => void;
                    ${ ENUM_DECL }
                    declare const status : STATUS;
                    switch (status) {
                        case STATUS.ACTIVE: doX(); break;
                        case STATUS.INACTIVE: doY(); break;
                        default: throw assertUnreachable(status);
                    }
                `
            },
            {
                name: 'enum switch with assertUnreachable inside a block default',
                filename,
                code: `
                    declare const assertUnreachable : (x : never) => Error;
                    declare const doX : () => void;
                    ${ ENUM_DECL }
                    declare const status : STATUS;
                    switch (status) {
                        case STATUS.ACTIVE: doX(); break;
                        case STATUS.INACTIVE: doX(); break;
                        default: { throw assertUnreachable(status); }
                    }
                `
            },
            {
                name: 'switch over a string variable is ignored',
                filename,
                code: `
                    declare const label : string;
                    declare const doX : () => void;
                    declare const doDefault : () => void;
                    switch (label) {
                        case 'foo': doX(); break;
                        case 'bar': doX(); break;
                        default: doDefault();
                    }
                `
            },
            {
                name: 'switch over a string variable whose cases use enum-like constants is ignored',
                filename,
                code: `
                    ${ ENUM_DECL }
                    declare const configName : string;
                    declare const handle : () => void;
                    declare const handleUnknown : () => void;
                    switch (configName) {
                        case STATUS.ACTIVE: handle(); break;
                        case STATUS.INACTIVE: handle(); break;
                        default: handleUnknown();
                    }
                `
            },
            {
                name: 'switch over a number is ignored',
                filename,
                code: `
                    declare const n : number;
                    declare const doX : () => void;
                    switch (n) {
                        case 1: doX(); break;
                        case 2: doX(); break;
                    }
                `
            }
        ],

        invalid: [
            {
                name: 'enum switch whose default throws a call to a different function',
                filename,
                code: `
                    declare const doX : () => void;
                    declare const other : (x : unknown) => Error;
                    ${ ENUM_DECL }
                    declare const status : STATUS;
                    switch (status) {
                        case STATUS.ACTIVE: doX(); break;
                        default: throw other(status);
                    }
                `,
                errors: [ { messageId: 'wrongDefaultBody' as const } ]
            },
            {
                name: 'enum switch missing a default case',
                filename,
                code: `
                    declare const doX : () => void;
                    ${ ENUM_DECL }
                    declare const status : STATUS;
                    switch (status) {
                        case STATUS.ACTIVE: doX(); break;
                        case STATUS.INACTIVE: doX(); break;
                    }
                `,
                errors: [ { messageId: 'missingDefault' as const } ]
            },
            {
                name: 'enum switch with non-throw default',
                filename,
                code: `
                    declare const doX : () => void;
                    declare const doSomethingElse : () => void;
                    ${ ENUM_DECL }
                    declare const status : STATUS;
                    switch (status) {
                        case STATUS.ACTIVE: doX(); break;
                        default: doSomethingElse();
                    }
                `,
                errors: [ { messageId: 'wrongDefaultBody' as const } ]
            },
            {
                name: 'enum switch with throw of something other than assertUnreachable',
                filename,
                code: `
                    declare const doX : () => void;
                    ${ ENUM_DECL }
                    declare const status : STATUS;
                    switch (status) {
                        case STATUS.ACTIVE: doX(); break;
                        default: throw new Error('nope');
                    }
                `,
                errors: [ { messageId: 'wrongDefaultBody' as const } ]
            },
            {
                name: 'enum switch where assertUnreachable call is missing the throw',
                filename,
                code: `
                    declare const assertUnreachable : (x : never) => Error;
                    declare const doX : () => void;
                    ${ ENUM_DECL }
                    declare const status : STATUS;
                    switch (status) {
                        case STATUS.ACTIVE: doX(); break;
                        default: assertUnreachable(status);
                    }
                `,
                errors: [ { messageId: 'wrongDefaultBody' as const } ]
            },
            {
                name: 'enum switch with member-call assertUnreachable is rejected',
                filename,
                code: `
                    declare const util : { assertUnreachable : (x : never) => Error };
                    declare const doX : () => void;
                    ${ ENUM_DECL }
                    declare const status : STATUS;
                    switch (status) {
                        case STATUS.ACTIVE: doX(); break;
                        default: throw util.assertUnreachable(status);
                    }
                `,
                errors: [ { messageId: 'wrongDefaultBody' as const } ]
            },
            {
                name: 'enum-or-undefined switch missing default is still flagged',
                filename,
                code: `
                    declare const doX : () => void;
                    ${ ENUM_DECL }
                    declare const status : STATUS | undefined;
                    switch (status) {
                        case STATUS.ACTIVE: doX(); break;
                        case undefined: doX(); break;
                    }
                `,
                errors: [ { messageId: 'missingDefault' as const } ]
            }
        ]
    });
});
