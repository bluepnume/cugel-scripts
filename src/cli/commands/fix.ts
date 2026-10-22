import type { CliContext } from '../context';

import { hasFlag } from '../context';

import { importsCommand } from './imports';
import { lintCommand } from './lint';

// Auto-fix: imports first (grouping and order), then eslint --fix (which
// includes the stylistic formatting rules).
export const fixCommand = async (context : CliContext) : Promise<void> => {
    const changed = hasFlag({ args: context.args, flag: '--changed' });

    const args = changed
        ? [ '--fix', '--changed' ]
        : [ '--fix' ];

    await importsCommand({ ...context, args });
    await lintCommand({ ...context, args });
};
