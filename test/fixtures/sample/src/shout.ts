import { greet } from './greet';

export type ShoutOptions = {
    readonly name : string,
};

export const SHOUT_MARKER = 'SHOUT_MARKER_FOR_TREE_SHAKING_TEST';

export const shout = ({ name } : ShoutOptions) : string => `${ greet({ name }).toUpperCase() } ${ SHOUT_MARKER }`;
