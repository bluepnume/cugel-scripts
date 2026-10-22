import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { publicEntries, removeEmptySources, runKnip, runTsUnusedExports } from '../../src';
import { collectLogs, copyFixture } from '../helpers';

describe('publicEntries', () => {
    let root : string;

    beforeEach(async () => {
        root = await mkdtemp(path.join(os.tmpdir(), 'cugel-entries-'));
    });

    afterEach(async () => {
        await rm(root, { recursive: true, force: true });
    });

    it('maps dist exports back to their sources, in string and object form', async () => {
        await writeFile(path.join(root, 'package.json'), JSON.stringify({
            exports: {
                '.':              { import: './dist/src/index.js', types: './dist/src/index.d.ts' },
                './eslint':       './dist/src/eslint/index.js',
                './tsconfig':     './tsconfig/base.json',
                './package.json': './package.json',
                './types-only':   { types: './dist/src/types.d.ts' }
            }
        }));

        expect(await publicEntries({ root })).toEqual([
            { path: 'src/index.ts', valueExports: true },
            { path: 'src/eslint/index.ts', valueExports: true }
        ]);
    });

    it('falls back to src/index.ts when package.json declares no dist exports', async () => {
        await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'x' }));

        expect(await publicEntries({ root })).toEqual([ { path: 'src/index.ts', valueExports: true } ]);
    });
});

describe('removeEmptySources', () => {
    let root : string;

    beforeEach(async () => {
        root = await mkdtemp(path.join(os.tmpdir(), 'cugel-empties-'));
        await mkdir(path.join(root, 'src', 'util'), { recursive: true });
        await mkdir(path.join(root, 'src', 'lone'), { recursive: true });
    });

    afterEach(async () => {
        await rm(root, { recursive: true, force: true });
    });

    it('removes whitespace-only files and drops their lines from a sibling barrel', async () => {
        await writeFile(path.join(root, 'src', 'util', 'index.ts'), `export * from './dead';\nexport * from './alive';\n`);
        await writeFile(path.join(root, 'src', 'util', 'dead.ts'), '\n\n');
        await writeFile(path.join(root, 'src', 'util', 'alive.ts'), 'export const alive = 1;\n');
        await writeFile(path.join(root, 'src', 'lone', 'orphan.ts'), '   ');
        await writeFile(path.join(root, 'src', 'index.ts'), '');

        const { lines, log } = collectLogs();

        await removeEmptySources({ root, log });

        await expect(stat(path.join(root, 'src', 'util', 'dead.ts'))).rejects.toThrow();
        await expect(stat(path.join(root, 'src', 'lone', 'orphan.ts'))).rejects.toThrow();
        await expect(stat(path.join(root, 'src', 'index.ts'))).rejects.toThrow();
        expect(await readFile(path.join(root, 'src', 'util', 'index.ts'), 'utf8')).toBe(`export * from './alive';\n`);
        expect(await readFile(path.join(root, 'src', 'util', 'alive.ts'), 'utf8')).toBe('export const alive = 1;\n');

        expect(lines.toSorted()).toEqual([
            'Removing empty file: src/index.ts',
            'Removing empty file: src/lone/orphan.ts',
            'Removing empty file: src/util/dead.ts'
        ]);
    });

    it('does nothing when there are no source directories', async () => {
        const empty = await mkdtemp(path.join(os.tmpdir(), 'cugel-nosrc-'));
        const { lines, log } = collectLogs();

        await removeEmptySources({ root: empty, log });

        expect(lines).toEqual([]);
        await rm(empty, { recursive: true, force: true });
    });
});

describe('runKnip and runTsUnusedExports', () => {
    it('throw on findings unless told to tolerate them', async () => {
        const fixture = await copyFixture({ name: 'sample' });

        try {
            await writeFile(path.join(fixture.root, 'src', 'orphan.ts'), 'export const orphan = 1;\n');

            await expect(runKnip({ root: fixture.root, tolerate: false })).rejects.toThrow(/knip failed/);
            await expect(runTsUnusedExports({ root: fixture.root, tolerate: false })).rejects.toThrow(/ts-unused-exports failed/);
            expect(await runKnip({ root: fixture.root, tolerate: true })).toBe(false);
            expect(await runTsUnusedExports({ root: fixture.root, tolerate: true })).toBe(false);
        } finally {
            await fixture.cleanup();
        }
    }, 60_000);
});
