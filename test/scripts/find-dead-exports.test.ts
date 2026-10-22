import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FixtureCopy } from '../helpers';

import { findDeadExports } from '../../src';
import { collectLogs, copyFixture } from '../helpers';

describe('findDeadExports', () => {
    let fixture : FixtureCopy;

    beforeAll(async () => {
        fixture = await copyFixture({ name: 'sample' });
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    it('reports nothing when every export reaches the public entry', () => {
        const { lines, log } = collectLogs();
        const result = findDeadExports({ root: fixture.root, log });

        expect(result.dead).toEqual([]);
        expect(lines).toEqual([ 'No dead exports found.' ]);
    });

    it('reports an export nothing imports, and distinguishes type-only entries', async () => {
        const helper = path.join(fixture.root, 'src', 'helper.ts');

        await writeFile(helper, [
            'export const usedInternally = 1;',
            'export const deadValue = 2;',
            'export type DeadType = string;',
            'export const consumer = () : number => usedInternally;',
            ''
        ].join('\n'));

        await writeFile(path.join(fixture.root, 'src', 'uses-helper.ts'), `import { consumer } from './helper';\n\nexport const result = consumer();\n`);
        await writeFile(path.join(fixture.root, 'src', 'public-only.ts'), `export const publicOnly = 1;\n`);
        await writeFile(path.join(fixture.root, 'src', 'index.ts'), `export * from './greet';\nexport * from './public-only';\nexport * from './shout';\n`);

        const { lines, log } = collectLogs();
        const result = findDeadExports({ root: fixture.root, log });

        expect(result.dead.map(entry => entry.name).toSorted()).toEqual([ 'DeadType', 'deadValue', 'result' ]);
        expect(lines[0]).toBe('3 dead export(s):');

        // With a type-only public entry, values reachable from it still count as dead.
        const typeOnly = findDeadExports({
            root:    fixture.root,
            entries: [ { path: 'src/index.ts', valueExports: false } ],
            log:     () => undefined
        });

        // `publicOnly` is reachable only through the entry, so it is dead once the
        // entry counts for types alone; `greet` is imported by shout.ts and the
        // GreetOptions type still reaches the entry, so both stay used.
        expect(typeOnly.dead.map(entry => entry.name)).toContain('publicOnly');
        expect(typeOnly.dead.map(entry => entry.name)).not.toContain('greet');
        expect(typeOnly.dead.map(entry => entry.name)).not.toContain('GreetOptions');
        expect(result.dead.map(entry => entry.name)).not.toContain('publicOnly');
    });

    it('--fix strips the export keyword from dead declarations', async () => {
        const { lines, log } = collectLogs();
        const result = findDeadExports({ root: fixture.root, fix: true, log });

        expect(result.removed).toBe(3);
        expect(result.skipped).toEqual([]);
        expect(lines[0]).toBe('Removed export keyword from 3 declaration(s) across 2 file(s).');

        const helper = await readFile(path.join(fixture.root, 'src', 'helper.ts'), 'utf8');

        expect(helper).toContain('const deadValue = 2;');
        expect(helper).toContain('type DeadType = string;');
        expect(helper).toContain('export const usedInternally');
    });

    it('honours explicit exclude paths and source directories', async () => {
        await writeFile(path.join(fixture.root, 'src', 'extra-dead.ts'), `export const extraDead = 1;\n`);

        const options = { root: fixture.root, sourceDirs: [ 'src' ], log: () => undefined };
        const everything = findDeadExports({ ...options, excludePaths: [] });
        const excluded = findDeadExports({ ...options, excludePaths: [ '/extra-dead.ts' ] });

        expect(everything.dead.map(entry => entry.name)).toContain('extraDead');
        expect(excluded.dead.map(entry => entry.name)).not.toContain('extraDead');

        const elsewhere = findDeadExports({ ...options, sourceDirs: [ 'test' ] });

        expect(elsewhere.dead).toEqual([]);
    });

    it('treats an export list as a reference to the declaration', async () => {
        await writeFile(path.join(fixture.root, 'src', 'listed.ts'), [
            'const listed = 1;',
            'export { listed };',
            ''
        ].join('\n'));

        const result = findDeadExports({ root: fixture.root, log: () => undefined });

        expect(result.dead.map(entry => entry.name)).not.toContain('listed');
    });

    it('treats namespace imports, dynamic imports and named re-exports as usage', async () => {
        await writeFile(path.join(fixture.root, 'src', 'wide.ts'), [
            'export const viaNamespace = 1;',
            'export const viaDynamic = 2;',
            'export const viaDestructuredDynamic = 3;',
            'export const viaNamedReexport = 4;',
            ''
        ].join('\n'));

        await writeFile(path.join(fixture.root, 'src', 'wide-consumer.ts'), [
            `import * as wide from './wide';`,
            `export { viaNamedReexport } from './wide';`,
            `export const all = async () : Promise<unknown> => {`,
            `    const whole = await import('./wide');`,
            `    const { viaDestructuredDynamic } = await import('./wide');`,
            `    return [ wide, whole, viaDestructuredDynamic ];`,
            `};`,
            ''
        ].join('\n'));

        const result = findDeadExports({ root: fixture.root, log: () => undefined });
        const names = result.dead.map(entry => entry.name);

        expect(names).not.toContain('viaNamespace');
        expect(names).not.toContain('viaDynamic');
        expect(names).not.toContain('viaDestructuredDynamic');
        expect(names).not.toContain('viaNamedReexport');
        expect(names).toContain('all');
    });
});
