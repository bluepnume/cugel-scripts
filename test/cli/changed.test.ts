import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FixtureCopy } from '../helpers';

import { changedSources } from '../../src';
import { copyFixture, gitInit } from '../helpers';

describe('changedSources', () => {
    let fixture : FixtureCopy;

    beforeAll(async () => {
        fixture = await copyFixture({ name: 'sample' });
        await gitInit({ root: fixture.root });
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    it('is empty on a clean tree', async () => {
        expect(await changedSources({ root: fixture.root })).toEqual([]);
    });

    it('lists modified, untracked and ignores deleted and non-TypeScript files', async () => {
        await writeFile(path.join(fixture.root, 'src', 'greet.ts'), '// changed\n');
        await writeFile(path.join(fixture.root, 'src', 'new.ts'), 'export const fresh = 1;\n');
        await writeFile(path.join(fixture.root, 'notes.md'), 'ignored\n');
        await rm(path.join(fixture.root, 'src', 'shout.ts'));

        expect(await changedSources({ root: fixture.root })).toEqual([ 'src/greet.ts', 'src/new.ts' ]);
    });

    it('throws outside a git repository', async () => {
        await expect(changedSources({ root: '/' })).rejects.toThrow(/git failed/);
    });
});
