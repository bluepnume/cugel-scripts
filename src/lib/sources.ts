import { readdir } from 'node:fs/promises';
import path from 'node:path';

const SOURCE_EXTENSIONS = new Set([ '.ts', '.tsx' ]);

const SKIPPED_DIRECTORIES = new Set([ 'node_modules', 'dist', 'coverage', '.git' ]);

export type ListSourcesOptions = {
    readonly dir : string,
    // Test files are excluded from builds but included in lint and type checks.
    readonly includeTests ?: boolean,
};

// Lists every TypeScript source file under `dir`, recursively, skipping
// declaration files and build output.
export const listSources = async ({ dir, includeTests = false } : ListSourcesOptions) : Promise<Array<string>> => {
    const entries = await readdir(dir, { withFileTypes: true });

    const isSource = (name : string) : boolean =>
        SOURCE_EXTENSIONS.has(path.extname(name)) &&
        !name.endsWith('.d.ts') &&
        (includeTests || !(/\.test\.tsx?$/).test(name));

    const nested = await Promise.all(entries
        .filter(entry => entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name))
        .map(entry => listSources({ dir: path.join(dir, entry.name), includeTests })));

    const files = entries
        .filter(entry => entry.isFile() && isSource(entry.name))
        .map(entry => path.join(dir, entry.name));

    return [ ...files, ...nested.flat() ].toSorted();
};
