import { existsSync } from 'node:fs';
import path from 'node:path';

export type CliContext = {
    readonly root : string,
    readonly args : ReadonlyArray<string>,
    readonly log : (line : string) => void,
};

export type FlagOptions = {
    readonly args : ReadonlyArray<string>,
    readonly flag : string,
};

export const hasFlag = ({ args, flag } : FlagOptions) : boolean =>
    args.includes(flag);

export type PositionalsOptions = {
    readonly args : ReadonlyArray<string>,
};

export const positionals = ({ args } : PositionalsOptions) : Array<string> =>
    args.filter(arg => !arg.startsWith('--'));

export type FindRootOptions = {
    readonly cwd : string,
};

// The consumer's project root: the nearest ancestor of cwd with a package.json.
export const findRoot = ({ cwd } : FindRootOptions) : string => {
    let dir = cwd;

    for (;;) {
        // eslint-disable-next-line n/no-sync -- startup path resolution
        if (existsSync(path.join(dir, 'package.json'))) {
            return dir;
        }

        const parent = path.dirname(dir);

        if (parent === dir) {
            throw new Error(`No package.json found above ${ cwd }`);
        }

        dir = parent;
    }
};
