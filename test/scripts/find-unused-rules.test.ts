import { findUnusedRules } from '../../src';
import { CUGEL_ROOT } from '../helpers';

describe('findUnusedRules', () => {
    it('finds no unmentioned, non-deprecated rules in this repo config', async () => {
        const unused = await findUnusedRules({ root: CUGEL_ROOT });

        expect(unused).toEqual([]);
    }, 60_000);
});
