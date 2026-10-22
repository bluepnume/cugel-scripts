import type { CliContext } from '../context';

import { nativeTscBin, runOrThrow } from '../../lib';

// Type-checks the whole project with the native compiler. Always whole-project:
// an incremental or per-file check can't see a change's effect on its callers.
export const tscCommand = async ({ root } : CliContext) : Promise<void> => {
    await runOrThrow({
        name:    'tsc',
        command: nativeTscBin({ root }),
        args:    [ '--noEmit', '-p', 'tsconfig.json' ],
        cwd:     root
    });
};
