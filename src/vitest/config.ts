import type { ViteUserConfig } from 'vitest/config';

import path from 'node:path';

import { playwright } from '@vitest/browser-playwright';

export type VitestConfigOptions = {
    readonly root : string,
    // Minimum coverage, applied to lines, functions, branches and statements.
    readonly coverageThreshold ?: number,
    // Enable a second project that runs `*.browser.test.ts` files in headless
    // Chromium through Playwright.
    readonly browser ?: boolean,
    // Paths excluded from coverage, on top of tests and build output.
    readonly coverageExclude ?: ReadonlyArray<string>,
};

const NODE_INCLUDE = [ 'test/**/*.test.ts', 'src/**/*.test.ts' ];

const BROWSER_INCLUDE = [ 'test/**/*.browser.test.ts', 'src/**/*.browser.test.ts' ];

// Vitest config with the house defaults: globals on (so ESLint's RuleTester
// and the like find describe/it), v8 coverage with a hard threshold, and an
// optional Playwright browser project for files named *.browser.test.ts.
export const vitestConfig = ({
    root,
    coverageThreshold = 90,
    browser = false,
    coverageExclude = []
} : VitestConfigOptions) : ViteUserConfig => {
    const nodeProject = {
        test: {
            name:        'node',
            root,
            globals:     true,
            testTimeout: 60_000,
            include:     NODE_INCLUDE,
            exclude:     [ ...BROWSER_INCLUDE, '**/node_modules/**', '**/dist/**' ]
        }
    };

    const browserProject = {
        test: {
            name:        'browser',
            root,
            globals:     true,
            testTimeout: 60_000,
            include:     BROWSER_INCLUDE,
            browser:     {
                enabled:   true,
                headless:  true,
                provider:  playwright(),
                instances: [ { browser: 'chromium' } ]
            }
        }
    };

    return {
        test: {
            root,
            globals:     true,
            // Tooling-style tests spawn compilers and linters; the stock 5s
            // limit trips under load long before a test is actually hung.
            testTimeout: 60_000,
            projects:    browser
                ? [ nodeProject, browserProject ]
                : [ nodeProject ],
            coverage: {
                provider:         'v8',
                include:          [ 'src/**/*.ts', 'src/**/*.tsx' ],
                exclude:          [ '**/*.test.ts', '**/*.d.ts', 'src/**/index.ts', ...coverageExclude ],
                reporter:         [ 'text', 'html', 'lcov' ],
                reportsDirectory: path.join(root, 'coverage'),
                thresholds:       {
                    lines:      coverageThreshold,
                    functions:  coverageThreshold,
                    branches:   coverageThreshold,
                    statements: coverageThreshold
                }
            }
        }
    } as ViteUserConfig;
};
