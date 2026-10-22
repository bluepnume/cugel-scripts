// eslint-disable-next-line no-restricted-syntax -- rule-internal helper, not part of the barrel
import { assertExists } from '../../../src/eslint/rules/lib';

describe('assertExists', () => {
    it('returns the value when present', () => {
        expect(assertExists(0)).toBe(0);
        expect(assertExists('')).toBe('');
        expect(assertExists(false)).toBe(false);
    });

    it('throws with the default message on null and undefined', () => {
        expect(() => assertExists(null)).toThrow('Expected value to not be null or undefined');
        expect(() => assertExists(undefined)).toThrow('Expected value to not be null or undefined');
    });

    it('throws with a custom message', () => {
        expect(() => assertExists(undefined, 'custom')).toThrow('custom');
    });
});
