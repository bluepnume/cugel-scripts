import { createJiti } from 'jiti';
import { existsSync } from 'node:fs';
import path from 'node:path';

import type { BuildOptions } from '../../build';
import type { CliContext } from '../context';

import { build } from '../../build';

const CONFIG_FILE = 'cugel.config.ts';

// Reads optional per-repo build settings from cugel.config.ts (a default
// export of BuildOptions minus root), so the common case needs no file.
type LoadBuildOptionsOptions = {
    readonly root : string,
};

const loadBuildOptions = async ({ root } : LoadBuildOptionsOptions) : Promise<Omit<BuildOptions, 'root'>> => {
    const file = path.join(root, CONFIG_FILE);

    // eslint-disable-next-line n/no-sync -- cheap existence probe
    if (!existsSync(file)) {
        return {};
    }

    // jiti transpiles the TypeScript config and, with its cache off, re-reads
    // a config edited between builds in one process (tests, watchers).
    const jiti = createJiti(import.meta.url, { moduleCache: false });
    const loaded = await jiti.import<{ default ?: { build ?: Omit<BuildOptions, 'root'> } }>(file);

    return loaded.default?.build ?? {};
};

export const buildCommand = async ({ root, log } : CliContext) : Promise<void> => {
    const options = await loadBuildOptions({ root });
    const result = await build({ root, ...options });

    log(`Built ${ result.files.length } file(s) into ${ options.outDir ?? 'dist' }`);
};
