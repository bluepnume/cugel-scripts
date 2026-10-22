import { vitestArgs } from '../../src';

describe('vitestArgs', () => {
    it('defaults to a single run', () => {
        expect(vitestArgs({ args: [] })).toEqual([ 'run' ]);
    });

    it('switches to watch mode and passes coverage and filters through', () => {
        expect(vitestArgs({ args: [ `--watch`, `--coverage`, `greet`, `shout` ] })).toEqual([ `watch`, `--coverage`, `greet`, `shout` ]);
    });
});
