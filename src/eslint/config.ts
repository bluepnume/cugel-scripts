import type { ESLint, Linter } from 'eslint';

import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import compatPlugin from 'eslint-plugin-compat';
import importPlugin from 'eslint-plugin-import-x';
import nodePlugin from 'eslint-plugin-n';
import preferArrowPlugin from 'eslint-plugin-prefer-arrow';
import promisePlugin from 'eslint-plugin-promise';
import securityPlugin from 'eslint-plugin-security';
import sortExportAllPlugin from 'eslint-plugin-sort-export-all';
import sortKeysPlugin from 'eslint-plugin-sort-keys';
import unicornPlugin from 'eslint-plugin-unicorn';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';
import globals from 'globals';

import { cugelPlugin } from './plugin';

import eslintCommentsPlugin from '@eslint-community/eslint-plugin-eslint-comments';
import { fixupPluginRules } from '@eslint/compat';
import stylisticPlugin from '@stylistic/eslint-plugin';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export type EslintEnvironment = 'node' | 'browser' | 'universal';

export type EslintConfigOptions = {
    // Directory holding the consumer's tsconfig.json; type-aware rules resolve
    // their program from here. Pass `import.meta.dirname` from eslint.config.ts.
    readonly root : string,
    // Which globals the code may use. `universal` code runs in both.
    readonly environment ?: EslintEnvironment,
    // Extra glob patterns to ignore, on top of the built-in set.
    readonly ignores ?: ReadonlyArray<string>,
    // Appended after the built-in config blocks, so they win on conflicts.
    readonly overrides ?: ReadonlyArray<Linter.Config>,
};

const RESTRICTED_IMPORT_EXPORT_SYNTAX = [
    {
        message:  `Must specify file or directory name for import, do not rely on implicit . or ..`,
        selector: String.raw`ImportDeclaration[source.value=/\.\u002F*$/]`
    },
    {
        message:  `import from './x/y or ../x/y' is not allowed.`,
        selector: String.raw`ImportDeclaration[source.value=/^\..*\u002F[^\u002F.]+\u002F[^\u002F.]+$/]`
    },
    {
        message:  `export * from '../' is not allowed.`,
        selector: String.raw`ExportAllDeclaration[source.value=/\.\./]`
    },
    {
        message:  `export * from 'foo/bar' is not allowed.`,
        selector: String.raw`ExportAllDeclaration[source.value=/\u002F[^\u002F.]+\u002F[^\u002F.]+$/]`
    }
];

// `export * from` is the barrel-file pattern. Allowed only in `index.ts` files;
// any other file should export its declarations directly.
const NO_EXPORT_STAR_OUTSIDE_INDEX = {
    message:  '`export * from` is only allowed in index.ts barrel files.',
    selector: 'ExportAllDeclaration'
};

const PADDING_LINE_RULES = [
    {
        prev:      '*',
        next:      'block',
        blankLine: 'always'
    },
    {
        prev:      'block',
        next:      '*',
        blankLine: 'always'
    },
    {
        prev:      '*',
        next:      'block-like',
        blankLine: 'always'
    },
    {
        prev:      'block-like',
        next:      '*',
        blankLine: 'always'
    },
    {
        prev:      '*',
        next:      'if',
        blankLine: 'always'
    },
    {
        prev:      'multiline-expression',
        next:      '*',
        blankLine: 'always'
    },
    {
        prev:      '*',
        next:      'multiline-expression',
        blankLine: 'always'
    },
    {
        prev:      'multiline-let',
        next:      '*',
        blankLine: 'always'
    },
    {
        prev:      '*',
        next:      'multiline-let',
        blankLine: 'always'
    },
    {
        prev:      'multiline-const',
        next:      '*',
        blankLine: 'always'
    },
    {
        prev:      '*',
        next:      'multiline-const',
        blankLine: 'always'
    },
    {
        prev:      'multiline-type',
        next:      '*',
        blankLine: 'always'
    },
    {
        prev:      '*',
        next:      'multiline-type',
        blankLine: 'always'
    },
    {
        prev:      '*',
        next:      'multiline-return',
        blankLine: 'always'
    },
    {
        prev:      'enum',
        next:      '*',
        blankLine: 'always'
    },
    {
        prev:      '*',
        next:      'enum',
        blankLine: 'always'
    },
    {
        prev:      'case',
        next:      'case',
        blankLine: 'any'
    },
    {
        prev:      '*',
        next:      'export',
        blankLine: 'always'
    }
] as const;

const BUILT_IN_IGNORES = [
    'coverage/**',
    'dist/**',
    'node_modules/**',
    '.claude/**',
    '**/*.js',
    '**/*.cjs',
    '**/*.mjs',
    '**/*.d.ts'
];

const environmentGlobals = (environment : EslintEnvironment) : Record<string, boolean> => {
    switch (environment) {
        case 'node':
            return { ...globals.node };
        case 'browser':
            return { ...globals.browser };
        case 'universal':
            return { ...globals.node, ...globals.browser };
        default:
            throw new Error(`Unknown environment: ${ String(environment) }`);
    }
};

