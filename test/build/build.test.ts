import { build as esbuild } from 'esbuild';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FixtureCopy } from '../helpers';

import { build } from '../../src';
import { copyFixture } from '../helpers';

describe('build', () => {
    let fixture : FixtureCopy;

    beforeAll(async () => {
        fixture = await copyFixture({ name: 'sample' });
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    it('emits one ESM file per source with explicit .js import extensions, plus declarations', async () => {
        const result = await build({ root: fixture.root });

        expect(result.files.map(file => path.relative(fixture.root, file))).toEqual([
            'dist/src/greet.js',
            'dist/src/index.js',
            'dist/src/shout.js'
        ]);

        const index = await readFile(path.join(fixture.root, 'dist', 'src', 'index.js'), 'utf8');
        const shout = await readFile(path.join(fixture.root, 'dist', 'src', 'shout.js'), 'utf8');

        expect(index).toContain('from "./greet.js"');
        expect(index).toContain('from "./shout.js"');
        expect(shout).toContain('from "./greet.js"');
        expect(shout).not.toContain('Hello, ${');

        const declarations = await readdir(path.join(fixture.root, 'dist', 'src'));

        expect(declarations).toEqual(expect.arrayContaining([ `greet.d.ts`, `index.d.ts`, `shout.d.ts`, `greet.d.ts.map` ]));

        // The temporary tsconfig the declaration step writes is removed again.
        await expect(stat(path.join(fixture.root, 'tsconfig.cugel-build.json'))).rejects.toThrow();
    });

    it('produces output Node can import and run', async () => {
        const loaded = await import(path.join(fixture.root, `dist`, `src`, `index.js`)) as { greet : (opts : { name : string }) => string };

        expect(loaded.greet({ name: 'Node' })).toBe('Hello, Node!');
    });

    it('tree-shakes: a consumer importing only greet does not carry shout', async () => {
        const consumer = path.join(fixture.root, 'consumer.js');

        await writeFile(consumer, `import { greet } from './dist/src/index.js';\nconsole.log(greet({ name: 'x' }));\n`);

        const bundled = await esbuild({
            entryPoints: [ consumer ],
            bundle:      true,
            write:       false,
            format:      'esm',
            treeShaking: true
        });

        const output = bundled.outputFiles.map(file => file.text).join('\n');

        expect(output).toContain('Hello, ');
        expect(output).not.toContain('SHOUT_MARKER_FOR_TREE_SHAKING_TEST');
    });

    it('rewrites directory imports to /index.js and leaves extensioned and bare imports alone', async () => {
        await writeFile(path.join(fixture.root, 'src', 'extra.ts'), [
            `import { greet } from './index';`,
            `import { readFile } from 'node:fs/promises';`,
            `import data from './data.json';`,
            `export const extra = () : string => greet({ name: String(data) }) + String(readFile);`
        ].join('\n'));

        await writeFile(path.join(fixture.root, 'src', 'data.json'), '"json"');

        await build({ root: fixture.root, declarations: false });

        const extra = await readFile(path.join(fixture.root, 'dist', 'src', 'extra.js'), 'utf8');

        expect(extra).toContain('from "./index.js"');
        expect(extra).toContain('from "node:fs/promises"');
        expect(extra).toContain('from "./data.json"');
    });

    it('accepts every option explicitly', async () => {
        const result = await build({
            root:         fixture.root,
            sourceDirs:   [ 'src' ],
            outDir:       'dist',
            target:       'es2022',
            clean:        true,
            declarations: true
        });

        expect(result.files.length).toBeGreaterThanOrEqual(3);
        await expect(stat(path.join(fixture.root, 'dist', 'src', 'greet.d.ts'))).resolves.toBeTruthy();
    });

    it('can emit an optional single-file browser bundle with a global name', async () => {
        await build({
            root:         fixture.root,
            declarations: false,
            bundle:       { entry: 'src/index.ts', outfile: 'dist/sample.min.js', globalName: 'Sample' }
        });

        const bundle = await readFile(path.join(fixture.root, 'dist', 'sample.min.js'), 'utf8');

        expect(bundle).toContain('var Sample=');
        expect(bundle).toContain('Hello, ');
    });

    it('emits an esm bundle when no global name is given, unminified on request', async () => {
        await build({
            root:         fixture.root,
            declarations: false,
            clean:        false,
            bundle:       { entry: 'src/index.ts', outfile: 'dist/sample.esm.js', minify: false }
        });

        const bundle = await readFile(path.join(fixture.root, 'dist', 'sample.esm.js'), 'utf8');

        expect(bundle).toContain('export {');
        expect(bundle).toContain('Hello, ${');
    });
});
