import { ESLint } from 'eslint';
import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { PublicEntry } from '../../scripts';
import type { CliContext } from '../context';

import { deadCodeEslintConfig } from '../../eslint';
import { binPath, listSources, materializeKnipConfig, run, runOrThrow } from '../../lib';
import { findDeadExports } from '../../scripts';
import { hasFlag } from '../context';

const MAX_FIX_ROUNDS = 5;

const TS_UNUSED_EXPORTS_EXCLUDES = 'dist;test;scripts;coverage;eslint.config.ts;vitest.config.ts';

type RootOptions = {
    readonly root : string,
};

type PackageExports = Record<string, string | { import ?: string }>;

const exportTarget = (value : string | { import ?: string }) : string | undefined => (typeof value === 'string'
    ? value
    : value.import);

// The package's public entry points, read from package.json `exports` (every
// subpath that maps to a dist/src file maps back to its source).
export const publicEntries = async ({ root } : RootOptions) : Promise<Array<PublicEntry>> => {
    const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
        exports ?: PackageExports,
    };

    const entries = Object.values(pkg.exports ?? {})
        .map(value => exportTarget(value))
        .filter((value) : value is string => value?.startsWith('./dist/') === true)
        .map(value => value.replace(/^\.\/dist\//, '').replace(/\.js$/, '.ts'))
        .map(file => ({ path: file, valueExports: true }));

    return entries.length > 0
        ? entries
        : [ { path: 'src/index.ts', valueExports: true } ];
};

type KnipArgsOptions = {
    readonly fix : boolean,
};

const knipArgs = ({ fix } : KnipArgsOptions) : Array<string> => [
    ...fix
        ? [ '--fix', '--allow-remove-files', '--fix-type', 'exports', '--fix-type', 'types', '--fix-type', 'files' ]
        : [],
    '--exclude', 'dependencies,unlisted'
];

export type ToolRunOptions = {
    readonly root : string,
    readonly fix ?: boolean,
    // When true a non-zero exit is reported as `false` instead of thrown,
    // which the fix loop uses to decide whether to go another round.
    readonly tolerate : boolean,
};

export const runKnip = async ({ root, fix = false, tolerate } : ToolRunOptions) : Promise<boolean> => {
    const config = await materializeKnipConfig({ root });

    let result;

    try {
        result = await run({
            command: binPath({ root, name: 'knip' }),
            args:    [ ...config.args, ...knipArgs({ fix }) ],
            cwd:     root
        });
    } finally {
        await config.cleanup();
    }

    if (!tolerate && result.code !== 0) {
        throw new Error(`knip failed with exit code ${ result.code }`);
    }

    return result.code === 0;
};

// A library's public entry points are consumed by nobody in the repo, so
// their exports are excluded from the unused-exports report.
export const runTsUnusedExports = async ({ root, tolerate } : ToolRunOptions) : Promise<boolean> => {
    const entries = await publicEntries({ root });
    const excludes = [ TS_UNUSED_EXPORTS_EXCLUDES, ...entries.map(entry => entry.path) ].join(';');

    const result = await run({
        command: binPath({ root, name: 'ts-unused-exports' }),
        args:    [
            'tsconfig.json',
            '--excludeDeclarationFiles',
            '--findCompletelyUnusedFiles',
            `--excludePathsFromReport=${ excludes }`
        ],
        cwd: root
    });

    if (!tolerate && result.code !== 0) {
        throw new Error(`ts-unused-exports failed with exit code ${ result.code }`);
    }

    return result.code === 0;
};

type DeadExportsOptions = {
    readonly root : string,
    readonly fix : boolean,
    readonly log : CliContext['log'],
};

const deadExports = async ({ root, fix, log } : DeadExportsOptions) : Promise<boolean> => {
    const entries = await publicEntries({ root });
    const result = findDeadExports({ root, entries, fix, log });

    return result.dead.length === 0;
};

type LogOptions = {
    readonly root : string,
    readonly log : CliContext['log'],
};

type ExistingDirsOptions = { readonly root : string, readonly dirs : ReadonlyArray<string> };

const existingDirs = ({ root, dirs } : ExistingDirsOptions) : Array<string> =>
    // eslint-disable-next-line n/no-sync -- cheap existence probe
    dirs.filter(dir => existsSync(path.join(root, dir)));

// Removes source files left empty by the fixers, and their barrel lines.
export const removeEmptySources = async ({ root, log } : LogOptions) : Promise<void> => {
    const dirs = existingDirs({ root, dirs: [ 'src', 'test' ] });

    const files = (await Promise.all(dirs.map(dir =>
        listSources({ dir: path.join(root, dir), includeTests: true })))).flat();

    const contents = await Promise.all(files.map(async file => ({ file, content: await readFile(file, 'utf8') })));
    const empties = contents.filter(({ content }) => content.trim().length === 0).map(({ file }) => file);

    await Promise.all(empties.map(async file => {
        log(`Removing empty file: ${ path.relative(root, file) }`);
        await rm(file);
    }));

    const barrels = new Map<string, Array<string>>();

    for (const file of empties) {
        const barrel = path.join(path.dirname(file), 'index.ts');

        if (barrel === file) {
            continue;
        }

        barrels.set(barrel, [ ...barrels.get(barrel) ?? [], path.basename(file, path.extname(file)) ]);
    }

    await Promise.all([ ...barrels ].map(async ([ barrel, bases ]) => {
        // eslint-disable-next-line n/no-sync -- cheap existence probe
        if (!existsSync(barrel)) {
            return;
        }

        const lines = (await readFile(barrel, 'utf8')).split('\n');
        const kept = lines.filter(line => !bases.some(base => line.includes(`from './${ base }'`)));

        await writeFile(barrel, kept.join('\n'));
    }));
};

// Collapses the locals and imports that stripping exports leaves unused.
const collapseUnusedLocals = async ({ root } : RootOptions) : Promise<void> => {
    const eslint = new ESLint({
        cwd:                root,
        overrideConfigFile: true,
        overrideConfig:     deadCodeEslintConfig(),
        fix:                true
    });

    const results = await eslint.lintFiles(existingDirs({ root, dirs: [ 'src', 'test' ] }));

    await ESLint.outputFixes(results);
};

const detect = async ({ root, log } : LogOptions) : Promise<boolean> => {
    const knipClean = await runKnip({ root, tolerate: true });
    const tsUnusedClean = await runTsUnusedExports({ root, tolerate: true });
    const exportsClean = await deadExports({ root, fix: false, log });

    return knipClean && tsUnusedClean && exportsClean;
};

const fixRound = async ({ root, log } : LogOptions) : Promise<boolean> => {
    await runKnip({ root, fix: true, tolerate: true });
    await deadExports({ root, fix: true, log });
    await collapseUnusedLocals({ root });
    await removeEmptySources({ root, log });

    return await detect({ root, log });
};

// Dead code detection: knip, ts-unused-exports and the barrel-aware dead
// export walker, all three. With --fix, loops the fixers until clean.
export const deadCommand = async ({ root, args, log } : CliContext) : Promise<void> => {
    const fix = hasFlag({ args, flag: '--fix' });

    if (!fix) {
        await runKnip({ root, tolerate: false });
        await runTsUnusedExports({ root, tolerate: false });

        if (!await deadExports({ root, fix: false, log })) {
            throw new Error('Dead exports found');
        }

        return;
    }

    for (let round = 1; round <= MAX_FIX_ROUNDS; round++) {
        log(`=== Dead code fix round ${ round } ===`);

        // eslint-disable-next-line no-await-in-loop -- each round depends on the last
        if (await fixRound({ root, log })) {
            log('Clean!');
            return;
        }

        log('Dead code remaining, running another round...');
    }

    throw new Error(`Still has dead code after ${ MAX_FIX_ROUNDS } rounds; run again or clean up manually`);
};

// Unused and unlisted dependencies, via knip.
export const deadDepsCommand = async ({ root, args } : CliContext) : Promise<void> => {
    const fix = hasFlag({ args, flag: '--fix' });
    const config = await materializeKnipConfig({ root });

    try {
        await runOrThrow({
            name:    'knip (dependencies)',
            command: binPath({ root, name: 'knip' }),
            args:    [
                ...config.args,
                ...fix
                    ? [ '--fix' ]
                    : [],
                '--include', 'dependencies,unlisted'
            ],
            cwd: root
        });
    } finally {
        await config.cleanup();
    }
};
