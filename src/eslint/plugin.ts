import type { ESLint } from 'eslint';

import {
    computedKeySpacing, enumDeclaration, idAcronymCasing, multilinePadding, noArithmeticOnBrandedPrimitives,
    noBrandedPrimitiveCast, noInOperatorNarrowing, noNullishNarrowingCast, noTopLevelAwait, noUnusedLocals,
    noVoidNonPromise, noVoidWithoutCatch, preferTemplateOnLongLines, requireAssertUnreachable,
    requireFunctionOptionsType, requireIndexBarrel, templatePlaceholderIndent, zodSchemaDeclaration
} from './rules';

type PluginRules = NonNullable<ESLint.Plugin['rules']>;

const rules = {
    'computed-key-spacing':                computedKeySpacing,
    'enum-declaration':                    enumDeclaration,
    'id-acronym-casing':                   idAcronymCasing,
    'multiline-padding':                   multilinePadding,
    'no-arithmetic-on-branded-primitives': noArithmeticOnBrandedPrimitives,
    'no-branded-primitive-cast':           noBrandedPrimitiveCast,
    'no-in-operator-narrowing':            noInOperatorNarrowing,
    'no-nullish-narrowing-cast':           noNullishNarrowingCast,
    'no-top-level-await':                  noTopLevelAwait,
    'no-unused-locals':                    noUnusedLocals,
    'no-void-non-promise':                 noVoidNonPromise,
    'no-void-without-catch':               noVoidWithoutCatch,
    'prefer-template-on-long-lines':       preferTemplateOnLongLines,
    'require-assert-unreachable':          requireAssertUnreachable,
    'require-function-options-type':       requireFunctionOptionsType,
    'require-index-barrel':                requireIndexBarrel,
    'template-placeholder-indent':         templatePlaceholderIndent,
    'zod-schema-declaration':              zodSchemaDeclaration
};

// The rules are written against typescript-eslint's RuleModule type, which is
// structurally compatible with ESLint's at runtime but not nominally.
export const cugelRules = rules as unknown as PluginRules;

export const CUGEL_RULE_NAMES : ReadonlyArray<string> = Object.keys(rules);

export const cugelPlugin : ESLint.Plugin = {
    meta:  { name: 'cugel', version: '0.1.0' },
    rules: cugelRules
};
