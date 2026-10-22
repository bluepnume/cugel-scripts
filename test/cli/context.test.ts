import path from 'node:path';

import { findRoot, hasFlag, positionals } from '../../src';
import { CUGEL_ROOT } from '../helpers';

describe('hasFlag', () => {
    it('detects a flag anywhere in the args', () => {
        expect(hasFlag({ args: [ 'a', '--fix', 'b' ], flag: '--fix' })).toBe(true);
        expect(hasFlag({ args: [ 'a', 'b' ], flag: '--fix' })).toBe(false);
    });
});

describe('positionals', () => {
    it('drops anything starting with --', () => {
        expect(positionals({ args: [ `src/a.ts`, `--fix`, `src/b.ts`, `--changed` ] })).toEqual([ `src/a.ts`, `src/b.ts` ]);
    });
});

describe('findRoot', () => {
    it('returns the directory holding package.json', () => {
        expect(findRoot({ cwd: CUGEL_ROOT })).toBe(CUGEL_ROOT);
    });

    it('walks up from a nested directory', () => {
        expect(findRoot({ cwd: path.join(CUGEL_ROOT, 'src', 'cli', 'commands') })).toBe(CUGEL_ROOT);
    });

    it('throws when no package.json exists above', () => {
        expect(() => findRoot({ cwd: '/' })).toThrow(/No package.json found/);
    });
});
