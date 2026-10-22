import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { binPath, findBin, nativeTscBin, packageDir } from '../../src';
import { CUGEL_ROOT } from '../helpers';

describe('findBin', () => {
    it('finds a binary under the root node_modules', () => {
        expect(findBin({ root: CUGEL_ROOT, relativePath: path.join('.bin', 'eslint') }))
            .toBe(path.join(CUGEL_ROOT, 'node_modules', '.bin', 'eslint'));
    });

    it('falls back to this package install when the root has no node_modules', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'cugel-bins-'));

        try {
            expect(findBin({ root, relativePath: path.join('.bin', 'eslint') }))
                .toBe(path.join(CUGEL_ROOT, 'node_modules', '.bin', 'eslint'));
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it('throws when nothing provides the binary', () => {
        expect(() => findBin({ root: CUGEL_ROOT, relativePath: path.join('.bin', 'no-such-tool-xyz') }))
            .toThrow(/Could not find/);
    });
});

describe('nativeTscBin', () => {
    it('points at the native compiler, not the JS one', () => {
        expect(nativeTscBin({ root: CUGEL_ROOT })).toBe(path.join(CUGEL_ROOT, `node_modules`, `@typescript`, `native`, `bin`, `tsc`));
    });
});

describe('binPath', () => {
    it('resolves a .bin entry by name', () => {
        expect(binPath({ root: CUGEL_ROOT, name: 'knip' })).toMatch(/node_modules\/\.bin\/knip$/);
    });
});

describe('packageDir', () => {
    it('resolves a dependency directory', () => {
        expect(packageDir('esbuild')).toBe(path.join(CUGEL_ROOT, 'node_modules', 'esbuild'));
    });
});
