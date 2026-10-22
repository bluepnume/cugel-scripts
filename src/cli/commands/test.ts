import type { CliContext } from '../context';

import { binPath, runOrThrow } from '../../lib';
import { hasFlag, positionals } from '../context';

export type VitestArgsOptions = {
    readonly args : ReadonlyArray<string>,
};

// `run` by default, `watch` with --watch; --coverage passes through and any
// positionals become test name filters.
export const vitestArgs = ({ args } : VitestArgsOptions) : Array<string> => [
    hasFlag({ args, flag: '--watch' })
        ? 'watch'
        : 'run',
    ...hasFlag({ args, flag: '--coverage' })
        ? [ '--coverage' ]
        : [],
    ...positionals({ args })
];

// vitest, one run, optionally with coverage (thresholds come from the
// consumer's vitest config).
export const testCommand = async ({ root, args } : CliContext) : Promise<void> => {
    await runOrThrow({
        name:    'vitest',
        command: binPath({ root, name: 'vitest' }),
        args:    vitestArgs({ args }),
        cwd:     root
    });
};
