// Internal helpers shared between custom ESLint rule implementations.
//
// Rule files load at lint time and can't safely import from `src/lib` (the
// project's general-purpose utility module), because that pulls in domain
// dependencies that aren't guaranteed to be loadable from the ESLint bootstrap
// context. This file is the rule-implementation-local replacement.

type AssertExistsResult<Type> = null extends Type
    ? never
    : undefined extends Type
        ? never
        : Type;

// Narrows `value` to its non-nullish form, throwing if absent. Use at sites
// where the caller has proved presence by construction (e.g. iterating bounded
// indices into a known-length array) and TypeScript can't see why.
export const assertExists = <Type>(
    value : Type | null | undefined,
    message = 'Expected value to not be null or undefined'
) : AssertExistsResult<Type> => {
    if (value === null || value === undefined) {
        throw new Error(message);
    }

    return value as AssertExistsResult<Type>;
};
