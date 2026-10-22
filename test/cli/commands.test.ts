/* eslint-disable no-template-curly-in-string -- test inputs contain literal placeholders */
import { readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FixtureCopy } from '../helpers';

import { cli } from '../../src';
import { copyFixture, gitInit } from '../helpers';

type RunCliOptions = { root : string, argv : ReadonlyArray<string> };

const runCli = async ({ root, argv } : RunCliOptions) : Promise<{ code : number, output : string }> => {
    const lines : Array<string> = [];
    const { code } = await cli({ argv, cwd: root, log: line => lines.push(line) });

    return { code, output: lines.join('\n') };
};

describe('commands on a clean fixture project', () => {
    let fixture : FixtureCopy;

    beforeAll(async () => {
        fixture = await copyFixture({ name: 'sample' });
        await gitInit({ root: fixture.root });
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    it('static passes end to end (tsc, lint, imports, circular, dead)', async () => {
        const result = await runCli({ root: fixture.root, argv: [ 'static' ] });

        expect(result.output).toContain('[tsc] ok');
        expect(result.output).toContain('[lint] ok');
        expect(result.output).toContain('[imports] ok');
        expect(result.output).toContain('[circular] ok');
        expect(result.output).toContain('[dead] ok');
        expect(result.code).toBe(0);
    }, 120_000);

    it('static --serial --changed reports nothing to lint on a clean tree', async () => {
        const result = await runCli({ root: fixture.root, argv: [ 'static', '--serial', '--changed' ] });

        expect(result.code).toBe(0);
        expect(result.output).toContain('[lint] No changed .ts/.tsx files to lint');
        expect(result.output).toContain('[imports] No changed .ts/.tsx files to format imports in');
    }, 120_000);

    it('test runs the fixture vitest suite', async () => {
        const result = await runCli({ root: fixture.root, argv: [ 'test' ] });

        expect(result.code).toBe(0);
    }, 120_000);

    it('build compiles to dist', async () => {
        const result = await runCli({ root: fixture.root, argv: [ 'build' ] });

        expect(result.code).toBe(0);
        expect(result.output).toContain('Built 3 file(s) into dist');
        await expect(stat(path.join(fixture.root, 'dist', 'src', 'index.js'))).resolves.toBeTruthy();
    }, 120_000);

    it('build honours cugel.config.ts', async () => {
        await writeFile(path.join(fixture.root, 'cugel.config.ts'), `export default { build: { outDir: 'out' } };\n`);

        try {
            const result = await runCli({ root: fixture.root, argv: [ 'build' ] });

            expect(result.code).toBe(0);
            expect(result.output).toContain('into out');
            await expect(stat(path.join(fixture.root, 'out', 'src', 'index.js'))).resolves.toBeTruthy();
        } finally {
            await rm(path.join(fixture.root, 'cugel.config.ts'), { force: true });
            await rm(path.join(fixture.root, 'out'), { recursive: true, force: true });
        }
    }, 120_000);

    it('build tolerates a cugel.config.ts with no build section', async () => {
        await writeFile(path.join(fixture.root, 'cugel.config.ts'), `export default {};\n`);

        try {
            const result = await runCli({ root: fixture.root, argv: [ 'build' ] });

            expect(result.code).toBe(0);
            expect(result.output).toContain('into dist');
        } finally {
            await rm(path.join(fixture.root, 'cugel.config.ts'), { force: true });
        }
    }, 120_000);

    it('dead:deps passes on the fixture', async () => {
        const result = await runCli({ root: fixture.root, argv: [ 'dead:deps' ] });

        expect(result.code).toBe(0);
    }, 60_000);

    it('imports:missing with nothing to do explains usage', async () => {
        const result = await runCli({ root: fixture.root, argv: [ 'imports:missing' ] });

        expect(result.code).toBe(0);
        expect(result.output).toContain('Usage: cugel-scripts imports:missing');

        const changed = await runCli({ root: fixture.root, argv: [ 'imports:missing', '--changed' ] });

        expect(changed.output).toContain('No changed .ts/.tsx files to add missing imports to');
    });
});

describe('commands on a fixture with problems', () => {
    let fixture : FixtureCopy;

    beforeAll(async () => {
        fixture = await copyFixture({ name: 'sample' });
        await gitInit({ root: fixture.root });
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    it('lint fails on a style violation and fix repairs it', async () => {
        const file = path.join(fixture.root, 'src', 'greet.ts');
        const original = await readFile(file, 'utf8');

        await writeFile(file, original.replace('`Hello, ${ name }!`', '`Hello, ${name}!`'));

        const failed = await runCli({ root: fixture.root, argv: [ 'lint', '--changed' ] });

        expect(failed.code).toBe(1);

        const fixed = await runCli({ root: fixture.root, argv: [ 'fix', '--changed' ] });

        expect(fixed.code).toBe(0);
        expect(await readFile(file, 'utf8')).toBe(original);
    }, 120_000);

    it('imports --check fails on misordered imports and --fix reorders them', async () => {
        const file = path.join(fixture.root, 'src', 'shout.ts');
        const original = await readFile(file, 'utf8');

        await writeFile(file, `import path from 'node:path';\n${ original }\nexport const SEP = path.sep;\n`);
        await writeFile(file, (await readFile(file, `utf8`)).replace('import path from \'node:path\';\nimport { greet } from \'./greet\';', 'import { greet } from \'./greet\';\nimport path from \'node:path\';'));

        const failed = await runCli({ root: fixture.root, argv: [ 'imports', file ] });

        expect(failed.code).toBe(1);

        const fixed = await runCli({ root: fixture.root, argv: [ 'imports', '--fix', file ] });

        expect(fixed.code).toBe(0);
        expect(await readFile(file, `utf8`)).toMatch(/^import path from 'node:path';\n\nimport { greet } from '.\/greet';/);

        await writeFile(file, original);
    }, 60_000);

    it('tsc fails on a type error', async () => {
        const file = path.join(fixture.root, 'src', 'broken.ts');

        await writeFile(file, 'export const broken : number = "nope";\n');

        const result = await runCli({ root: fixture.root, argv: [ 'tsc' ] });

        expect(result.code).toBe(1);

        await rm(file);
    }, 60_000);

    it('circular fails on an import cycle', async () => {
        const a = path.join(fixture.root, 'src', 'cycle-a.ts');
        const b = path.join(fixture.root, 'src', 'cycle-b.ts');

        await writeFile(a, `import { b } from './cycle-b';\n\nexport const a = () : number => b() + 1;\n`);
        await writeFile(b, `import { a } from './cycle-a';\n\nexport const b = () : number => a() + 1;\n`);

        const result = await runCli({ root: fixture.root, argv: [ 'circular' ] });

        expect(result.code).toBe(1);

        await rm(a);
        await rm(b);
    }, 60_000);

    it('imports:missing adds the import a file is missing', async () => {
        const file = path.join(fixture.root, 'src', 'needs-import.ts');

        await writeFile(file, `export const loud = () : string => shout({ name: 'x' });\n`);

        const result = await runCli({ root: fixture.root, argv: [ 'imports:missing', file ] });

        expect(result.code).toBe(0);
        expect(await readFile(file, 'utf8')).toMatch(/import \{ shout \} from '\.\/shout';/);

        await rm(file);
    }, 60_000);

    it('dead detects an unused export and dead --fix removes it', async () => {
        const file = path.join(fixture.root, 'src', 'orphan.ts');

        await writeFile(file, `export const orphan = 1;\n`);

        const detected = await runCli({ root: fixture.root, argv: [ 'dead' ] });

        expect(detected.code).toBe(1);

        const fixed = await runCli({ root: fixture.root, argv: [ 'dead', '--fix' ] });

        expect(fixed.code).toBe(0);
        expect(fixed.output).toContain('Clean!');
        await expect(stat(file)).rejects.toThrow();
    }, 180_000);
});

/* eslint-enable no-template-curly-in-string */
