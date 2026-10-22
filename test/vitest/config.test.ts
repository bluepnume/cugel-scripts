import { vitestConfig } from '../../src';

type ProjectLike = { test : { name : string, include : Array<string>, browser ?: { enabled : boolean } } };

type ConfigLike = {
    test : {
        globals : boolean,
        projects : Array<ProjectLike>,
        coverage : { thresholds : Record<string, number>, exclude : Array<string>, reportsDirectory : string },
    },
};

describe('vitestConfig', () => {
    it('defaults to a single node project with 90% thresholds', () => {
        const config = vitestConfig({ root: '/repo' }) as unknown as ConfigLike;

        expect(config.test.globals).toBe(true);
        expect(config.test.projects.map(project => project.test.name)).toEqual([ 'node' ]);
        expect(config.test.coverage.thresholds).toEqual({ lines: 90, functions: 90, branches: 90, statements: 90 });
        expect(config.test.coverage.reportsDirectory).toBe('/repo/coverage');
    });

    it('adds a Playwright browser project for *.browser.test.ts files when asked', () => {
        const config = vitestConfig({ root: '/repo', browser: true }) as unknown as ConfigLike;

        const [ node, browser ] = config.test.projects;

        expect(node?.test.include).toEqual([ 'test/**/*.test.ts', 'src/**/*.test.ts' ]);
        expect(browser?.test.name).toBe('browser');
        expect(browser?.test.include).toEqual([ 'test/**/*.browser.test.ts', 'src/**/*.browser.test.ts' ]);
        expect(browser?.test.browser?.enabled).toBe(true);
    });

    it('honours a custom threshold and extra coverage excludes', () => {
        const config = vitestConfig({ root: `/repo`, coverageThreshold: 75, coverageExclude: [ `src/generated/**` ] }) as unknown as ConfigLike;

        expect(config.test.coverage.thresholds.lines).toBe(75);
        expect(config.test.coverage.exclude).toContain('src/generated/**');
    });
});
