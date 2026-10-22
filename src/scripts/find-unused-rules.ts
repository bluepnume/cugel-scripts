import { ESLint } from 'eslint';
import { builtinRules } from 'eslint/use-at-your-own-risk';

type RuleMeta = { meta ?: { deprecated ?: boolean | object } };

export type FindUnusedRulesOptions = {
    readonly root : string,
    // A file the config applies to; its resolved config is the one inspected.
    readonly sampleFile ?: string,
    readonly configFile ?: string,
};

// Lists every non-deprecated rule (core and from loaded plugins) that the
// resolved config does not mention, so the config stays a complete statement
// of opinion rather than drifting as plugins add rules.
export const findUnusedRules = async ({
    root,
    sampleFile = 'src/index.ts',
    configFile = 'eslint.config.ts'
} : FindUnusedRulesOptions) : Promise<Array<string>> => {
    const eslint = new ESLint({ cwd: root, overrideConfigFile: configFile });

    const config = await eslint.calculateConfigForFile(sampleFile) as {
        rules : Record<string, unknown>,
        plugins ?: Record<string, { rules ?: Record<string, RuleMeta> }>,
    } | undefined;

    if (config === undefined) {
        throw new Error(`No eslint config applies to ${ sampleFile } (check the config's files patterns)`);
    }

    const configuredRules = new Set(Object.keys(config.rules));

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const coreRules = [ ...builtinRules.entries() ]
        .filter(([ , rule ]) => !rule.meta?.deprecated)
        .map(([ name ]) => name);

    const pluginRules = Object.entries(config.plugins ?? {}).flatMap(([ pluginName, plugin ]) =>
        Object.entries(plugin.rules ?? {})
            .filter(([ , rule ]) => !rule.meta?.deprecated)
            .map(([ ruleName ]) => `${ pluginName }/${ ruleName }`));

    return [ ...coreRules, ...pluginRules ]
        .filter(name => !configuredRules.has(name))
        .toSorted();
};
