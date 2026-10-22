import { cli, COMMANDS, usage } from '../../src';
import { collectLogs, CUGEL_ROOT } from '../helpers';

describe('cli', () => {
    it('prints usage and fails when no command is given', async () => {
        const { lines, log } = collectLogs();

        const result = await cli({ argv: [], cwd: CUGEL_ROOT, log });

        expect(result.code).toBe(1);
        expect(lines[0]).toContain('Usage: cugel-scripts <command>');
    });

    it('prints usage and succeeds for --help and -h', async () => {
        for (const flag of [ '--help', '-h' ]) {
            const { lines, log } = collectLogs();
            // eslint-disable-next-line no-await-in-loop -- two flags, sequential is fine
            const result = await cli({ argv: [ flag ], cwd: CUGEL_ROOT, log });

            expect(result.code).toBe(0);
            expect(lines[0]).toBe(usage());
        }
    });

    it('rejects an unknown command', async () => {
        const { lines, log } = collectLogs();

        const result = await cli({ argv: [ 'frobnicate' ], cwd: CUGEL_ROOT, log });

        expect(result.code).toBe(1);
        expect(lines[0]).toContain('Unknown command: frobnicate');
    });

    it('lists every command in usage with its description', () => {
        const text = usage();

        for (const [ name, { description } ] of Object.entries(COMMANDS)) {
            expect(text).toContain(name);
            expect(text).toContain(description);
        }
    });

    it('turns a thrown error into exit code 1 with the message logged', async () => {
        const { lines, log } = collectLogs();

        // tsc on a directory with no tsconfig fails fast.
        const result = await cli({ argv: [ 'tsc' ], cwd: '/', log });

        expect(result.code).toBe(1);
        expect(lines.at(-1)).toMatch(/No package.json found above/);
    });

    it('resolves the project root from a nested cwd', async () => {
        const { lines, log } = collectLogs();

        const result = await cli({ argv: [ 'rules:unused' ], cwd: `${ CUGEL_ROOT }/src/lib`, log });

        expect(result.code).toBe(0);
        expect(lines.join('\n')).toMatch(/unconfigured rule|Every available rule/);
    });
});
