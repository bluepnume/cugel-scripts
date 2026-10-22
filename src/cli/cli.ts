import type { CliContext } from './context';

import {
    buildCommand, circularCommand, deadCommand, deadDepsCommand, fixCommand,
    importsCommand, importsMissingCommand, lintCommand, rulesUnusedCommand, staticCommand,
    testCommand, tscCommand
} from './commands';
import { findRoot } from './context';

export type Command = {
    readonly description : string,
    readonly run : (context : CliContext) => Promise<void>,
};

export const COMMANDS : Readonly<Record<string, Command>> = {
    'build': {
        description: 'Compile src/ to dist/ (per-file ESM + declarations)',
        run:         buildCommand
    },
    'circular': {
        description: 'Detect circular dependencies (dpdm)',
        run:         circularCommand
    },
    'dead': {
        description: 'Detect dead code (knip, ts-unused-exports, dead exports); --fix removes it',
        run:         deadCommand
    },
    'dead:deps': {
        description: 'Detect unused / unlisted dependencies (knip); --fix removes them',
        run:         deadDepsCommand
    },
    'fix': {
        description: 'Fix imports then eslint --fix; --changed limits to git-changed files',
        run:         fixCommand
    },
    'imports': {
        description: 'Check import formatting; --fix rewrites; --changed limits to git-changed files',
        run:         importsCommand
    },
    'imports:missing': {
        description: 'Add missing imports (--all | --changed | <files>)',
        run:         importsMissingCommand
    },
    'lint': {
        description: 'eslint; --fix, --changed',
        run:         lintCommand
    },
    'rules:unused': {
        description: 'List eslint rules the config does not mention',
        run:         rulesUnusedCommand
    },
    'static': {
        description: 'tsc + lint + imports + circular + dead; --changed, --serial',
        run:         staticCommand
    },
    'test': {
        description: 'vitest run; --coverage, --watch, <filters>',
        run:         testCommand
    },
    'tsc': {
        description: 'Type-check with the native TypeScript compiler',
        run:         tscCommand
    }
};

export const usage = () : string => [
    'Usage: cugel-scripts <command> [options]',
    '',
    ...Object.entries(COMMANDS).map(([ name, { description } ]) => `  ${ name.padEnd(18) }${ description }`)
].join('\n');

export type CliResult = {
    readonly code : number,
};

export type CliOptions = {
    readonly argv : ReadonlyArray<string>,
    readonly cwd : string,
    readonly log : (line : string) => void,
};

// Dispatches one command. Returns an exit code rather than calling
// process.exit, so it is testable in-process.
export const cli = async ({ argv, cwd, log } : CliOptions) : Promise<CliResult> => {
    const [ name, ...args ] = argv;

    if (name === undefined) {
        log(usage());
        return { code: 1 };
    }

    if (name === '--help' || name === '-h') {
        log(usage());
        return { code: 0 };
    }

    const command = COMMANDS[name];

    if (command === undefined) {
        log(`Unknown command: ${ name }\n\n${ usage() }`);
        return { code: 1 };
    }

    try {
        await command.run({ root: findRoot({ cwd }), args, log });
        return { code: 0 };
    } catch (err) {
        log(err instanceof Error
            ? err.message
            : String(err));

        return { code: 1 };
    }
};
