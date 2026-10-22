import type { CliContext } from '../context';

import { hasFlag } from '../context';

import { circularCommand } from './circular';
import { deadCommand } from './dead';
import { importsCommand } from './imports';
import { lintCommand } from './lint';
import { tscCommand } from './tsc';

type Job = {
    readonly name : string,
    readonly run : (context : CliContext) => Promise<void>,
};

const JOBS : ReadonlyArray<Job> = [
    { name: 'tsc', run: tscCommand },
    { name: 'lint', run: lintCommand },
    { name: 'imports', run: importsCommand },
    { name: 'circular', run: circularCommand },
    { name: 'dead', run: deadCommand }
];

const errorMessage = (err : unknown) : string => (err instanceof Error
    ? err.message
    : String(err));

// The whole static battery. Jobs run concurrently by default (each is its own
// process); --serial runs them one at a time for readable output. --changed
// narrows lint and imports to git-changed files; tsc, circular and dead are
// whole-project by nature.
export const staticCommand = async (context : CliContext) : Promise<void> => {
    const serial = hasFlag({ args: context.args, flag: '--serial' });
    const changed = hasFlag({ args: context.args, flag: '--changed' });

    const jobContext = (job : Job) : CliContext => ({
        ...context,
        args: changed && (job.name === 'lint' || job.name === 'imports')
            ? [ '--changed' ]
            : [],
        log: line => context.log(`[${ job.name }] ${ line }`)
    });

    const failures : Array<string> = [];

    const attempt = async (job : Job) : Promise<void> => {
        try {
            await job.run(jobContext(job));
            context.log(`[${ job.name }] ok`);
        } catch (err) {
            failures.push(job.name);
            context.log(`[${ job.name }] FAILED: ${ errorMessage(err) }`);
        }
    };

    if (serial) {
        for (const job of JOBS) {
            // eslint-disable-next-line no-await-in-loop -- serial mode is the point
            await attempt(job);
        }
    } else {
        await Promise.all(JOBS.map(job => attempt(job)));
    }

    if (failures.length > 0) {
        throw new Error(`Static checks failed: ${ failures.join(', ') }`);
    }
};
