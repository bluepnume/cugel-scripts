import { existsSync } from 'node:fs';
import path from 'node:path';

import type { CliContext } from '../context';

import { binPath, runOrThrow } from '../../lib';

const CANDIDATE_DIRS = [ 'src', 'test', 'scripts' ];

// Circular import detection (dpdm). Type-only imports are stripped first, so
// a cycle that exists only in the type graph is not reported.
export const circularCommand = async ({ root } : CliContext) : Promise<void> => {
    // eslint-disable-next-line n/no-sync -- cheap existence probe
    const dirs = CANDIDATE_DIRS.filter(dir => existsSync(path.join(root, dir)));

    await runOrThrow({
        name:    'dpdm --circular',
        command: binPath({ root, name: 'dpdm' }),
        args:    [ '--circular', '--no-tree', '--no-warning', '--transform', '--exit-code', 'circular:1', ...dirs.map(dir => `${ dir }/**/*.ts`) ],
        cwd:     root
    });
};
