import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FixtureCopy } from '../helpers';

import { addMissingImports } from '../../src';
import { collectLogs, copyFixture } from '../helpers';

describe('addMissingImports', () => {
    let fixture : FixtureCopy;

    beforeAll(async () => {
        fixture = await copyFixture({ name: 'sample' });
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    it('adds a relative import for a name defined in the repo', async () => {
        const file = path.join(fixture.root, 'src', 'needs.ts');

        await writeFile(file, `export const twice = () : string => greet({ name: 'a' }) + shout({ name: 'b' });\n`);

        const { lines, log } = collectLogs();
        const updated = addMissingImports({ root: fixture.root, files: [ file ], log });

        expect(updated).toEqual([ file ]);
        expect(lines).toEqual([ 'Updated src/needs.ts' ]);

        const content = await readFile(file, 'utf8');

        expect(content).toContain(`import { greet } from './greet';`);
        expect(content).toContain(`import { shout } from './shout';`);

        await rm(file);
    });

    it('still adds what it can when a name has no import candidate', async () => {
        const file = path.join(fixture.root, 'src', 'partial.ts');

        await writeFile(file, `export const both = () : string => greet({ name: String(noSuchThing) });\n`);

        const updated = addMissingImports({ root: fixture.root, files: [ file ] });

        expect(updated).toEqual([ file ]);
        expect(await readFile(file, 'utf8')).toContain(`from './greet'`);

        await rm(file);
    });

    it('leaves a file alone when nothing is missing, and scans the whole program with no file list', async () => {
        const untouched = await readFile(path.join(fixture.root, 'src', 'greet.ts'), 'utf8');

        const updated = addMissingImports({ root: fixture.root });

        expect(updated).toEqual([]);
        expect(await readFile(path.join(fixture.root, 'src', 'greet.ts'), 'utf8')).toBe(untouched);
    });

    it('throws when there is no tsconfig', () => {
        expect(() => addMissingImports({ root: '/', files: [ '/nothing.ts' ] })).toThrow(/No tsconfig.json found/);
    });
});
