import type { CliContext } from '../context';

import { findUnusedRules } from '../../scripts';

// Prints rules the resolved eslint config leaves unmentioned, two per line.
export const rulesUnusedCommand = async ({ root, log } : CliContext) : Promise<void> => {
    const unused = await findUnusedRules({ root });

    if (unused.length === 0) {
        log('Every available rule is configured.');
        return;
    }

    log(`${ unused.length } unconfigured rule(s):`);

    for (let i = 0; i < unused.length; i += 2) {
        log(`${ (unused[i] ?? '').padEnd(48) }${ unused[i + 1] ?? '' }`);
    }
};
