import { spawn } from 'node:child_process';

export type RunResult = {
    readonly code : number,
    readonly stdout : string,
    readonly stderr : string,
};

export type RunOptions = {
    readonly command : string,
    readonly args ?: ReadonlyArray<string>,
    readonly cwd : string,
    readonly env ?: Readonly<Record<string, string | undefined>>,
    // 'inherit' streams straight to the terminal; 'capture' buffers for the
    // caller (used by the parallel runner to group output per job).
    readonly output ?: 'inherit' | 'capture',
};

export const run = ({ command, args = [], cwd, env, output = 'inherit' } : RunOptions) : Promise<RunResult> =>
    new Promise((resolve, reject) => {
        const child = spawn(command, [ ...args ], {
            cwd,
            env:   { ...process.env, ...env },
            stdio: output === 'inherit'
                ? 'inherit'
                : [ 'ignore', 'pipe', 'pipe' ]
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (chunk : Buffer) => {
            stdout += chunk.toString();
        });

        child.stderr?.on('data', (chunk : Buffer) => {
            stderr += chunk.toString();
        });

        child.on('error', reject);

        child.on('close', code => {
            resolve({ code: code ?? 1, stdout, stderr });
        });
    });

export type CommandFailedOptions = {
    readonly name : string,
    readonly code : number,
};

export class CommandFailedError extends Error {
    readonly code : number;

    constructor({ name, code } : CommandFailedOptions) {
        super(`${ name } failed with exit code ${ code }`);
        this.name = 'CommandFailedError';
        this.code = code;
    }
}

// Runs a command and throws if it exits non-zero.
export const runOrThrow = async (options : RunOptions & { readonly name : string }) : Promise<RunResult> => {
    const result = await run(options);

    if (result.code !== 0) {
        throw new CommandFailedError({ name: options.name, code: result.code });
    }

    return result;
};
