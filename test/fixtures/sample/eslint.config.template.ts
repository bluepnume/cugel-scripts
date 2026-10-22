// eslint-disable-next-line import/no-absolute-path -- fixture imports this repo's source
import { eslintConfig } from '__CUGEL_ROOT__/src/eslint';

export default eslintConfig({ root: import.meta.dirname });
