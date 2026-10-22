export type GreetOptions = {
    readonly name : string,
};

export const greet = ({ name } : GreetOptions) : string => `Hello, ${ name }!`;
