import { existsSync } from 'node:fs';
import { copyFile, rm } from 'node:fs/promises';
import path from 'node:path';

import type { RootOptions } from './bins';

// This package's root, whether running from src/ (tsx) or dist/src/.
const packageRoot = () : string => {
    let dir = import.meta.dirname;

    for (;;) {
        // eslint-disable-next-line n/no-sync -- startup path resolution
        if (existsSync(path.join(dir, 'package.json')) && existsSync(path.join(dir, 'defaults'))) {
            return dir;
        }

        const parent = path.dirname(dir);

        if (parent === dir) {
            throw new Error(`Could not locate the cugel-scripts package root from ${ import.meta.dirname }`);
        }

        dir = parent;
    }
};

export type DefaultConfigOptions = {
    readonly root : string,
    // The file name of the packaged default, e.g. 'knip.json'.
    readonly name : string,
    // Files in the consumer's root that mean "the consumer has their own";
    // defaults to just `name`.
    readonly consumerFiles ?: ReadonlyArray<string>,
};

// The path of a packaged default config when the consumer has not written
// their own, so a fresh repo needs no knip.json or import-sorter.json. Returns
// undefined when the consumer's file exists and the tool should find it itself.
export const defaultConfigPath = ({
    root,
    name,
    consumerFiles = [ name ]
} : DefaultConfigOptions) : string | undefined => {
    // eslint-disable-next-line n/no-sync -- startup path resolution
    const hasOwn = consumerFiles.some(file => existsSync(path.join(root, file)));

    return hasOwn
        ? undefined
        : path.join(packageRoot(), 'defaults', name);
};

const KNIP_CONSUMER_FILES = [
    'knip.json', '.knip.json', 'knip.jsonc', '.knip.jsonc', 'knip.ts', 'knip.js', 'knip.config.ts', 'knip.config.js'
];

// knip resolves its patterns relative to the config file, so a packaged
// default has to be copied into the project for the duration of the run.
const KNIP_TEMP_CONFIG = '.knip.cugel-default.json';

export type MaterializedConfig = {
    readonly args : ReadonlyArray<string>,
    readonly cleanup : () => Promise<void>,
};

export const materializeKnipConfig = async ({ root } : RootOptions) : Promise<MaterializedConfig> => {
    const source = defaultConfigPath({ root, name: 'knip.json', consumerFiles: KNIP_CONSUMER_FILES });

    if (source === undefined) {
        return { args: [], cleanup: () => Promise.resolve() };
    }

    const target = path.join(root, KNIP_TEMP_CONFIG);

    await copyFile(source, target);

    return {
        args:    [ '--config', KNIP_TEMP_CONFIG ],
        cleanup: () => rm(target, { force: true })
    };
};

// format-imports merges the formatted file's own config over a base config,
// so the packaged default can be referenced where it is.
export const importSorterConfigArgs = ({ root } : RootOptions) : Array<string> => {
    const config = defaultConfigPath({ root, name: 'import-sorter.json' });

    return config === undefined
        ? []
        : [ '--config', config ];
};
