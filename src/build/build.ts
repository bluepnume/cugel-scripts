import type { Plugin } from 'esbuild';

import { build as esbuild } from 'esbuild';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { listSources, nativeTscBin, runOrThrow } from '../lib';

export type BundleOptions = {
    // Entry file, relative to root (e.g. 'src/index.ts').
    readonly entry : string,
    // Output file, relative to root (e.g. 'dist/bundle.js').
    readonly outfile : string,
    readonly minify ?: boolean,
    // Expose the entry's exports on this global for `<script>` consumers.
    readonly globalName ?: string,
};

export type BuildOptions = {
    readonly root : string,
    // Source directories, relative to root. Every .ts/.tsx under them becomes
    // one output file under `outDir`, mirroring the source tree.
    readonly sourceDirs ?: ReadonlyArray<string>,
    readonly outDir ?: string,
    readonly target ?: string,
    // Remove `outDir` first.
    readonly clean ?: boolean,
    // Also emit .d.ts files with the native TypeScript compiler.
    readonly declarations ?: boolean,
    // Optional single-file bundle for browser `<script>` use.
    readonly bundle ?: BundleOptions,
};

export type BuildResult = {
    readonly files : ReadonlyArray<string>,
};

const RESOLVE_CANDIDATES = [ '.ts', '.tsx', '/index.ts', '/index.tsx' ];

// Resolves an extensionless relative import to the output path it will have
// after the build, so emitted ESM is loadable by Node without a bundler.
type RewriteRelativeImportOptions = {
    readonly importer : string,
    readonly specifier : string,
};

const rewriteRelativeImport = ({ importer, specifier } : RewriteRelativeImportOptions) : string => {
    const base = path.resolve(path.dirname(importer), specifier);

    // eslint-disable-next-line n/no-sync -- esbuild resolve hooks are synchronous by nature
    const match = RESOLVE_CANDIDATES.find(candidate => existsSync(base + candidate));

    if (match === undefined) {
        // Already has an extension, or isn't ours to rewrite.
        return specifier;
    }

    const suffix = match.startsWith('/index')
        ? '/index.js'
        : '.js';

    return specifier.replace(/\/$/, '') + suffix;
};

// Every import stays external (no bundling); relative ones get explicit .js
// extensions so the per-file output runs in Node and tree-shakes in bundlers.
const externalizeImportsPlugin : Plugin = {
    name: 'cugel-externalize-imports',

    setup: build => {
        build.onResolve({ filter: /.*/ }, args => {
            if (args.kind === 'entry-point') {
                return undefined;
            }

            return {
                path: args.path.startsWith(`.`)
                    ? rewriteRelativeImport({ importer: args.importer, specifier: args.path })
                    : args.path,
                external: true
            };
        });
    }
};

type EmitDeclarationsOptions = {
    readonly root : string,
    readonly sourceDirs : ReadonlyArray<string>,
    readonly outDir : string,
};

const emitDeclarations = async ({ root, sourceDirs, outDir } : EmitDeclarationsOptions) : Promise<void> => {
    const tempConfig = path.join(root, 'tsconfig.cugel-build.json');

    const config = {
        extends:         './tsconfig.json',
        compilerOptions: {
            noEmit:              false,
            declaration:         true,
            declarationMap:      true,
            emitDeclarationOnly: true,
            rootDir:             '.',
            outDir
        },
        include: sourceDirs.map(dir => `${ dir }/**/*`),
        exclude: [ 'node_modules', 'dist', 'coverage', '**/*.test.ts', '**/*.test.tsx' ]
    };

    await writeFile(tempConfig, `${ JSON.stringify(config, null, 4) }\n`);

    try {
        await runOrThrow({
            name:    'tsc (declarations)',
            command: nativeTscBin({ root }),
            args:    [ '-p', tempConfig ],
            cwd:     root
        });
    } finally {
        await rm(tempConfig, { force: true });
    }
};

export const build = async ({
    root,
    sourceDirs = [ 'src' ],
    outDir = 'dist',
    target = 'es2022',
    clean = true,
    declarations = true,
    bundle
} : BuildOptions) : Promise<BuildResult> => {
    const absoluteOutDir = path.resolve(root, outDir);

    if (clean) {
        await rm(absoluteOutDir, { recursive: true, force: true });
    }

    await mkdir(absoluteOutDir, { recursive: true });

    const entryPoints = (await Promise.all(
        sourceDirs.map(dir => listSources({ dir: path.resolve(root, dir) }))
    )).flat();

    await esbuild({
        entryPoints,
        outdir:    absoluteOutDir,
        outbase:   root,
        bundle:    true,
        splitting: false,
        format:    'esm',
        platform:  'neutral',
        target,
        sourcemap: true,
        logLevel:  'warning',
        plugins:   [ externalizeImportsPlugin ]
    });

    if (declarations) {
        await emitDeclarations({ root, sourceDirs, outDir });
    }

    if (bundle) {
        await esbuild({
            entryPoints: [ path.resolve(root, bundle.entry) ],
            outfile:     path.resolve(root, bundle.outfile),
            bundle:      true,
            format:      bundle.globalName === undefined
                ? 'esm'
                : 'iife',
            globalName: bundle.globalName,
            minify:     bundle.minify ?? true,
            platform:   'browser',
            target,
            sourcemap:  true,
            logLevel:   'warning'
        });
    }

    const files = entryPoints.map(entry => {
        const relative = path.relative(root, entry).replace(/\.tsx?$/, '.js');

        return path.join(absoluteOutDir, relative);
    });

    return { files };
};
