// eslint-disable-next-line no-restricted-syntax -- this repo lints itself from source
import { eslintConfig } from './src/eslint';

export default eslintConfig({
    root:    import.meta.dirname,
    ignores: [ 'test/fixtures/**' ]
});
