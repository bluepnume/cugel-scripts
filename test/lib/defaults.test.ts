import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { defaultConfigPath, importSorterConfigArgs, materializeKnipConfig } from '../../src';
import { CUGEL_ROOT } from '../helpers';

describe('packaged default configs', () => {
    let root : string;

    beforeEach(async () => {
        root = await mkdtemp(path.join(os.tmpdir(), 'cugel-defaults-'));
    });

    afterEach(async () => {
        await rm(root, { recursive: true, force: true });
    });

    it('references the packaged import-sorter config when the consumer has none', () => {
        expect(importSorterConfigArgs({ root })).toEqual([ `--config`, path.join(CUGEL_ROOT, `defaults`, `import-sorter.json`) ]);
    });

    it('copies the packaged knip config into the project for the run and removes it after', async () => {
        const config = await materializeKnipConfig({ root });
        const temp = path.join(root, '.knip.cugel-default.json');

        expect(config.args).toEqual([ '--config', '.knip.cugel-default.json' ]);
        expect(await readFile(temp, `utf8`)).toBe(await readFile(path.join(CUGEL_ROOT, `defaults`, `knip.json`), `utf8`));

        await config.cleanup();

        await expect(stat(temp)).rejects.toThrow();
    });

    it('steps aside when the consumer has written their own', async () => {
        await writeFile(path.join(root, 'knip.jsonc'), '{}');
        await writeFile(path.join(root, 'import-sorter.json'), '{}');

        const config = await materializeKnipConfig({ root });

        expect(config.args).toEqual([]);
        await config.cleanup();
        expect(importSorterConfigArgs({ root })).toEqual([]);
        expect(defaultConfigPath({ root, name: 'import-sorter.json' })).toBeUndefined();
    });
});
