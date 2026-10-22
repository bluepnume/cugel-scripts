import type { ESLint, Linter } from 'eslint';

import unusedImportsPlugin from 'eslint-plugin-unused-imports';

import { cugelPlugin } from './plugin';

import stylisticPlugin from '@stylistic/eslint-plugin';
import parser from '@typescript-eslint/parser';

// A deliberately tiny config used by the dead-code fixer: after exports are
// stripped it collapses the now-unused locals and imports they leave behind.
// `noInlineConfig` keeps per-file disables from protecting dead code.
export const deadCodeEslintConfig = () : Array<Linter.Config> => [
    {
        files:           [ '**/*.ts', '**/*.tsx' ],
        languageOptions: {
            parser: parser as unknown as Linter.Parser
        },
        plugins: {
            'cugel':          cugelPlugin,
            'unused-imports': unusedImportsPlugin,
            '@stylistic':     stylisticPlugin as unknown as ESLint.Plugin
        },
        linterOptions: {
            noInlineConfig: true
        },
        rules: {
            'cugel/no-unused-locals':             'error',
            'unused-imports/no-unused-imports':   'error',
            '@stylistic/no-multiple-empty-lines': [
                'error',
                {
                    max:    1,
                    maxBOF: 0,
                    maxEOF: 1
                }
            ]
        }
    }
];
