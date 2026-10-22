// eslint-disable-next-line no-restricted-syntax -- this repo tests itself from source
import { vitestConfig } from './src/vitest';

export default vitestConfig({
    root:            import.meta.dirname,
    coverageExclude: [ 'src/cli/main.ts' ]
});
