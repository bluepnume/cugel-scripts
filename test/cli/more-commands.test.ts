import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { FixtureCopy } from '../helpers';

import { cli } from '../../src';
import { collectLogs, copyFixture, gitInit } from '../helpers';

describe('static in serial mode on a broken project', () => {
    let fixture : FixtureCopy;

    beforeAll(async () => {
        fixture = await copyFixture({ name: 'sample' });
        await gitInit({ root: fixture.root });
        await writeFile(path.join(fixture.root, 'src', 'broken.ts'), 'export const broken : number = "nope";\n');
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    it('reports each failing job and exits non-zero', async () => {
        const { lines, log } = collectLogs();
        const result = await cli({ argv: [ 'static', '--serial' ], cwd: fixture.root, log });
        const output = lines.join('\n');

        expect(result.code).toBe(1);
        expect(output).toContain('[tsc] FAILED: tsc failed with exit code');
        expect(output).toContain('[circular] ok');
        expect(lines.at(-1)).toMatch(/^Static checks failed: tsc/);

        await rm(path.join(fixture.root, 'src', 'broken.ts'));
    }, 120_000);

    it('fix without --changed runs over the whole project', async () => {
        const { log } = collectLogs();
        const result = await cli({ argv: [ 'fix' ], cwd: fixture.root, log });

        // Nothing to fix in the fixture; the broken file is a type error, not a lint one.
        expect(result.code).toBe(0);
    }, 120_000);

    it('test passes --coverage through to vitest', async () => {
        const { log } = collectLogs();
        const result = await cli({ argv: [ 'test', '--coverage' ], cwd: fixture.root, log });

        expect(result.code).toBe(0);
    }, 120_000);

    it('test passes a name filter through to vitest', async () => {
        const { log } = collectLogs();
        const result = await cli({ argv: [ 'test', 'greet' ], cwd: fixture.root, log });

        expect(result.code).toBe(0);
    }, 120_000);
});

describe('rules:unused on a sparse config', () => {
    let root : string;

    beforeAll(async () => {
        root = await mkdtemp(path.join(os.tmpdir(), 'cugel-sparse-'));
        await mkdir(path.join(root, 'src'));
        await writeFile(path.join(root, 'package.json'), '{ "name": "sparse", "type": "module" }\n');
        await writeFile(path.join(root, 'src', 'index.ts'), 'export const x = 1;\n');
        await writeFile(path.join(root, 'src', 'index.js'), 'export const x = 1;\n');

        await writeFile(path.join(root, `eslint.config.ts`), `export default [ { files: [ "**/*.ts" ], plugins: { bare: { rules: { nometa: { create: () => ({}) } } }, empty: {} }, rules: { eqeqeq: "error" } } ];
`);
    });

    afterAll(async () => {
        await rm(root, { recursive: true, force: true });
    });

    it('lists the core rules the config leaves out, two per line', async () => {
        const { lines, log } = collectLogs();
        const result = await cli({ argv: [ 'rules:unused' ], cwd: root, log });

        expect(result.code, lines.join('\n')).toBe(0);
        expect(lines[0]).toMatch(/^\d+ unconfigured rule\(s\):$/);
        expect(lines.join('\n')).toContain('no-var');
        expect(lines.join('\n')).toContain('bare/nometa');
        expect(lines.join('\n')).not.toMatch(/\beqeqeq\b/);
        expect(lines[1]).toMatch(/^\S+\s+\S+$/);
    }, 60_000);

    it('fails clearly when no config block applies to the sample file', async () => {
        await writeFile(path.join(root, `eslint.config.ts`), `export default [ { files: [ "**/*.js" ], rules: {} } ];
`);

        const { lines, log } = collectLogs();
        const result = await cli({ argv: [ 'rules:unused' ], cwd: root, log });

        expect(result.code).toBe(1);
        expect(lines.at(-1)).toMatch(/No eslint config applies to src\/index.ts/);
    }, 60_000);
});
