import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const CUGEL_ROOT = path.resolve(import.meta.dirname, '..');

export const FIXTURES = path.join(CUGEL_ROOT, 'test', 'fixtures');

export type FixtureCopy = {
    readonly root : string,
    readonly cleanup : () => Promise<void>,
};

const TEMPLATE_SUFFIX = '.template';

// Copies a fixture project to a temp dir (so tests can mutate it) and fills
// in the template files that need an absolute path back to this repo.
type CopyFixtureOptions = { readonly name : string };

export const copyFixture = async ({ name } : CopyFixtureOptions) : Promise<FixtureCopy> => {
    const root = await mkdtemp(path.join(os.tmpdir(), `cugel-${ name }-`));

    await cp(path.join(FIXTURES, name), root, { recursive: true });

    // A real consumer has cugel-scripts' dependencies in its node_modules;
    // the copy borrows this repo's install for the same effect.
    await symlink(path.join(CUGEL_ROOT, 'node_modules'), path.join(root, 'node_modules'), 'dir');

    for (const template of [ 'tsconfig.template.json', 'eslint.config.template.ts', 'vitest.config.template.ts' ]) {
        const source = path.join(root, template);
        const target = path.join(root, template.replace(TEMPLATE_SUFFIX, ''));
        // eslint-disable-next-line no-await-in-loop -- few files, sequential is fine
        const content = await readFile(source, 'utf8');

        // eslint-disable-next-line no-await-in-loop -- few files, sequential is fine
        await writeFile(target, content.replaceAll('__CUGEL_ROOT__', CUGEL_ROOT));
        // eslint-disable-next-line no-await-in-loop -- few files, sequential is fine
        await rm(source);
    }

    return {
        root,
        cleanup: () => rm(root, { recursive: true, force: true })
    };
};

// Initialises a git repo with everything committed, so "changed files" tests
// start from a clean baseline.
type GitInitOptions = { readonly root : string };

export const gitInit = async ({ root } : GitInitOptions) : Promise<void> => {
    const { run } = await import('../src/lib');

    const git = async (args : ReadonlyArray<string>) : Promise<void> => {
        const result = await run({ command: 'git', args, cwd: root, output: 'capture' });

        if (result.code !== 0) {
            throw new Error(`git ${ args.join(' ') } failed: ${ result.stderr }`);
        }
    };

    await git([ 'init', '-q' ]);
    await git([ 'config', 'user.email', 'test@example.com' ]);
    await git([ 'config', 'user.name', 'Test' ]);
    await git([ 'add', '-A' ]);
    await git([ 'commit', '-q', '-m', 'init' ]);
};

export const collectLogs = () : { readonly lines : Array<string>, readonly log : (line : string) => void } => {
    const lines : Array<string> = [];

    return { lines, log: line => lines.push(line) };
};
