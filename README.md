# cugel-scripts

Opinionated TypeScript tooling in one package: an ESLint config and plugin, tsconfig bases, an esbuild-based library build, vitest presets, and a CLI that runs the whole static battery. It is the common base for [bluepnume](https://github.com/bluepnume) open-source modules; start a new one from [cugel-boilerplate](https://github.com/bluepnume/cugel-boilerplate).

## Install

```sh
npm install --save-dev cugel-scripts
```

Requires Node 24+. The package brings its own ESLint, TypeScript (the native compiler for type checks, the JS compiler for lint), esbuild, vitest, knip, dpdm, ts-unused-exports and format-imports, so a consumer declares only `cugel-scripts`.

## Set up a repo

Three root files, each a few lines:

```ts
// eslint.config.ts
import { eslintConfig } from 'cugel-scripts/eslint';

export default eslintConfig({ root: import.meta.dirname });
```

```json
// tsconfig.json
{
    "extends": "cugel-scripts/tsconfig/node.json",
    "compilerOptions": { "rootDir": "./", "types": [ "node", "vitest/globals" ] },
    "include": [ "src/**/*.ts", "test/**/*.ts" ]
}
```

```ts
// vitest.config.ts
import { vitestConfig } from 'cugel-scripts/vitest';

export default vitestConfig({ root: import.meta.dirname });
```

Then `package.json` scripts are one CLI call each:

```json
{
    "type": "module",
    "sideEffects": false,
    "scripts": {
        "build": "cugel-scripts build",
        "fix": "cugel-scripts fix --changed",
        "test:static": "cugel-scripts static",
        "test:unit": "cugel-scripts test --coverage",
        "test": "npm run test:static && npm run test:unit && npm run build"
    }
}
```

Root config files (`eslint.config.ts`, `vitest.config.ts`, `cugel.config.ts`) deliberately stay out of `tsconfig.json`'s `include`; the ESLint config type-checks them through a default project instead.

## CLI

```
cugel-scripts <command> [options]

  build             Compile src/ to dist/ (per-file ESM + declarations)
  circular          Detect circular dependencies (dpdm)
  dead              Detect dead code (knip, ts-unused-exports, dead exports); --fix removes it
  dead:deps         Detect unused / unlisted dependencies (knip); --fix removes them
  fix               Fix imports then eslint --fix; --changed limits to git-changed files
  imports           Check import formatting; --fix rewrites; --changed limits to git-changed files
  imports:missing   Add missing imports (--all | --changed | <files>)
  lint              eslint; --fix, --changed
  rules:unused      List eslint rules the config does not mention
  static            tsc + lint + imports + circular + dead; --changed, --serial
  test              vitest run; --coverage, --watch, <filters>
  tsc               Type-check with the native TypeScript compiler
```

`static` runs its five jobs concurrently and reports each; `--serial` runs them one at a time for readable output. `--changed` narrows lint and import formatting to files git sees as changed; the type check, cycle check and dead-code check are whole-project by nature.

`imports:missing` resolves every "cannot find name" diagnostic through the TypeScript language service, preferring in-repo sources over bare module names, then formats. It is the intended way to add imports: write the code, run it once.

`dead --fix` loops knip, the barrel-aware dead-export walker and a minimal ESLint pass that collapses the locals and imports left behind, until the three detectors agree the tree is clean.

## Build

`cugel-scripts build` emits one ESM file per source file under `dist/`, mirroring the source tree, with relative imports rewritten to carry explicit `.js` extensions so Node can load the output without a bundler and bundlers can tree-shake it. Declarations come from the native TypeScript compiler alongside. Publish with `"sideEffects": false` and point `exports` at `dist/src/...`.

An optional single-file bundle, for `<script>` consumers, is configured in `cugel.config.ts`:

```ts
export default {
    build: {
        bundle: { entry: 'src/index.ts', outfile: 'dist/my-lib.min.js', globalName: 'MyLib' }
    }
};
```

The same function is available programmatically from `cugel-scripts/build`.

## ESLint

`eslintConfig({ root, environment, ignores, overrides })` returns a flat config array. `environment` is `node` (default), `browser` or `universal` and only changes which globals are known. `overrides` are appended last.

The config is stylistic-only: formatting is enforced by `@stylistic` rules and `cugel-scripts fix`, not prettier. Type-aware rules are on by default, which is why the config needs a `tsconfig.json` at `root`.

The `cugel/` plugin carries these rules:

| Rule | Enforces |
| --- | --- |
| `require-function-options-type` | Functions with two or more parameters take a single destructured options object with a named type |
| `require-assert-unreachable` | A `switch` over an enum ends in `default: throw assertUnreachable(x)` |
| `require-index-barrel` | `index.ts` files contain only `export * from` |
| `enum-declaration` | Enums are declared `UPPER_CASE` with explicit string values |
| `no-branded-primitive-cast`, `no-arithmetic-on-branded-primitives` | Branded primitives are constructed and combined deliberately |
| `no-nullish-narrowing-cast` | `as` never removes `null` or `undefined` from a type |
| `no-in-operator-narrowing` | Discriminate unions on a field, not with `in` (off by default) |
| `no-void-non-promise`, `no-void-without-catch` | `void` only discards promises, and only ones with a `.catch` |
| `no-top-level-await` | Modules do no work at import time |
| `zod-schema-declaration` | Zod schemas are module-level, camelCase, and end in `Schema` |
| `prefer-template-on-long-lines`, `template-placeholder-indent`, `multiline-padding`, `computed-key-spacing` | Layout |
| `id-acronym-casing` | Acronyms in identifiers (off by default) |
| `no-unused-locals` | Used by `dead --fix` to collapse leftover locals |

`cugel-scripts rules:unused` lists every rule the resolved config leaves unmentioned, so the config stays a complete statement of opinion as plugins add rules.

## Tests

`vitestConfig({ root, coverageThreshold, browser, coverageExclude })` turns on globals, v8 coverage with a 90% threshold on every metric, and a 60s test timeout. With `browser: true`, files named `*.browser.test.ts` run in headless Chromium through Playwright as a second project; run `npx playwright install chromium` once.

## Not included

`eslint-plugin-react` is left out because it does not declare support for ESLint 10, and `eslint-plugin-import` is replaced by `eslint-plugin-import-x` under the same `import/` rule prefix for the same reason.

## License

MIT
