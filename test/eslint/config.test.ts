/* eslint-disable no-template-curly-in-string -- test inputs contain literal placeholders */
import { ESLint } from 'eslint';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FixtureCopy } from '../helpers';

import { CUGEL_RULE_NAMES, cugelPlugin, cugelRules, deadCodeEslintConfig, eslintConfig } from '../../src';
import { copyFixture } from '../helpers';

type RuleResult = { ruleId : string | null, message : string };

type LintTextOptions = {
    readonly root : string,
    readonly text : string,
    readonly filePath : string,
};

// Writes the file into the fixture first: the type-aware parser only knows
// files that exist in the project.
const lintText = async ({ root, text, filePath } : LintTextOptions) : Promise<Array<RuleResult>> => {
    const absolute = path.join(root, filePath);

    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, text);

    const eslint = new ESLint({
        cwd:                root,
        overrideConfigFile: true,
        overrideConfig:     eslintConfig({ root })
    });

    const [ result ] = await eslint.lintFiles([ absolute ]);

    return (result?.messages ?? []).map(({ ruleId, message }) => ({ ruleId, message }));
};

describe('eslintConfig', () => {
    let fixture : FixtureCopy;

    beforeAll(async () => {
        fixture = await copyFixture({ name: 'sample' });
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    it('registers every cugel rule under the cugel/ prefix', () => {
        const config = eslintConfig({ root: fixture.root });
        const main = config.find(block => block.plugins?.cugel !== undefined);

        expect(main?.plugins?.cugel).toBe(cugelPlugin);
        expect(Object.keys(cugelRules).toSorted()).toEqual([ ...CUGEL_RULE_NAMES ].toSorted());

        for (const name of CUGEL_RULE_NAMES) {
            expect(main?.rules?.[`cugel/${ name }`], name).toBeDefined();
        }
    });

    it('passes a well-formed file', async () => {
        const messages = await lintText({
            root:     fixture.root,
            filePath: 'src/greet.ts',
            text:     [
                'export type GreetOptions = {',
                '    readonly name : string,',
                '};',
                '',
                'export const greet = ({ name } : GreetOptions) : string => `Hello, ${ name }!`;',
                ''
            ].join('\n')
        });

        expect(messages).toEqual([]);
    });

    it('reports style, type-aware and custom rule violations', async () => {
        const messages = await lintText({
            root:     fixture.root,
            filePath: 'src/greet.ts',
            text:     [
                'export const greet = (opts: {name: string}) => {',
                '  const x: any = opts;',
                '  return "Hello, " + x.name;',
                '}',
                ''
            ].join('\n')
        });

        const ruleIds = new Set(messages.map(message => message.ruleId));

        expect(ruleIds).toContain('@stylistic/indent');
        expect(ruleIds).toContain('@typescript-eslint/no-explicit-any');
        expect(ruleIds).toContain('@typescript-eslint/no-unsafe-member-access');
        expect(ruleIds).toContain('cugel/require-function-options-type');
        expect(ruleIds).toContain('@typescript-eslint/explicit-function-return-type');
        expect(ruleIds).toContain('prefer-template');
    });

    it('restricts index.ts barrels to export * statements', async () => {
        const messages = await lintText({
            root:     fixture.root,
            filePath: 'src/index.ts',
            text:     `export const notABarrel = 1;\n`
        });

        expect(messages.map(message => message.ruleId)).toContain('no-restricted-syntax');
        expect(messages.map(message => message.ruleId)).toContain('cugel/require-index-barrel');
    });

    it('allows a clean barrel', async () => {
        const messages = await lintText({
            root:     fixture.root,
            filePath: 'src/index.ts',
            text:     `export * from './greet';\nexport * from './shout';\n`
        });

        expect(messages).toEqual([]);
    });

    it('relaxes test files: vitest globals and enum/void rules', async () => {
        const messages = await lintText({
            root:     fixture.root,
            filePath: 'test/greet.test.ts',
            text:     [
                `import { greet } from '../src';`,
                '',
                `describe('greet', () => {`,
                `    it('works', () => {`,
                `        expect(greet({ name: 'x' })).toBe('Hello, x!');`,
                '    });',
                '});',
                ''
            ].join('\n')
        });

        expect(messages).toEqual([]);
    });

    it('forbids runtime code under src/types', async () => {
        const messages = await lintText({
            root:     fixture.root,
            filePath: 'src/types/thing.ts',
            text:     `export const runtime = 1;\n`
        });

        expect(messages.map(message => message.message)).toContain(`src/types/ must only contain type definitions. Move runtime values elsewhere.`);
    });

    it('applies the chosen environment globals', async () => {
        const browserOnly = `export const title = () : string => document.title;\n`;

        // Under the node environment DOM types are absent, so the type-aware
        // rules see `document` as unresolved.
        const nodeMessages = await lintText({ root: fixture.root, filePath: 'src/env.ts', text: browserOnly });

        expect(nodeMessages.map(message => message.ruleId)).toEqual([
            '@typescript-eslint/no-unsafe-return',
            '@typescript-eslint/no-unsafe-member-access'
        ]);

        const globalsFor = (environment : 'node' | 'browser' | 'universal') : Record<string, unknown> => {
            const config = eslintConfig({ root: fixture.root, environment });
            const main = config.find(block => block.languageOptions?.globals !== undefined);

            return (main?.languageOptions?.globals ?? {}) as Record<string, unknown>;
        };

        expect(globalsFor('browser').document).toBeDefined();
        expect(globalsFor('universal').document).toBeDefined();
        expect(globalsFor('universal').process).toBeDefined();
        expect(globalsFor('node').document).toBeUndefined();
        expect(globalsFor('node').process).toBeDefined();
    });

    it('rejects an unknown environment', () => {
        expect(() => eslintConfig({ root: fixture.root, environment: `quantum` as 'node' })).toThrow(/Unknown environment/);
    });

    it('appends extra ignores and overrides last', () => {
        const override = { files: [ 'src/legacy/**' ], rules: { 'no-console': 'off' as const } };
        const config = eslintConfig({ root: fixture.root, ignores: [ 'generated/**' ], overrides: [ override ] });

        expect(config[0]?.ignores).toContain('generated/**');
        expect(config.at(-1)).toBe(override);
    });
});

describe('deadCodeEslintConfig', () => {
    it('is a one-block config that collapses unused locals and imports', () => {
        const [ block, ...rest ] = deadCodeEslintConfig();

        expect(rest).toEqual([]);
        expect(block?.linterOptions?.noInlineConfig).toBe(true);
        expect(block?.rules?.['cugel/no-unused-locals']).toBe('error');
        expect(block?.rules?.['unused-imports/no-unused-imports']).toBe('error');
    });
});

/* eslint-enable no-template-curly-in-string */
