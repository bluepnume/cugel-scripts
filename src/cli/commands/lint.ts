import type { CliContext } from '../context';

import { binPath, runOrThrow } from '../../lib';
import { changedSources } from '../changed';
import { hasFlag, positionals } from '../context';

// eslint, optionally fixing, optionally only on git-changed files.
export const lintCommand = async ({ root, args, log } : CliContext) : Promise<void> => {
    const fix = hasFlag({ args, flag: '--fix' });
    const changed = hasFlag({ args, flag: '--changed' });
    const explicit = positionals({ args });

    const files = changed
        ? await changedSources({ root })
        : explicit;

    if (changed && files.length === 0) {
        log('No changed .ts/.tsx files to lint');
        return;
    }

    await runOrThrow({
        name:    'eslint',
        command: binPath({ root, name: 'eslint' }),
        args:    [
            ...fix
                ? [ '--fix' ]
                : [],
            ...files.length > 0
                ? files
                : [ '.' ]
        ],
        cwd: root
    });
};
