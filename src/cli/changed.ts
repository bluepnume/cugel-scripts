import { run } from '../lib';

export type ChangedSourcesOptions = {
    readonly root : string,
};

// Files git considers changed relative to HEAD (modified, staged, or untracked
// and not ignored), filtered to TypeScript sources. Deleted files are left out
// because there is nothing left to check.
export const changedSources = async ({ root } : ChangedSourcesOptions) : Promise<Array<string>> => {
    const diff = await run({
        command: 'git',
        args:    [ 'diff', '--name-only', '--diff-filter=d', 'HEAD', '--', '*.ts', '*.tsx' ],
        cwd:     root,
        output:  'capture'
    });

    const untracked = await run({
        command: 'git',
        args:    [ 'ls-files', '--others', '--exclude-standard', '--', '*.ts', '*.tsx' ],
        cwd:     root,
        output:  'capture'
    });

    if (diff.code !== 0 || untracked.code !== 0) {
        throw new Error(`git failed listing changed files: ${ diff.stderr }${ untracked.stderr }`);
    }

    const files = [ ...diff.stdout.split('\n'), ...untracked.stdout.split('\n') ]
        .map(line => line.trim())
        .filter(line => line.length > 0);

    return [ ...new Set(files) ].toSorted();
};
