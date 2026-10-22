import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// Walks up from `from` looking for `node_modules/<relativePath>`.
type FindUpOptions = {
    readonly from : string,
    readonly relativePath : string,
};

const findUp = ({ from, relativePath } : FindUpOptions) : string | undefined => {
    let dir = from;

    for (;;) {
        const candidate = path.join(dir, 'node_modules', relativePath);

        // eslint-disable-next-line n/no-sync -- startup path resolution
        if (existsSync(candidate)) {
            return candidate;
        }

        const parent = path.dirname(dir);

        if (parent === dir) {
            return undefined;
        }

        dir = parent;
    }
};

// Locates an executable installed under node_modules, searching from the
// consumer's root first and then from this package's own install location, so
// the CLI works whether cugel-scripts is a dependency or run from its own repo.
export type FindBinOptions = {
    readonly root : string,
    readonly relativePath : string,
};

export const findBin = ({ root, relativePath } : FindBinOptions) : string => {
    const found = findUp({ from: root, relativePath }) ?? findUp({ from: import.meta.dirname, relativePath });

    if (!found) {
        throw new Error(`Could not find ${ relativePath } under any node_modules from ${ root }`);
    }

    return found;
};

// The native (Go) TypeScript compiler. Resolved explicitly rather than via
// node_modules/.bin, because both the native and the JS compiler install a
// `tsc` bin and which one wins the symlink depends on install order.
export type RootOptions = {
    readonly root : string,
};

export const nativeTscBin = ({ root } : RootOptions) : string =>
    findBin({ root, relativePath: path.join('@typescript', 'native', 'bin', 'tsc') });

export type BinPathOptions = {
    readonly root : string,
    readonly name : string,
};

export const binPath = ({ root, name } : BinPathOptions) : string =>
    findBin({ root, relativePath: path.join('.bin', name) });

// Resolves a module's package directory from this package's own location.
export const packageDir = (name : string) : string => {
    const require = createRequire(import.meta.url);

    return path.dirname(require.resolve(`${ name }/package.json`));
};
