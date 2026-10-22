// eslint-disable-next-line import/no-absolute-path -- fixture imports this repo's source
import { vitestConfig } from '__CUGEL_ROOT__/src/vitest';

export default vitestConfig({ root: import.meta.dirname });
