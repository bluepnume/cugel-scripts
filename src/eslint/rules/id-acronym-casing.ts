import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

const messages = {
    useUpperCaseId: 'Use `ID` (uppercase) instead of `Id`: rename `{{ original }}` to `{{ replacement }}`.'
} as const;

// Match `Id` that sits as the acronym "ID" in a camelCase name:
//   - preceded by a lowercase letter, so the `Id` starts a new word
//     (skips `Id` at the start of a name like `Identifier` or `Idol`)
//   - followed by either:
//       * the end of the name (`userId`)
//       * an uppercase letter, i.e. the next word (`userIdValue`)
//       * a trailing `s` plural that itself ends the name or starts a new word
//         (`userIds`, `userIdsValue`)
//
// Examples that should match: userId, userIds, userIdValue, userIdsValue.
// Examples that should NOT match: id, idValue, Identifier, Idol, kIdleTimeout.
const ID_PATTERN_TEST = /(?<=[a-z])Id(?=s?(?:[A-Z]|$))/;
const ID_PATTERN_REPLACE = /(?<=[a-z])Id(?=s?(?:[A-Z]|$))/g;

const renameIDs = (name : string) : string => {
    return name.replaceAll(ID_PATTERN_REPLACE, 'ID');
};

// Identifiers attached to an import specifier may refer to a name owned by
// the source module rather than a local binding we control:
//   - The `imported` side is always the external name.
//   - For a non-aliased `import { fooId }`, the `local` node is a distinct
//     AST node from `imported` but shares the same name string. Renaming
//     only the local binding to `fooID` would require restructuring the
//     import to `import { fooId as fooID }`, which is a larger change than
//     a single-identifier autofix; we punt on those and require manual
//     aliasing.
const isImmutableImportName = (node : TSESTree.Identifier) : boolean => {
    const parent = node.parent;

    if (parent.type !== 'ImportSpecifier') {
        return false;
    }

    if (parent.imported === node) {
        return true;
    }

    return (
        parent.local === node &&
        parent.imported.type === 'Identifier' &&
        parent.local.name === parent.imported.name
    );
};

// Identifiers inside a re-export with a source (`export { foo } from 'lib'`)
// likewise refer to an external name.
const isInsideReExport = (node : TSESTree.Node) : boolean => {
    const grandparent = node.parent?.parent;

    return (
        grandparent?.type === 'ExportNamedDeclaration' &&
        grandparent.source !== null
    );
};

// In `const obj = { foo }` (or `const { foo } = obj`), the Property's `key`
// and `value` are separate Identifier nodes that share the same source range.
// Visiting both would produce duplicate reports and overlapping fixes for the
// same token; skip the value side so only the key reports.
const isShorthandPropertyValue = (node : TSESTree.Identifier) : boolean => {
    const parent = node.parent;

    return (
        parent.type === 'Property' &&
        parent.shorthand &&
        parent.value === node
    );
};

// In `export { foo }`, the ExportSpecifier's `local` and `exported` are
// separate Identifier nodes that share the same source range. Skip the
// `exported` side when it matches local; the `local` visit will still
// trigger and produce a single fix. When the export is aliased
// (`export { foo as bar }`), the names differ — visit both, since the alias
// is part of the module's public API and should be renamed too.
const isDuplicateExportSpecifierName = (node : TSESTree.Identifier) : boolean => {
    const parent = node.parent;

    if (parent.type !== 'ExportSpecifier') {
        return false;
    }

    if (parent.exported !== node) {
        return false;
    }

    return (
        parent.local.type === 'Identifier' &&
        parent.local.name === parent.exported.name
    );
};

const isPropertyKey = (node : TSESTree.Literal) : boolean => {
    const parent = node.parent;

    return (
        (
            parent.type === 'Property' ||
            parent.type === 'PropertyDefinition' ||
            parent.type === 'MethodDefinition' ||
            parent.type === 'TSPropertySignature' ||
            parent.type === 'TSMethodSignature'
        ) &&
        parent.key === node
    );
};

export const idAcronymCasing = {
    meta: {
        type: 'suggestion',

        docs: {
            description:
                `Enforce that the "ID" abbreviation is written as an all-caps acronym (\`fooID\`) rather than mixed case (\`fooId\`) in identifiers and property keys.`
        },

        fixable: 'code',

        messages,

        schema: []
    },

    create: (context) => {
        return {
            Identifier: (node : TSESTree.Identifier) : void => {
                if (!ID_PATTERN_TEST.test(node.name)) {
                    return;
                }

                if (isImmutableImportName(node)) {
                    return;
                }

                if (isInsideReExport(node)) {
                    return;
                }

                if (isShorthandPropertyValue(node)) {
                    return;
                }

                if (isDuplicateExportSpecifierName(node)) {
                    return;
                }

                const replacement = renameIDs(node.name);

                // The Identifier's `range` may extend past the name itself
                // when the parser attaches a `typeAnnotation` (e.g.
                // `userId: number` covers `[start, end of `: number`]`).
                // Restrict the fix to just the name characters.
                const nameStart = node.range[0];
                const nameEnd = nameStart + node.name.length;

                context.report({
                    node,
                    messageId: 'useUpperCaseId',
                    data:      { original: node.name, replacement },
                    fix:       fixer => fixer.replaceTextRange([ nameStart, nameEnd ], replacement)
                });
            },

            Literal: (node : TSESTree.Literal) : void => {
                if (typeof node.value !== 'string') {
                    return;
                }

                if (!isPropertyKey(node)) {
                    return;
                }

                if (!ID_PATTERN_TEST.test(node.value)) {
                    return;
                }

                const replacement = renameIDs(node.value);
                const quote = node.raw[0] ?? `'`;

                context.report({
                    node,
                    messageId: 'useUpperCaseId',
                    data:      { original: node.value, replacement },
                    fix:       fixer => fixer.replaceText(node, `${ quote }${ replacement }${ quote }`)
                });
            }
        };
    }
} satisfies TSESLint.RuleModule<keyof typeof messages>;