export const eslintConfig = ({
    root,
    environment = 'node',
    ignores = [],
    overrides = []
} : EslintConfigOptions) : Array<Linter.Config> => [
    // Global ignores
    {
        ignores: [ ...BUILT_IN_IGNORES, ...ignores ]
    },

    // Main config for TypeScript files
    {
        files: [ '**/*.ts', '**/*.tsx' ],

        linterOptions: {
            reportUnusedDisableDirectives: 'error'
        },

        languageOptions: {
            globals: {
                ...globals.es2021,
                ...environmentGlobals(environment)
            },
            parser:        tsParser,
            parserOptions: {
                // Root-level config files (eslint.config.ts, vitest.config.ts,
                // cugel.config.ts) are usually outside tsconfig's include; the
                // default project type-checks them without that ceremony.
                projectService: {
                    allowDefaultProject: [ '*.ts', '*.tsx' ]
                },
                tsconfigRootDir: root
            }
        },

        plugins: {
            '@typescript-eslint': tsPlugin as unknown as ESLint.Plugin,
            '@stylistic':         stylisticPlugin as unknown as ESLint.Plugin,
            'unicorn':            unicornPlugin,
            'eslint-comments':    eslintCommentsPlugin,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            'promise':            fixupPluginRules(promisePlugin),
            'security':           securityPlugin,
            'import':             importPlugin as unknown as ESLint.Plugin,
            'compat':             compatPlugin,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            'prefer-arrow':       fixupPluginRules(preferArrowPlugin),
            'unused-imports':     unusedImportsPlugin,
            'sort-export-all':    fixupPluginRules(sortExportAllPlugin),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            'sort-keys':          fixupPluginRules(sortKeysPlugin),
            'n':                  nodePlugin,
            'cugel':              cugelPlugin
        },

        rules: {
            // ========================
            // @stylistic rules
            // ========================
            '@stylistic/array-bracket-newline': 'off',
            '@stylistic/array-bracket-spacing': [
                'error',
                'always'
            ],
            '@stylistic/array-element-newline': 'off',
            '@stylistic/arrow-parens':          'off',
            '@stylistic/arrow-spacing':         'error',
            '@stylistic/block-spacing':         'error',
            '@stylistic/brace-style':           'off',
            '@stylistic/comma-dangle':          'error',
            '@stylistic/comma-spacing':         [
                'error',
                {
                    after:  true,
                    before: false
                }
            ],
            '@stylistic/comma-style': [
                'error',
                'last'
            ],
            '@stylistic/computed-property-spacing':      'off',
            '@stylistic/curly-newline':                  'error',
            '@stylistic/dot-location':                   'off',
            '@stylistic/eol-last':                       'error',
            '@stylistic/exp-jsx-props-style':            'off',
            '@stylistic/exp-list-style':                 'off',
            '@stylistic/func-call-spacing':              'off',
            '@stylistic/function-call-argument-newline': [
                'error',
                'consistent'
            ],
            '@stylistic/function-call-spacing':  'error',
            '@stylistic/function-paren-newline': [
                'error',
                'consistent'
            ],
            '@stylistic/generator-star-spacing':   'off',
            '@stylistic/implicit-arrow-linebreak': 'off',
            '@stylistic/indent':                   [
                'error',
                4,
                {
                    SwitchCase:   1,
                    ignoredNodes: [ 'TemplateLiteral' ]
                }
            ],
            '@stylistic/indent-binary-ops': [
                'error',
                4
            ],
            '@stylistic/jsx-child-element-spacing':    'error',
            '@stylistic/jsx-closing-bracket-location': 'off',
            '@stylistic/jsx-closing-tag-location':     'error',
            '@stylistic/jsx-curly-brace-presence':     [
                'error',
                {
                    children: 'always',
                    props:    'always'
                }
            ],
            '@stylistic/jsx-curly-newline': [
                'error',
                {
                    multiline:  'require',
                    singleline: 'consistent'
                }
            ],
            '@stylistic/jsx-curly-spacing': [
                'error',
                {
                    allowMultiline: true,
                    attributes:     true,
                    children:       true,
                    when:           'always'
                }
            ],
            '@stylistic/jsx-equals-spacing': [
                'error',
                'never'
            ],
            '@stylistic/jsx-first-prop-new-line': [
                'error',
                'multiline-multiprop'
            ],
            '@stylistic/jsx-function-call-newline': 'error',
            // jsx-indent is deprecated in @stylistic v5, covered by @stylistic/indent
            '@stylistic/jsx-indent-props':          [
                'error',
                4
            ],
            '@stylistic/jsx-max-props-per-line': [
                'error',
                {
                    maximum: 1
                }
            ],
            '@stylistic/jsx-newline':                 'off',
            '@stylistic/jsx-one-expression-per-line': 'off',
            '@stylistic/jsx-pascal-case':             'off',
            // jsx-props-no-multi-spaces is deprecated in @stylistic v5, covered by @stylistic/no-multi-spaces
            '@stylistic/jsx-quotes':                  'off',
            '@stylistic/jsx-self-closing-comp':       'error',
            '@stylistic/jsx-sort-props':              'off',
            '@stylistic/jsx-tag-spacing':             'error',
            '@stylistic/jsx-wrap-multilines':         [
                'error',
                {
                    arrow:       'parens-new-line',
                    assignment:  'parens-new-line',
                    condition:   'parens-new-line',
                    declaration: 'parens-new-line',
                    logical:     'ignore',
                    prop:        'ignore',
                    return:      'parens-new-line'
                }
            ],
            '@stylistic/key-spacing': [
                'error',
                {
                    afterColon: true,
                    align:      {
                        afterColon:  true,
                        beforeColon: false,
                        mode:        'strict',
                        on:          'value'
                    },
                    ignoredNodes: [ 'TSTypeLiteral', 'TSInterfaceBody', 'ClassBody' ],
                    mode:         'strict'
                }
            ],
            '@stylistic/keyword-spacing':       'error',
            '@stylistic/line-comment-position': 'off',
            '@stylistic/linebreak-style':       [
                'error',
                'unix'
            ],
            '@stylistic/lines-around-comment':        'off',
            '@stylistic/lines-between-class-members': 'off',
            '@stylistic/max-len':                     [
                'error',
                {
                    code:                   120,
                    ignoreComments:         true,
                    ignorePattern:          String.raw`test(\.(skip|concurrent))?\(`,
                    ignoreRegExpLiterals:   true,
                    ignoreTemplateLiterals: true,
                    tabWidth:               4
                }
            ],
            '@stylistic/max-statements-per-line': [
                'error',
                { max: 1 }
            ],
            '@stylistic/member-delimiter-style': [
                'error',
                {
                    multiline: {
                        delimiter:   'comma',
                        requireLast: true
                    },
                    singleline: {
                        delimiter:   'comma',
                        requireLast: false
                    }
                }
            ],
            '@stylistic/multiline-comment-style':  'off',
            '@stylistic/multiline-ternary':        'error',
            '@stylistic/new-parens':               'error',
            '@stylistic/newline-per-chained-call': 'off',
            '@stylistic/no-confusing-arrow':       'error',
            '@stylistic/no-extra-parens':          'off',
            '@stylistic/no-extra-semi':            'error',
            '@stylistic/no-floating-decimal':      'error',
            '@stylistic/no-mixed-operators':       'error',
            '@stylistic/no-mixed-spaces-and-tabs': [
                'error',
                true
            ],
            '@stylistic/no-multi-spaces':         'error',
            '@stylistic/no-multiple-empty-lines': [
                'error',
                {
                    max:    1,
                    maxBOF: 0,
                    maxEOF: 1
                }
            ],
            '@stylistic/no-tabs':            'error',
            '@stylistic/no-trailing-spaces': [
                'error',
                { skipBlankLines: false }
            ],
            '@stylistic/no-whitespace-before-property':    'error',
            '@stylistic/nonblock-statement-body-position': 'error',
            '@stylistic/object-curly-newline':             [
                'error',
                {
                    consistent: true,
                    multiline:  true
                }
            ],
            '@stylistic/object-curly-spacing': [
                'error',
                'always'
            ],
            '@stylistic/object-property-newline': [
                'error',
                {
                    allowAllPropertiesOnSameLine: true
                }
            ],
            '@stylistic/one-var-declaration-per-line': [
                'error',
                'always'
            ],
            '@stylistic/operator-linebreak': [
                'error',
                'after',
                {
                    overrides: {
                        '&': 'before',
                        ':': 'before',
                        '?': 'before',
                        '|': 'before'
                    }
                }
            ],
            '@stylistic/padded-blocks':                   'off',
            '@stylistic/padding-line-between-statements': [
                'error',
                ...PADDING_LINE_RULES
            ],
            '@stylistic/quote-props': [
                'error',
                'consistent-as-needed',
                {
                    numbers:     true,
                    unnecessary: false
                }
            ],
            '@stylistic/quotes': [
                'error',
                'single',
                { allowTemplateLiterals: 'always' }
            ],
            '@stylistic/rest-spread-spacing': 'error',
            '@stylistic/semi':                'error',
            '@stylistic/semi-spacing':        'error',
            '@stylistic/semi-style':          'error',
            '@stylistic/space-before-blocks': [
                'error',
                'always'
            ],
            '@stylistic/space-before-function-paren': 'off',
            '@stylistic/space-in-parens':             [
                'error',
                'never'
            ],
            '@stylistic/space-infix-ops': 'error',
            '@stylistic/space-unary-ops': [
                'error',
                {
                    nonwords: false,
                    words:    true
                }
            ],
            '@stylistic/spaced-comment':         'error',
            '@stylistic/switch-colon-spacing':   'off',
            '@stylistic/template-curly-spacing': [
                'error',
                'always'
            ],
            '@stylistic/template-tag-spacing':    'off',
            '@stylistic/type-annotation-spacing': [
                'error',
                {
                    after:  true,
                    before: true
                }
            ],
            '@stylistic/type-generic-spacing':     'error',
            '@stylistic/type-named-tuple-spacing': 'error',
            '@stylistic/wrap-iife':                'error',
            '@stylistic/wrap-regex':               'error',
            '@stylistic/yield-star-spacing':       'off',

            // ========================
            // @typescript-eslint rules
            // ========================
            '@typescript-eslint/adjacent-overload-signatures': 'error',
            '@typescript-eslint/array-type':                   [
                'error',
                { default: 'generic' }
            ],
            '@typescript-eslint/await-thenable':                  'error',
            '@typescript-eslint/ban-ts-comment':                  'off',
            '@typescript-eslint/ban-tslint-comment':              'off',
            '@typescript-eslint/class-literal-property-style':    'off',
            '@typescript-eslint/class-methods-use-this':          'off',
            '@typescript-eslint/consistent-generic-constructors': 'off',
            '@typescript-eslint/consistent-indexed-object-style': 'off',
            '@typescript-eslint/consistent-return':               'off',
            '@typescript-eslint/consistent-type-assertions':      'off',
            '@typescript-eslint/consistent-type-definitions':     [
                'error',
                'type'
            ],
            '@typescript-eslint/consistent-type-exports': 'off',
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    disallowTypeAnnotations: true,
                    fixStyle:                'separate-type-imports',
                    prefer:                  'type-imports'
                }
            ],
            '@typescript-eslint/default-param-last':            'error',
            '@typescript-eslint/dot-notation':                  'error',
            '@typescript-eslint/explicit-function-return-type': [
                'error',
                { allowExpressions: true }
            ],
            '@typescript-eslint/explicit-member-accessibility':  'off',
            '@typescript-eslint/explicit-module-boundary-types': 'error',
            '@typescript-eslint/init-declarations':              'off',
            '@typescript-eslint/max-params':                     [
                'error',
                {
                    max: 3
                }
            ],
            '@typescript-eslint/member-ordering':        'off',
            '@typescript-eslint/method-signature-style': [
                'error',
                'property'
            ],
            '@typescript-eslint/naming-convention':                       'off',
            '@typescript-eslint/no-array-constructor':                    'error',
            '@typescript-eslint/no-array-delete':                         'error',
            '@typescript-eslint/no-base-to-string':                       'error',
            '@typescript-eslint/no-confusing-non-null-assertion':         'error',
            '@typescript-eslint/no-confusing-void-expression':            'off',
            '@typescript-eslint/no-deprecated':                           'error',
            '@typescript-eslint/no-dupe-class-members':                   'off',
            '@typescript-eslint/no-duplicate-enum-values':                'error',
            '@typescript-eslint/no-duplicate-type-constituents':          'error',
            '@typescript-eslint/no-dynamic-delete':                       'off',
            '@typescript-eslint/no-empty-function':                       'error',
            '@typescript-eslint/no-empty-object-type':                    'error',
            '@typescript-eslint/no-explicit-any':                         'error',
            '@typescript-eslint/no-extra-non-null-assertion':             'error',
            '@typescript-eslint/no-extraneous-class':                     'off',
            '@typescript-eslint/no-floating-promises':                    'error',
            '@typescript-eslint/no-for-in-array':                         'error',
            '@typescript-eslint/no-implied-eval':                         'error',
            '@typescript-eslint/no-import-type-side-effects':             'error',
            '@typescript-eslint/no-inferrable-types':                     'error',
            '@typescript-eslint/no-invalid-this':                         'off',
            '@typescript-eslint/no-invalid-void-type':                    'off',
            '@typescript-eslint/no-loop-func':                            'off',
            '@typescript-eslint/no-magic-numbers':                        'off',
            '@typescript-eslint/no-meaningless-void-operator':            'error',
            '@typescript-eslint/no-misused-new':                          'error',
            '@typescript-eslint/no-misused-promises':                     'error',
            '@typescript-eslint/no-misused-spread':                       'error',
            '@typescript-eslint/no-mixed-enums':                          'error',
            '@typescript-eslint/no-namespace':                            'error',
            '@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'off',
            '@typescript-eslint/no-non-null-asserted-optional-chain':     'error',
            '@typescript-eslint/no-non-null-assertion':                   'error',
            '@typescript-eslint/no-redeclare':                            'error',
            '@typescript-eslint/no-redundant-type-constituents':          'error',
            '@typescript-eslint/no-require-imports':                      'error',
            '@typescript-eslint/no-restricted-imports':                   'off',
            '@typescript-eslint/no-restricted-types':                     'off',
            '@typescript-eslint/no-shadow':                               'error',
            '@typescript-eslint/no-this-alias':                           'error',
            '@typescript-eslint/no-unnecessary-boolean-literal-compare':  'error',
            '@typescript-eslint/no-unnecessary-condition':                [
                'error',
                { allowConstantLoopConditions: true }
            ],
            '@typescript-eslint/no-unnecessary-parameter-property-assignment': 'error',
            '@typescript-eslint/no-unnecessary-qualifier':                     'off',
            '@typescript-eslint/no-unnecessary-template-expression':           'error',
            '@typescript-eslint/no-unnecessary-type-arguments':                'error',
            '@typescript-eslint/no-unnecessary-type-assertion':                'error',
            '@typescript-eslint/no-unnecessary-type-constraint':               'error',
            '@typescript-eslint/no-unnecessary-type-conversion':               'error',
            '@typescript-eslint/no-unnecessary-type-parameters':               'off',
            '@typescript-eslint/no-unsafe-argument':                           'error',
            '@typescript-eslint/no-unsafe-assignment':                         'error',
            '@typescript-eslint/no-unsafe-call':                               'error',
            '@typescript-eslint/no-unsafe-declaration-merging':                'error',
            '@typescript-eslint/no-unsafe-enum-comparison':                    'off',
            '@typescript-eslint/no-unsafe-function-type':                      'error',
            '@typescript-eslint/no-unsafe-member-access':                      'error',
            '@typescript-eslint/no-unsafe-return':                             'error',
            '@typescript-eslint/no-unsafe-type-assertion':                     'off',
            '@typescript-eslint/no-unsafe-unary-minus':                        'error',
            '@typescript-eslint/no-unused-expressions':                        'error',
            '@typescript-eslint/no-unused-private-class-members':              'error',
            '@typescript-eslint/no-unused-vars':                               'error',
            '@typescript-eslint/no-use-before-define':                         'error',
            '@typescript-eslint/no-useless-constructor':                       'error',
            '@typescript-eslint/no-useless-default-assignment':                'error',
            '@typescript-eslint/no-useless-empty-export':                      'error',
            '@typescript-eslint/no-wrapper-object-types':                      'error',
            '@typescript-eslint/non-nullable-type-assertion-style':            'off',
            '@typescript-eslint/only-throw-error':                             [
                'error',
                {

                }
            ],
            '@typescript-eslint/parameter-properties':       'error',
            '@typescript-eslint/prefer-as-const':            'error',
            '@typescript-eslint/prefer-destructuring':       'off',
            '@typescript-eslint/prefer-enum-initializers':   'error',
            '@typescript-eslint/prefer-find':                'error',
            '@typescript-eslint/prefer-for-of':              'error',
            '@typescript-eslint/prefer-function-type':       'error',
            '@typescript-eslint/prefer-includes':            'off',
            '@typescript-eslint/prefer-literal-enum-member': 'off',
            '@typescript-eslint/prefer-namespace-keyword':   'error',
            '@typescript-eslint/prefer-nullish-coalescing':  [
                'error',
                {
                    ignoreConditionalTests:        true,
                    ignoreMixedLogicalExpressions: true,
                    ignoreTernaryTests:            true
                }
            ],
            '@typescript-eslint/prefer-optional-chain':           'error',
            '@typescript-eslint/prefer-promise-reject-errors':    'error',
            '@typescript-eslint/prefer-readonly':                 'off',
            '@typescript-eslint/prefer-readonly-parameter-types': 'off',
            '@typescript-eslint/prefer-reduce-type-parameter':    'off',
            '@typescript-eslint/prefer-regexp-exec':              'off',
            '@typescript-eslint/prefer-return-this-type':         'error',
            '@typescript-eslint/prefer-string-starts-ends-with':  'off',
            '@typescript-eslint/promise-function-async':          'off',
            '@typescript-eslint/related-getter-setter-pairs':     'error',
            '@typescript-eslint/require-array-sort-compare':      'error',
            '@typescript-eslint/require-await':                   'error',
            '@typescript-eslint/restrict-plus-operands':          'error',
            '@typescript-eslint/restrict-template-expressions':   [
                'error',
                {
                    allowAny:     false,
                    allowBoolean: true,
                    allowNever:   false,
                    allowNullish: false,
                    allowNumber:  true,
                    allowRegExp:  false
                }
            ],
            '@typescript-eslint/return-await':                           [ 'error', 'always' ],
            '@typescript-eslint/strict-boolean-expressions':             'off',
            '@typescript-eslint/strict-void-return':                     'off',
            '@typescript-eslint/switch-exhaustiveness-check':            'error',
            '@typescript-eslint/triple-slash-reference':                 'error',
            '@typescript-eslint/typedef':                                'off',
            '@typescript-eslint/unbound-method':                         'error',
            '@typescript-eslint/unified-signatures':                     'error',
            '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',

            // ========================
            // Core ESLint rules
            // ========================
            'accessor-pairs':         'off',
            'array-callback-return':  'error',
            'arrow-body-style':       'off',
            'block-scoped-var':       'error',
            'camelcase':              'off',
            'capitalized-comments':   'off',
            'class-methods-use-this': 'off',
            'compat/compat':          'off',
            'complexity':             'off',
            'consistent-return':      'off',
            'consistent-this':        [
                'error',
                'self'
            ],
            'constructor-super': 'error',
            'curly':             [
                'error',
                'all'
            ],
            'default-case':       'error',
            'default-case-last':  'error',
            'default-param-last': 'error',
            'dot-notation':       'error',
            'eqeqeq':             'error',

            // eslint-comments rules
            'eslint-comments/disable-enable-pair':   'error',
            'eslint-comments/no-aggregating-enable': 'error',
            'eslint-comments/no-duplicate-disable':  'error',
            'eslint-comments/no-restricted-disable': 'off',
            'eslint-comments/no-unlimited-disable':  'error',
            'eslint-comments/no-unused-disable':     'error',
            'eslint-comments/no-unused-enable':      'error',
            'eslint-comments/no-use':                'off',
            'eslint-comments/require-description':   'off',

            'for-direction':      'off',
            'func-name-matching': 'off',
            'func-names':         [
                'error',
                'as-needed'
            ],
            'func-style': [
                'error',
                'expression',
                {
                    allowArrowFunctions: true
                }
            ],
            'getter-return':          'off',
            'grouped-accessor-pairs': 'error',
            'guard-for-in':           'error',
            'id-denylist':            'off',
            'id-length':              'off',
            'id-match':               'off',

            // import rules
            'import/consistent-type-specifier-style': [
                'error',
                'prefer-top-level'
            ],
            'import/default':                     'error',
            'import/dynamic-import-chunkname':    'off',
            'import/export':                      'error',
            'import/exports-last':                'off',
            'import/extensions':                  'off',
            'import/first':                       'error',
            'import/group-exports':               'off',
            'import/max-dependencies':            'off',
            'import/named':                       'error',
            'import/namespace':                   'error',
            'import/newline-after-import':        'error',
            'import/no-absolute-path':            'error',
            'import/no-amd':                      'error',
            'import/no-anonymous-default-export': 'off',
            'import/no-commonjs':                 'error',
            'import/no-cycle':                    'error',
            'import/no-default-export':           'error',
            'import/no-deprecated':               'error',
            'import/no-duplicates':               'error',
            'import/no-dynamic-require':          'off',
            'import/no-empty-named-blocks':       'error',
            'import/no-extraneous-dependencies':  'off',
            'import/no-import-module-exports':    'error',
            'import/no-internal-modules':         'off',
            'import/no-mutable-exports':          'off',
            'import/no-named-as-default':         'error',
            'import/no-named-as-default-member':  'error',
            'import/no-named-default':            'error',
            'import/no-named-export':             'off',
            'import/no-namespace':                'error',
            'import/no-nodejs-modules':           'off',
            'import/no-relative-packages':        'off',
            'import/no-rename-default':           'off',
            'import/no-restricted-paths':         'off',
            'import/prefer-namespace-import':     'off',
            'import/no-relative-parent-imports':  'off',
            'import/no-self-import':              'error',
            'import/no-unassigned-import':        [
                'error',
                { allow: [ 'test/**' ] }
            ],
            'import/no-unresolved':            'error',
            // No-op since ESLint 10 removed the FileEnumerator API; knip covers it.
            'import/no-unused-modules':        'off',
            'import/no-useless-path-segments': 'error',
            'import/no-webpack-loader-syntax': 'error',
            'import/order':                    [ 'off' ],
            'import/prefer-default-export':    'off',
            'import/unambiguous':              'off',

            'init-declarations':            'off',
            // Allow `??=` (clear nullish-fallback intent) but block
            // `||=` / `&&=` via `no-restricted-syntax` below — those
            // hide truthiness branching in a way `??=` doesn't. See
            // "Avoid `||=` and `&&=`" in docs/standards/control-flow.md.
            'logical-assignment-operators': 'off',
            'max-classes-per-file':         'off',
            'max-depth':                    'off',
            'max-lines':                    'off',
            'max-lines-per-function':       'off',
            'max-nested-callbacks':         [
                'error',
                4
            ],
            'max-params':                    'off',
            'max-statements':                'off',
            'new-cap':                       'off',
            'no-alert':                      'error',
            'no-array-constructor':          'error',
            'no-async-promise-executor':     'error',
            'no-await-in-loop':              'error',
            'no-bitwise':                    'error',
            'no-caller':                     'error',
            'no-case-declarations':          'error',
            'no-class-assign':               'error',
            'no-compare-neg-zero':           'error',
            'no-cond-assign':                'error',
            'no-console':                    'error',
            'no-const-assign':               'error',
            'no-constant-binary-expression': 'error',
            'no-constant-condition':         'off',
            'no-constructor-return':         'error',
            'no-continue':                   'off',
            'no-control-regex':              'error',
            'no-debugger':                   'error',
            'no-delete-var':                 'error',
            'no-div-regex':                  'off',
            'no-dupe-args':                  'error',
            'no-dupe-class-members':         'off',
            'no-dupe-else-if':               'error',
            'no-dupe-keys':                  'error',
            'no-duplicate-case':             'error',
            'no-duplicate-imports':          'off',
            'no-else-return':                'off',
            'no-empty':                      'error',
            'no-empty-character-class':      'error',
            'no-empty-function':             'error',
            'no-empty-pattern':              'error',
            'no-empty-static-block':         'error',
            'no-eq-null':                    'error',
            'no-eval':                       'error',
            'no-ex-assign':                  'error',
            'no-extend-native':              'error',
            'no-extra-bind':                 'error',
            'no-extra-boolean-cast':         'error',
            'no-extra-label':                'off',
            'no-fallthrough':                'error',
            'no-func-assign':                'error',
            'no-global-assign':              'error',
            'no-implicit-coercion':          'error',
            'no-implicit-globals':           'error',
            'no-implied-eval':               'error',
            'no-import-assign':              'error',
            'no-inline-comments':            'off',
            'no-inner-declarations':         [
                'error',
                'functions'
            ],
            'no-invalid-regexp':       'error',
            'no-invalid-this':         'off',
            'no-irregular-whitespace': 'error',
            'no-iterator':             'error',
            'no-label-var':            'error',
            'no-labels':               [
                'error',
                { allowLoop: true }
            ],
            'no-lone-blocks':                'error',
            'no-lonely-if':                  'off',
            'no-loop-func':                  'off',
            'no-loss-of-precision':          'error',
            'no-magic-numbers':              'off',
            'no-misleading-character-class': 'error',
            'no-multi-assign':               'off',
            'no-multi-str':                  'error',
            'no-negated-condition':          'off',
            'no-nested-ternary':             'off',
            'no-new':                        'error',
            'no-new-func':                   'error',
            'no-new-native-nonconstructor':  'error',
            'no-new-wrappers':               'error',
            'no-nonoctal-decimal-escape':    'error',
            'no-obj-calls':                  'error',
            'no-object-constructor':         'error',
            'no-octal':                      'error',
            'no-octal-escape':               'error',
            'no-param-reassign':             'off',
            'no-plusplus':                   [
                'error',
                { allowForLoopAfterthoughts: true }
            ],
            'no-promise-executor-return': 'error',
            'no-proto':                   'error',
            'no-prototype-builtins':      'off',
            'no-redeclare':               'off',
            'no-regex-spaces':            'error',
            'no-restricted-exports':      'off',
            'no-restricted-globals':      'off',
            'no-restricted-imports':      'off',
            'no-restricted-properties':   'off',
            'no-restricted-syntax':       [
                'error',
                ...RESTRICTED_IMPORT_EXPORT_SYNTAX,
                NO_EXPORT_STAR_OUTSIDE_INDEX,
                {
                    selector: `AssignmentExpression[operator='||=']`,
                    message:  `Use a ternary instead of '||=' — the truthiness branch is too easy to misread at a glance.`
                },
                {
                    selector: `AssignmentExpression[operator='&&=']`,
                    message:  `Use a ternary instead of '&&=' — the truthiness branch is too easy to misread at a glance.`
                }
            ],
            'no-return-assign':                'error',
            'no-script-url':                   'error',
            'no-self-assign':                  'error',
            'no-self-compare':                 'error',
            'no-sequences':                    'error',
            'no-setter-return':                'error',
            'no-shadow':                       'off',
            'no-shadow-restricted-names':      'error',
            'no-sparse-arrays':                'error',
            'no-template-curly-in-string':     'error',
            'no-ternary':                      'off',
            'no-this-before-super':            'error',
            'no-throw-literal':                'error',
            'no-unassigned-vars':              'error',
            'no-undef':                        'off',
            'no-undef-init':                   'error',
            'no-undefined':                    'off',
            'no-underscore-dangle':            'off',
            'no-unexpected-multiline':         'error',
            'no-unmodified-loop-condition':    'error',
            'no-unneeded-ternary':             'off',
            'no-unreachable':                  'error',
            'no-unreachable-loop':             'error',
            'no-unsafe-finally':               'error',
            'no-unsafe-negation':              'error',
            'no-unsafe-optional-chaining':     'error',
            'no-unused-expressions':           'error',
            'no-unused-labels':                'error',
            'no-unused-private-class-members': 'error',
            'no-unused-vars':                  'off',
            'no-use-before-define':            'off',
            'no-useless-assignment':           'error',
            'no-useless-backreference':        'error',
            'no-useless-call':                 'error',
            'no-useless-catch':                'error',
            'no-useless-computed-key':         'error',
            'no-useless-concat':               'error',
            'no-useless-constructor':          'error',
            'no-useless-escape':               'error',
            'no-useless-rename':               'error',
            'no-useless-return':               'error',
            'no-var':                          'error',
            'no-void':                         'off',
            'no-warning-comments':             'error',
            'no-with':                         'error',
            'object-shorthand':                'error',
            'one-var':                         [
                'error',
                'never'
            ],

            // cugel custom rules
            'cugel/no-arithmetic-on-branded-primitives': [ 'error' ],
            'cugel/no-branded-primitive-cast':           [ 'error' ],
            'cugel/no-in-operator-narrowing':            [ 'off' ],
            'cugel/no-nullish-narrowing-cast':           [ 'error' ],
            'cugel/no-top-level-await':                  [ 'error' ],
            // tsc's noUnusedLocals covers this; the dead-code fixer enables it.
            'cugel/no-unused-locals':                    [ 'off' ],
            'cugel/no-void-non-promise':                 [ 'error' ],
            'cugel/no-void-without-catch':               [ 'error' ],
            'cugel/prefer-template-on-long-lines':       [ 'error' ],
            'cugel/enum-declaration':                    [ 'error' ],
            'cugel/id-acronym-casing':                   [ 'off' ],
            'cugel/require-assert-unreachable':          [ 'error' ],
            'cugel/require-function-options-type':       [ 'error' ],
            'cugel/require-index-barrel':                [ 'error' ],
            'cugel/template-placeholder-indent':         [ 'error' ],
            'cugel/zod-schema-declaration':              [ 'error' ],
            'cugel/computed-key-spacing':                [ 'error' ],
            'cugel/multiline-padding':                   [ 'error' ],

            'operator-assignment': [
                'error',
                'always'
            ],
            'prefer-arrow-callback': [
                'error',
                {
                    allowNamedFunctions: false,
                    allowUnboundThis:    false
                }
            ],
            'prefer-arrow/prefer-arrow-functions': [
                'error',
                {
                    allowStandaloneDeclarations: false,
                    classPropertiesAllowed:      false,
                    disallowPrototype:           true,
                    singleReturnOnly:            false
                }
            ],
            'prefer-const': [
                'error',
                { destructuring: 'all' }
            ],
            'prefer-destructuring':           'off',
            'prefer-exponentiation-operator': 'off',
            'prefer-named-capture-group':     'off',
            'prefer-numeric-literals':        'error',
            'prefer-object-has-own':          'error',
            'prefer-object-spread':           'error',
            'prefer-promise-reject-errors':   'error',
            'prefer-regex-literals':          'error',
            'prefer-rest-params':             'off',
            'prefer-spread':                  'off',
            'prefer-template':                'error',
            'preserve-caught-error':          'off',

            // promise rules
            'promise/always-return':             'off',
            'promise/avoid-new':                 'off',
            'promise/catch-or-return':           'off',
            'promise/no-callback-in-promise':    'off',
            'promise/no-multiple-resolved':      'error',
            'promise/no-native':                 'off',
            'promise/no-nesting':                'off',
            'promise/no-new-statics':            'error',
            'promise/no-promise-in-callback':    'error',
            'promise/no-return-in-finally':      'off',
            'promise/no-return-wrap':            'error',
            'promise/param-names':               'error',
            'promise/prefer-await-to-callbacks': 'off',
            'promise/prefer-await-to-then':      'off',
            'promise/prefer-catch':              'off',
            'promise/spec-only':                 'error',
            'promise/valid-params':              'error',

            'radix': 'error',

            'require-atomic-updates': 'off',
            'require-await':          'off',
            'require-unicode-regexp': 'off',
            'require-yield':          'error',

            // security rules
            'security/detect-bidi-characters':                'error',
            'security/detect-buffer-noassert':                'error',
            'security/detect-child-process':                  'error',
            'security/detect-disable-mustache-escape':        'error',
            'security/detect-eval-with-expression':           'error',
            'security/detect-new-buffer':                     'error',
            'security/detect-no-csrf-before-method-override': 'error',
            'security/detect-non-literal-fs-filename':        'off',
            'security/detect-non-literal-regexp':             'error',
            'security/detect-non-literal-require':            'error',
            'security/detect-object-injection':               'off',
            'security/detect-possible-timing-attacks':        'off',
            'security/detect-pseudoRandomBytes':              'error',
            'security/detect-unsafe-regex':                   'off',

            // node rules (eslint-plugin-n, replaces removed ESLint core Node.js rules)
            'n/callback-return':                       'off',
            'n/exports-style':                         'off',
            'n/file-extension-in-import':              'off',
            'n/global-require':                        'off',
            'n/handle-callback-err':                   'error',
            'n/hashbang':                              'off',
            'n/no-callback-literal':                   'off',
            'n/no-deprecated-api':                     'error',
            'n/no-exports-assign':                     'off',
            'n/no-extraneous-import':                  'off',
            'n/no-extraneous-require':                 'off',
            'n/no-missing-import':                     'off',
            'n/no-missing-require':                    'off',
            'n/no-mixed-requires':                     'error',
            'n/no-new-require':                        'error',
            'n/no-path-concat':                        'error',
            'n/no-process-env':                        'off',
            'n/no-process-exit':                       'error',
            'n/no-restricted-import':                  'off',
            'n/no-restricted-require':                 'off',
            'n/no-sync':                               'error',
            'n/no-top-level-await':                    'error',
            'n/no-unpublished-bin':                    'off',
            'n/no-unpublished-import':                 'off',
            'n/no-unpublished-require':                'off',
            'n/no-unsupported-features/es-builtins':   'error',
            'n/no-unsupported-features/es-syntax':     'off',
            'n/no-unsupported-features/node-builtins': 'off',
            'n/prefer-global/buffer':                  'off',
            'n/prefer-global/console':                 'error',
            'n/prefer-global/crypto':                  'off',
            'n/prefer-global/process':                 'error',
            'n/prefer-global/text-decoder':            'error',
            'n/prefer-global/text-encoder':            'error',
            'n/prefer-global/timers':                  'error',
            'n/prefer-global/url':                     'error',
            'n/prefer-global/url-search-params':       'error',
            'n/prefer-node-protocol':                  'error',
            'n/prefer-promises/dns':                   'off',
            'n/prefer-promises/fs':                    'error',
            'n/process-exit-as-throw':                 'error',

            'sort-export-all/sort-export-all': [ 'error' ],
            'sort-imports':                    [ 'off' ],
            'sort-keys':                       'off',
            'sort-keys/sort-keys-fix':         'off',
            'sort-vars':                       'off',
            'strict':                          'off',
            'symbol-description':              'off',
            'unicode-bom':                     'error',

            // unicorn rules
            'unicorn/better-regex':                         'error',
            'unicorn/catch-error-name':                     'off',
            'unicorn/consistent-destructuring':             'off',
            'unicorn/consistent-empty-array-spread':        'error',
            'unicorn/consistent-function-scoping':          'off',
            'unicorn/consistent-template-literal-escape':   'error',
            'unicorn/custom-error-definition':              'error',
            'unicorn/empty-brace-spaces':                   'off',
            'unicorn/error-message':                        'error',
            'unicorn/escape-case':                          'off',
            'unicorn/expiring-todo-comments':               'off',
            'unicorn/explicit-length-check':                'off',
            'unicorn/filename-case':                        'off',
            'unicorn/import-style':                         'off',
            'unicorn/new-for-builtins':                     'off',
            'unicorn/no-abusive-eslint-disable':            'error',
            'unicorn/no-anonymous-default-export':          'error',
            'unicorn/no-array-callback-reference':          'off',
            'unicorn/no-array-for-each':                    'off',
            'unicorn/no-array-method-this-argument':        'error',
            'unicorn/prefer-single-call':                   'error',
            'unicorn/no-array-reduce':                      'off',
            'unicorn/no-await-expression-member':           'off',
            'unicorn/no-await-in-promise-methods':          'error',
            'unicorn/no-console-spaces':                    'error',
            'unicorn/no-document-cookie':                   'error',
            'unicorn/no-empty-file':                        'error',
            'unicorn/no-for-loop':                          'off',
            'unicorn/no-hex-escape':                        'error',
            'unicorn/no-instanceof-builtins':               'off',
            'unicorn/no-invalid-fetch-options':             'error',
            'unicorn/no-invalid-remove-event-listener':     'error',
            'unicorn/no-keyword-prefix':                    'off',
            'unicorn/no-unnecessary-slice-end':             'error',
            'unicorn/no-lonely-if':                         'off',
            'unicorn/no-magic-array-flat-depth':            'error',
            'unicorn/no-negated-condition':                 'error',
            'unicorn/no-negation-in-equality-check':        'error',
            'unicorn/no-nested-ternary':                    'off',
            'unicorn/no-new-array':                         'off',
            'unicorn/no-new-buffer':                        'error',
            'unicorn/no-null':                              'off',
            'unicorn/no-object-as-default-parameter':       'off',
            'unicorn/no-process-exit':                      'off',
            'unicorn/no-single-promise-in-promise-methods': 'error',
            'unicorn/no-static-only-class':                 'error',
            'unicorn/no-thenable':                          'off',
            'unicorn/no-this-assignment':                   'error',
            'unicorn/no-typeof-undefined':                  'error',
            'unicorn/no-unnecessary-await':                 'error',
            'unicorn/no-unnecessary-polyfills':             'error',
            'unicorn/no-unreadable-array-destructuring':    'error',
            'unicorn/no-unreadable-iife':                   'error',
            'unicorn/no-unused-properties':                 'error',
            'unicorn/no-useless-fallback-in-spread':        'error',
            'unicorn/no-useless-iterator-to-array':         'error',
            'unicorn/no-useless-length-check':              'error',
            'unicorn/no-useless-promise-resolve-reject':    'error',
            'unicorn/no-useless-spread':                    'error',
            'unicorn/no-useless-switch-case':               'error',
            'unicorn/no-useless-undefined':                 'off',
            'unicorn/no-zero-fractions':                    'error',
            'unicorn/number-literal-case':                  'error',
            'unicorn/numeric-separators-style':             [
                'error',
                { number: { minimumDigits: 5 } }
            ],
            'unicorn/prefer-add-event-listener':            'error',
            'unicorn/prefer-array-find':                    'error',
            'unicorn/prefer-array-flat':                    'error',
            'unicorn/prefer-array-flat-map':                'error',
            'unicorn/prefer-array-index-of':                'error',
            'unicorn/prefer-array-some':                    'error',
            'unicorn/prefer-at':                            'error',
            'unicorn/prefer-blob-reading-methods':          'error',
            'unicorn/prefer-code-point':                    'error',
            'unicorn/prefer-date-now':                      'error',
            'unicorn/prefer-default-parameters':            'error',
            'unicorn/prefer-dom-node-append':               'off',
            'unicorn/prefer-dom-node-dataset':              'off',
            'unicorn/prefer-dom-node-remove':               'off',
            'unicorn/prefer-dom-node-text-content':         'error',
            'unicorn/prefer-event-target':                  'off',
            'unicorn/prefer-export-from':                   'error',
            'unicorn/prefer-includes':                      'off',
            'unicorn/prefer-json-parse-buffer':             'off',
            'unicorn/prefer-keyboard-event-key':            'error',
            'unicorn/prefer-logical-operator-over-ternary': 'off',
            'unicorn/prefer-math-trunc':                    'off',
            'unicorn/prefer-modern-dom-apis':               'off',
            'unicorn/prefer-modern-math-apis':              'error',
            'unicorn/prefer-module':                        'off',
            'unicorn/prefer-native-coercion-functions':     'off',
            'unicorn/prefer-negative-index':                'error',
            'unicorn/prefer-node-protocol':                 'error',
            'unicorn/prefer-number-properties':             'error',
            'unicorn/prefer-object-from-entries':           'error',
            'unicorn/prefer-optional-catch-binding':        'error',
            'unicorn/prefer-prototype-methods':             'error',
            'unicorn/prefer-query-selector':                'off',
            'unicorn/prefer-reflect-apply':                 'off',
            'unicorn/prefer-regexp-test':                   'error',
            'unicorn/prefer-set-has':                       'error',
            'unicorn/prefer-set-size':                      'error',
            'unicorn/prefer-simple-condition-first':        'error',
            'unicorn/prefer-spread':                        'error',
            'unicorn/prefer-string-raw':                    'error',
            'unicorn/prefer-string-replace-all':            'error',
            'unicorn/prefer-string-slice':                  'error',
            'unicorn/prefer-string-starts-ends-with':       'error',
            'unicorn/prefer-string-trim-start-end':         'error',
            'unicorn/prefer-structured-clone':              'error',
            'unicorn/prefer-switch':                        'off',
            'unicorn/prefer-ternary':                       [
                'error',
                'only-single-line'
            ],
            'unicorn/prefer-top-level-await':                  'off',
            'unicorn/prefer-type-error':                       'error',
            'unicorn/prevent-abbreviations':                   'off',
            'unicorn/relative-url-style':                      'error',
            'unicorn/require-array-join-separator':            'error',
            'unicorn/require-number-to-fixed-digits-argument': 'error',
            'unicorn/require-post-message-target-origin':      'error',
            'unicorn/string-content':                          'off',
            'unicorn/switch-case-braces':                      [
                'error',
                'avoid'
            ],
            'unicorn/switch-case-break-position': 'off',
            'unicorn/template-indent':            [
                'error',
                {
                    functions: [],
                    indent:    4,
                    selectors: [ 'TemplateLiteral' ],
                    tags:      []
                }
            ],
            'unicorn/text-encoding-identifier-case': 'error',
            'unicorn/throw-new-error':               'error',

            // New unicorn rules
            'unicorn/consistent-assert':                    'error',
            'unicorn/consistent-date-clone':                'error',
            'unicorn/consistent-existence-index-check':     'error',
            'unicorn/no-accessor-recursion':                'error',
            'unicorn/no-array-reverse':                     'error',
            'unicorn/no-array-sort':                        'error',
            'unicorn/no-immediate-mutation':                'error',
            'unicorn/no-named-default':                     'error',
            'unicorn/no-unnecessary-array-flat-depth':      'error',
            'unicorn/no-unnecessary-array-splice-count':    'error',
            'unicorn/no-useless-collection-argument':       'error',
            'unicorn/no-useless-error-capture-stack-trace': 'error',
            'unicorn/prefer-bigint-literals':               'error',
            'unicorn/prefer-class-fields':                  'error',
            'unicorn/prefer-classlist-toggle':              'error',
            'unicorn/prefer-global-this':                   'off',
            'unicorn/prefer-import-meta-properties':        'error',
            'unicorn/prefer-math-min-max':                  'error',
            'unicorn/prefer-response-static-json':          'error',
            'unicorn/require-module-attributes':            'error',
            'unicorn/isolated-functions':                   'off',
            'unicorn/require-module-specifiers':            'off',

            // ========================
            // Rules added by newer plugin versions than the config was last reviewed
            // against. Listed so `cugel-scripts rules:unused` stays clean; the
            // unicorn ones are off until reviewed one by one.
            // ========================
            '@typescript-eslint/no-generated-empty-object-type':    'off',
            '@typescript-eslint/no-unsafe-enum-assignment':         'error',
            'n/prefer-import/assert-strict':                        'off',
            'n/prefer-process-get-builtin-module':                  'off',
            'security/detect-invisible-characters':                 'error',
            'unicorn/better-dom-traversing':                        'off',
            'unicorn/class-reference-in-static-methods':            'off',
            'unicorn/comma-spacing':                                'off',
            'unicorn/comment-content':                              'off',
            'unicorn/consistent-arrow-return-style':                'off',
            'unicorn/consistent-boolean-name':                      'off',
            'unicorn/consistent-class-member-order':                'off',
            'unicorn/consistent-compound-words':                    'off',
            'unicorn/consistent-conditional-object-spread':         'off',
            'unicorn/consistent-export-decorator-position':         'off',
            'unicorn/consistent-function-style':                    'off',
            'unicorn/consistent-json-file-read':                    'off',
            'unicorn/consistent-optional-chaining':                 'off',
            'unicorn/consistent-tuple-labels':                      'off',
            'unicorn/default-export-style':                         'off',
            'unicorn/dom-node-dataset':                             'off',
            'unicorn/explicit-timer-delay':                         'off',
            'unicorn/id-match':                                     'off',
            'unicorn/indent':                                       'off',
            'unicorn/iteration-fallback-style':                     'off',
            'unicorn/key-name-casing':                              'off',
            'unicorn/logical-assignment-operators':                 'off',
            'unicorn/max-nested-calls':                             'off',
            'unicorn/name-replacements':                            'off',
            'unicorn/no-accidental-bitwise-operator':               'off',
            'unicorn/no-array-concat-in-loop':                      'off',
            'unicorn/no-array-fill-with-reference-type':            'off',
            'unicorn/no-array-from-fill':                           'off',
            'unicorn/no-array-front-mutation':                      'off',
            'unicorn/no-array-sort-for-min-max':                    'off',
            'unicorn/no-array-splice':                              'off',
            'unicorn/no-asterisk-prefix-in-documentation-comments': 'off',
            'unicorn/no-async-iterator-callback':                   'off',
            'unicorn/no-async-promise-finally':                     'off',
            'unicorn/no-barrel-files':                              'off',
            'unicorn/no-blob-to-file':                              'off',
            'unicorn/no-boolean-sort-comparator':                   'off',
            'unicorn/no-break-in-nested-loop':                      'off',
            'unicorn/no-canvas-to-image':                           'off',
            'unicorn/no-chained-comparison':                        'off',
            'unicorn/no-collection-bracket-access':                 'off',
            'unicorn/no-computed-property-existence-check':         'off',
            'unicorn/no-conflicting-constraints':                   'off',
            'unicorn/no-confusing-array-splice':                    'off',
            'unicorn/no-confusing-array-with':                      'off',
            'unicorn/no-constant-zero-expression':                  'off',
            'unicorn/no-declarations-before-early-exit':            'off',
            'unicorn/no-double-comparison':                         'off',
            'unicorn/no-duplicate-if-branches':                     'off',
            'unicorn/no-duplicate-logical-operands':                'off',
            'unicorn/no-duplicate-loops':                           'off',
            'unicorn/no-duplicate-set-values':                      'off',
            'unicorn/no-empty-link-text':                           'off',
            'unicorn/no-error-property-assignment':                 'off',
            'unicorn/no-exports-in-scripts':                        'off',
            'unicorn/no-for-each':                                  'off',
            'unicorn/no-global-object-property-assignment':         'off',
            'unicorn/no-impossible-length-comparison':              'off',
            'unicorn/no-incomplete-accessor-override':              'off',
            'unicorn/no-incorrect-query-selector':                  'off',
            'unicorn/no-incorrect-template-string-interpolation':   'off',
            'unicorn/no-ineffective-csp-directives':                'off',
            'unicorn/no-invalid-argument-count':                    'off',
            'unicorn/no-invalid-boolean-attribute-value':           'off',
            'unicorn/no-invalid-character-comparison':              'off',
            'unicorn/no-invalid-dom-token':                         'off',
            'unicorn/no-invalid-file-input-accept':                 'off',
            'unicorn/no-invalid-integrity':                         'off',
            'unicorn/no-invalid-intl-options':                      'off',
            'unicorn/no-invalid-property-descriptor':               'off',
            'unicorn/no-invalid-response-options':                  'off',
            'unicorn/no-invalid-style-set-property':                'off',
            'unicorn/no-invalid-temporal-arithmetic':               'off',
            'unicorn/no-invalid-url-protocol-comparison':           'off',
            'unicorn/no-invalid-well-known-symbol-methods':         'off',
            'unicorn/no-javascript-url':                            'off',
            'unicorn/no-late-current-target-access':                'off',
            'unicorn/no-late-event-control':                        'off',
            'unicorn/no-leading-empty-lines':                       'off',
            'unicorn/no-loop-iterable-mutation':                    'off',
            'unicorn/no-loss-of-precision':                         'off',
            'unicorn/no-manually-wrapped-comments':                 'off',
            'unicorn/no-mismatched-map-key':                        'off',
            'unicorn/no-misrefactored-assignment':                  'off',
            'unicorn/no-missing-local-resource':                    'off',
            'unicorn/no-multiple-promise-resolver-calls':           'off',
            'unicorn/no-negated-array-predicate':                   'off',
            'unicorn/no-negated-comparison':                        'off',
            'unicorn/no-non-function-verb-prefix':                  'off',
            'unicorn/no-nonstandard-builtin-properties':            'off',
            'unicorn/no-object-methods-with-collections':           'off',
            'unicorn/no-optional-chaining-on-undeclared-variable':  'off',
            'unicorn/no-prevent-default-in-passive-listener':       'off',
            'unicorn/no-redundant-comparison':                      'off',
            'unicorn/no-repeated-call-wrappers':                    'off',
            'unicorn/no-return-array-push':                         'off',
            'unicorn/no-selector-as-dom-name':                      'off',
            'unicorn/no-shorthand-property-overrides':              'off',
            'unicorn/no-subtraction-comparison':                    'off',
            'unicorn/no-this-outside-of-class':                     'off',
            'unicorn/no-top-level-assignment-in-function':          'off',
            'unicorn/no-top-level-side-effects':                    'off',
            'unicorn/no-transition-all':                            'off',
            'unicorn/no-uncalled-method':                           'off',
            'unicorn/no-undeclared-class-members':                  'off',
            'unicorn/no-unnecessary-array-flat-map':                'off',
            'unicorn/no-unnecessary-boolean-comparison':            'off',
            'unicorn/no-unnecessary-default-arguments':             'off',
            'unicorn/no-unnecessary-fetch-options':                 'off',
            'unicorn/no-unnecessary-global-this':                   'off',
            'unicorn/no-unnecessary-nested-ternary':                'off',
            'unicorn/no-unnecessary-parameters':                    'off',
            'unicorn/no-unnecessary-splice':                        'off',
            'unicorn/no-unnecessary-string-trim':                   'off',
            'unicorn/no-unreadable-for-of-expression':              'off',
            'unicorn/no-unreadable-new-expression':                 'off',
            'unicorn/no-unreadable-object-destructuring':           'off',
            'unicorn/no-unsafe-buffer-conversion':                  'off',
            'unicorn/no-unsafe-dom-html':                           'off',
            'unicorn/no-unsafe-json-serialization':                 'off',
            'unicorn/no-unsafe-promise-all-settled-values':         'off',
            'unicorn/no-unsafe-property-key':                       'off',
            'unicorn/no-unsafe-sqlite-interpolation':               'off',
            'unicorn/no-unsafe-string-replacement':                 'off',
            'unicorn/no-unused-builtin-method-return':              'off',
            'unicorn/no-unused-iterator-helper':                    'off',
            'unicorn/no-url-in-search-params':                      'off',
            'unicorn/no-useless-boolean-cast':                      'off',
            'unicorn/no-useless-coercion':                          'off',
            'unicorn/no-useless-compound-assignment':               'off',
            'unicorn/no-useless-concat':                            'off',
            'unicorn/no-useless-continue':                          'off',
            'unicorn/no-useless-delete-check':                      'off',
            'unicorn/no-useless-else':                              'off',
            'unicorn/no-useless-logical-operand':                   'off',
            'unicorn/no-useless-override':                          'off',
            'unicorn/no-useless-re-export':                         'off',
            'unicorn/no-useless-recursion':                         'off',
            'unicorn/no-useless-set-construction':                  'off',
            'unicorn/no-useless-template-literals':                 'off',
            'unicorn/no-using-resource-escape':                     'off',
            'unicorn/no-xor-as-exponentiation':                     'off',
            'unicorn/operator-assignment':                          'off',
            'unicorn/prefer-abort-signal-any':                      'off',
            'unicorn/prefer-abort-signal-timeout':                  'off',
            'unicorn/prefer-add-event-listener-options':            'off',
            'unicorn/prefer-aggregate-error':                       'off',
            'unicorn/prefer-array-from-async':                      'off',
            'unicorn/prefer-array-from-map':                        'off',
            'unicorn/prefer-array-from-range':                      'off',
            'unicorn/prefer-array-iterable-methods':                'off',
            'unicorn/prefer-array-last-methods':                    'off',
            'unicorn/prefer-array-slice':                           'off',
            'unicorn/prefer-await':                                 'off',
            'unicorn/prefer-block-statement-over-iife':             'off',
            'unicorn/prefer-boolean-return':                        'off',
            'unicorn/prefer-combined-guards':                       'off',
            'unicorn/prefer-continue':                              'off',
            'unicorn/prefer-direct-iteration':                      'off',
            'unicorn/prefer-dispose':                               'off',
            'unicorn/prefer-dom-node-html-methods':                 'off',
            'unicorn/prefer-dom-node-replace-children':             'off',
            'unicorn/prefer-early-return':                          'off',
            'unicorn/prefer-else-if':                               'off',
            'unicorn/prefer-error-is-error':                        'off',
            'unicorn/prefer-escaped-irregular-whitespace':          'off',
            'unicorn/prefer-flat-math-min-max':                     'off',
            'unicorn/prefer-get-or-insert-computed':                'off',
            'unicorn/prefer-global-number-constants':               'off',
            'unicorn/prefer-group-by':                              'off',
            'unicorn/prefer-has-check':                             'off',
            'unicorn/prefer-hoisting-branch-code':                  'off',
            'unicorn/prefer-https':                                 'off',
            'unicorn/prefer-identifier-import-export-specifiers':   'off',
            'unicorn/prefer-includes-over-repeated-comparisons':    'off',
            'unicorn/prefer-iterable-in-constructor':               'off',
            'unicorn/prefer-iterator-concat':                       'off',
            'unicorn/prefer-iterator-helpers':                      'off',
            'unicorn/prefer-iterator-to-array':                     'off',
            'unicorn/prefer-iterator-to-array-at-end':              'off',
            'unicorn/prefer-iterator-zip':                          'off',
            'unicorn/prefer-json-import':                           'off',
            'unicorn/prefer-literal-ascii':                         'off',
            'unicorn/prefer-location-assign':                       'off',
            'unicorn/prefer-map-from-entries':                      'off',
            'unicorn/prefer-math-abs':                              'off',
            'unicorn/prefer-math-constants':                        'off',
            'unicorn/prefer-minimal-ternary':                       'off',
            'unicorn/prefer-number-coercion':                       'off',
            'unicorn/prefer-number-is-safe-integer':                'off',
            'unicorn/prefer-object-define-properties':              'off',
            'unicorn/prefer-object-destructuring-defaults':         'off',
            'unicorn/prefer-object-iterable-methods':               'off',
            'unicorn/prefer-observer-apis':                         'off',
            'unicorn/prefer-path2d':                                'off',
            'unicorn/prefer-private-class-fields':                  'off',
            'unicorn/prefer-promise-static-methods':                'off',
            'unicorn/prefer-promise-try':                           'off',
            'unicorn/prefer-promise-with-resolvers':                'off',
            'unicorn/prefer-queue-microtask':                       'off',
            'unicorn/prefer-regexp-escape':                         'off',
            'unicorn/prefer-scoped-selector':                       'off',
            'unicorn/prefer-set-methods':                           'off',
            'unicorn/prefer-short-arrow-method':                    'off',
            'unicorn/prefer-short-escape-sequences':                'off',
            'unicorn/prefer-simple-sort-comparator':                'off',
            'unicorn/prefer-simplified-conditions':                 'off',
            'unicorn/prefer-single-array-predicate':                'off',
            'unicorn/prefer-single-object-destructuring':           'off',
            'unicorn/prefer-single-replace':                        'off',
            'unicorn/prefer-smaller-scope':                         'off',
            'unicorn/prefer-split-limit':                           'off',
            'unicorn/prefer-string-match-all':                      'off',
            'unicorn/prefer-string-pad-start-end':                  'off',
            'unicorn/prefer-string-repeat':                         'off',
            'unicorn/prefer-temporal':                              'off',
            'unicorn/prefer-temporal-conversion':                   'off',
            'unicorn/prefer-then-catch':                            'off',
            'unicorn/prefer-toggle-attribute':                      'off',
            'unicorn/prefer-type-literal-last':                     'off',
            'unicorn/prefer-uint8array-base64':                     'off',
            'unicorn/prefer-uint8array-hex':                        'off',
            'unicorn/prefer-unary-minus':                           'off',
            'unicorn/prefer-unicode-code-point-escapes':            'off',
            'unicorn/prefer-url-can-parse':                         'off',
            'unicorn/prefer-url-href':                              'off',
            'unicorn/prefer-url-search-parameters':                 'off',
            'unicorn/prefer-while-loop-condition':                  'off',
            'unicorn/require-array-sort-compare':                   'off',
            'unicorn/require-css-escape':                           'off',
            'unicorn/require-frontmatter-fields':                   'off',
            'unicorn/require-passive-events':                       'off',
            'unicorn/require-proxy-trap-boolean-return':            'off',
            'unicorn/require-text-decoder-streaming':               'off',
            'unicorn/single-line-block-comment-style':              'off',
            'unicorn/try-complexity':                               'off',

            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars':    'off',
            'use-isnan':                        'error',
            'valid-typeof':                     'error',
            'vars-on-top':                      'off',
            'yoda':                             'error'
        },

        settings: {
            'import-x/resolver-next': [ createTypeScriptImportResolver() ]
        }
    },

    // Type-only directories: no runtime code.
    {
        files: [ 'src/types/**/*.ts' ],
        rules: {
            'no-restricted-syntax': [
                'error',
                ...RESTRICTED_IMPORT_EXPORT_SYNTAX,
                {
                    selector: 'VariableDeclaration',
                    message:  'src/types/ must only contain type definitions. Move runtime values elsewhere.'
                },
                {
                    selector: 'FunctionDeclaration',
                    message:  'src/types/ must only contain type definitions. Move functions elsewhere.'
                },
                {
                    selector: 'ClassDeclaration',
                    message:  'src/types/ must only contain type definitions. Move classes elsewhere.'
                },
                {
                    selector: 'TSEnumDeclaration',
                    message:  'src/types/ must only contain type definitions. Move enums elsewhere.'
                },
                {
                    selector: 'ExpressionStatement',
                    message:  'src/types/ must only contain type definitions. Move runtime calls out of src/types/.'
                }
            ]
        }
    },

    // index.ts barrel-file override: must contain only `export * from`
    // statements, and allow consecutive `export * from` lines without
    // forcing blank lines between them.
    {
        files: [ '**/index.ts' ],
        rules: {
            '@stylistic/padding-line-between-statements': [
                'error',
                ...PADDING_LINE_RULES,
                {
                    prev:      'export',
                    next:      'export',
                    blankLine: 'any'
                }
            ],
            'no-restricted-syntax': [
                'error',
                ...RESTRICTED_IMPORT_EXPORT_SYNTAX,
                {
                    selector: 'Program > :not(ExportAllDeclaration)',
                    message:  'index.ts files must only contain `export * from` statements.'
                }
            ]
        }
    },

    // test override
    {
        files:           [ 'test/**/*.ts', 'test/**/*.tsx', '**/*.test.ts', '**/*.test.tsx' ],
        languageOptions: {
            globals: {
                ...globals.vitest
            }
        },
        rules: {
            '@typescript-eslint/no-unsafe-assignment': 'off',
            'max-lines':                               'off',
            'cugel/enum-declaration':                  'off',
            'cugel/no-void-non-promise':               'off',
            'cugel/no-void-without-catch':             'off',
            'cugel/zod-schema-declaration':            'off',
            'security/detect-non-literal-regexp':      'off'
        }
    },

    // scripts override
    {
        files: [ 'scripts/**/*.ts', 'scripts/**/*.tsx' ],
        rules: {
            '@stylistic/max-len':          'off',
            'no-console':                  'off',
            'cugel/no-top-level-await':    'off',
            'cugel/no-void-non-promise':   'off',
            'cugel/no-void-without-catch': 'off',
            'n/no-top-level-await':        'off'
        }
    },

    // Root config files are default-exported by convention of their tools.
    {
        files: [ 'eslint.config.ts', 'vitest.config.ts', 'esbuild.config.ts' ],
        rules: {
            'import/no-default-export': 'off'
        }
    },

    ...overrides
];
