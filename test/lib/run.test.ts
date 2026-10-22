import { CommandFailedError, run, runOrThrow } from '../../src';

describe('run', () => {
    it('captures stdout and the exit code', async () => {
        const result = await run({ command: `node`, args: [ `-e`, `process.stdout.write("hi")` ], cwd: process.cwd(), output: `capture` });

        expect(result).toEqual({ code: 0, stdout: 'hi', stderr: '' });
    });

    it('captures stderr and a non-zero exit code', async () => {
        const result = await run({
            command: 'node',
            args:    [ '-e', 'process.stderr.write("bad"); process.exit(3)' ],
            cwd:     process.cwd(),
            output:  'capture'
        });

        expect(result.code).toBe(3);
        expect(result.stderr).toBe('bad');
    });

    it('passes env through to the child', async () => {
        const result = await run({
            command: 'node',
            args:    [ '-e', 'process.stdout.write(process.env.CUGEL_TEST_VAR ?? "")' ],
            cwd:     process.cwd(),
            env:     { CUGEL_TEST_VAR: 'set' },
            output:  'capture'
        });

        expect(result.stdout).toBe('set');
    });

    it('rejects when the command cannot be spawned', async () => {
        await expect(run({ command: `/definitely/not/a/real/binary`, cwd: process.cwd(), output: `capture` })).rejects.toThrow();
    });

    it('inherits stdio by default without capturing', async () => {
        const result = await run({ command: 'node', args: [ '-e', '' ], cwd: process.cwd() });

        expect(result).toEqual({ code: 0, stdout: '', stderr: '' });
    });
});

describe('runOrThrow', () => {
    it('returns the result on success', async () => {
        const result = await runOrThrow({ name: `ok`, command: `node`, args: [ `-e`, `` ], cwd: process.cwd(), output: `capture` });

        expect(result.code).toBe(0);
    });

    it('throws a CommandFailedError carrying the exit code', async () => {
        const promise = runOrThrow({ name: `boom`, command: `node`, args: [ `-e`, `process.exit(7)` ], cwd: process.cwd(), output: `capture` });

        await expect(promise).rejects.toBeInstanceOf(CommandFailedError);
        await expect(promise).rejects.toMatchObject({ name: `CommandFailedError`, code: 7, message: `boom failed with exit code 7` });
    });
});

describe('run (signals)', () => {
    it('reports exit code 1 when the child dies from a signal', async () => {
        const result = await run({
            command: 'node',
            args:    [ '-e', 'process.kill(process.pid, "SIGKILL")' ],
            cwd:     process.cwd(),
            output:  'capture'
        });

        expect(result.code).toBe(1);
    });
});
