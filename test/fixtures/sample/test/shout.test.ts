import { shout, SHOUT_MARKER } from '../src';

describe('shout', () => {
    it('shouts the greeting', () => {
        expect(shout({ name: 'World' })).toBe(`HELLO, WORLD! ${ SHOUT_MARKER }`);
    });
});
