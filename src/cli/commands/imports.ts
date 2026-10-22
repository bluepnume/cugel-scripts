import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

import type { CliContext } from '../context';

import { binPath, importSorterConfigArgs, runOrThrow } from '../../lib';
import { addMissingImports } from '../../scripts';
import { changedSources } from '../changed';
import { hasFlag, positionals } from '../context';

const DEFAULT_IMPORT_DIRS = [ 'src', 'test', 'scripts' ];

type DefaultImportTargetsOptions = {
    readonly root : string,
};

// The source directories that exist, plus the root-level .ts config files.
const defaultImportTargets = async ({ root } : DefaultImportTargetsOptions) : Promise<Array<string>> => {
    // eslint-disable-next-line n/no-sync -- cheap existence probe
    const dirs = DEFAULT_IMPORT_DIRS.filter(dir => existsSync(path.join(root, dir)));
    const rootFiles = (await readdir(root)).filter(name => name.endsWith('.ts') && !name.endsWith('.d.ts'));

    return [ ...dirs, ...rootFiles ];
};

// format-imports: check (default) or rewrite import grouping and order.
export const importsCommand = async ({ root, args, log } : CliContext) : Promise<void> => {
    const fix = hasFlag({ args, flag: '--fix' });
    const changed = hasFlag({ args, flag: '--changed' });
    const explicit = positionals({ args });

    const files = changed
        ? await changedSources({ root })
        : explicit;

    if (changed && files.length === 0) {
        log('No changed .ts/.tsx files to format imports in');
        return;
    }

    const targets = files.length > 0
        ? files
        : await defaultImportTargets({ root });

    // format-imports takes one path per invocation when fixing; checking
    // accepts several.
    if (fix) {
        for (const target of targets) {
            // eslint-disable-next-line no-await-in-loop -- sequential by design: each writes files
            await runOrThrow({
                name:    'format-imports',
                command: binPath({ root, name: 'format-imports' }),
                args:    [ ...importSorterConfigArgs({ root }), target ],
                cwd:     root
            });
        }

        return;
    }

    await runOrThrow({
        name:    'format-imports --check',
        command: binPath({ root, name: 'format-imports' }),
        args:    [ '--check', ...importSorterConfigArgs({ root }), ...targets ],
        cwd:     root
    });
};

// Adds missing imports via the TypeScript language service, then formats.
export const importsMissingCommand = async ({ root, args, log } : CliContext) : Promise<void> => {
    const all = hasFlag({ args, flag: '--all' });
    const changed = hasFlag({ args, flag: '--changed' });
    const explicit = positionals({ args });

    const files = changed
        ? await changedSources({ root })
        : explicit;

    if (!all && files.length === 0) {
        log(changed
            ? 'No changed .ts/.tsx files to add missing imports to'
            : 'Usage: cugel-scripts imports:missing (--all | --changed | <file>...)');

        return;
    }

    const updated = addMissingImports({
        root,
        files: all
            ? undefined
            : files,
        log
    });

    if (updated.length > 0) {
        await importsCommand({ root, args: [ '--fix', ...updated ], log });
    }
};
