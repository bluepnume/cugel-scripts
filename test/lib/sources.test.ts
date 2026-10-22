import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { listSources } from '../../src';

describe('listSources', () => {
    let dir : string;

    beforeEach(async () => {
        dir = await mkdtemp(path.join(os.tmpdir(), 'cugel-sources-'));

        await mkdir(path.join(dir, 'nested', 'deeper'), { recursive: true });
        await mkdir(path.join(dir, 'node_modules', 'dep'), { recursive: true });
        await mkdir(path.join(dir, 'dist'), { recursive: true });

        await Promise.all([
            writeFile(path.join(dir, 'a.ts'), ''),
            writeFile(path.join(dir, 'b.tsx'), ''),
            writeFile(path.join(dir, 'a.test.ts'), ''),
            writeFile(path.join(dir, 'types.d.ts'), ''),
            writeFile(path.join(dir, 'readme.md'), ''),
            writeFile(path.join(dir, 'script.js'), ''),
            writeFile(path.join(dir, 'nested', 'c.ts'), ''),
            writeFile(path.join(dir, 'nested', 'deeper', 'd.ts'), ''),
            writeFile(path.join(dir, 'nested', 'deeper', 'd.test.tsx'), ''),
            writeFile(path.join(dir, 'node_modules', 'dep', 'index.ts'), ''),
            writeFile(path.join(dir, 'dist', 'a.ts'), '')
        ]);
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it('lists .ts and .tsx recursively, skipping tests, declarations, non-sources and build dirs', async () => {
        const files = await listSources({ dir });

        expect(files.map(file => path.relative(dir, file))).toEqual([
            'a.ts',
            'b.tsx',
            'nested/c.ts',
            'nested/deeper/d.ts'
        ]);
    });

    it('includes test files on request', async () => {
        const files = await listSources({ dir, includeTests: true });

        expect(files.map(file => path.relative(dir, file))).toEqual([
            'a.test.ts',
            'a.ts',
            'b.tsx',
            'nested/c.ts',
            'nested/deeper/d.test.tsx',
            'nested/deeper/d.ts'
        ]);
    });
});
