import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

const messages = {
    enumNotModuleLevel:
        `Enum \`{{ enumName }}\` must be declared at the module level. Enums declared inside functions or blocks are recreated on every call and can't be referenced by other modules.`,
    enumEmpty:
        `Enum \`{{ enumName }}\` has no members. Empty enums are usually a half-finished refactor — either add members or remove the declaration.`,
    enumMembersMissingInitializer:
        `Enum \`{{ enumName }}\` has members without explicit values ({{ memberList }}). Implicit numeric values silently shift if a member is reordered, inserted, or removed.`,
    enumMembersNotString:
        `Enum \`{{ enumName }}\` has members whose values aren't string literals ({{ memberList }}). Non-string enum values: (1) let TypeScript silently widen any \`number\` to the enum type at call sites (e.g. \`setStatus(n)\` accepts an out-of-range value), (2) serialize unpredictably across logs, DBs, and APIs, (3) defeat structural matching against incoming JSON, (4) can't be parsed by string-based \`z.enum\` schemas.`,
    enumNameNotUppercase:
        `Enum name \`{{ enumName }}\` must be UPPERCASE or UPPERCASE_WITH_UNDERSCORES (suggestion: \`{{ suggestedName }}\`).`,
    enumMembersNotUppercase:
        `Enum \`{{ enumName }}\` has members whose names aren't UPPERCASE or UPPERCASE_WITH_UNDERSCORES ({{ memberList }}).`
} as const;

type RuleContext = TSESLint.RuleContext<keyof typeof messages, ReadonlyArray<never>>;

// An enum is module-level when its declaration is a direct child of Program,
// or wrapped in `export` / `export default` that is itself a direct child of
// Program. Anything else (function bodies, blocks, if-branches, etc.) is
// considered nested.
const isModuleLevel = (node : TSESTree.TSEnumDeclaration) : boolean => {
    let target : TSESTree.Node = node;

    if (
        target.parent.type === 'ExportNamedDeclaration' ||
        target.parent.type === 'ExportDefaultDeclaration'
    ) {
        target = target.parent;
    }

    return target.parent.type === 'Program';
};

// Member key text — handles both `A = 'a'` (Identifier) and `'A-B' = 'a'`
// (Literal). The string form is rare but legal for keys with hyphens.
const getMemberName = (
    member : TSESTree.TSEnumMember
) : string => {
    return member.id.type === 'Identifier'
        ? member.id.name
        : member.id.value;
};

const isStringValue = (
    init : TSESTree.Expression
) : boolean => {
    // String literals (`= 'a'`) and template literals with no expressions
    // (`= \`a\``) are both acceptable. Anything else — numbers, identifiers,
    // member access, template strings with expressions — is rejected.
    return init.type === `Literal` && typeof init.value === `string`
        ? true
        : init.type === `TemplateLiteral` && init.expressions.length === 0;
};

const isUpperSnake = (name : string) : boolean =>
    (/^[A-Z][\dA-Z_]*$/).test(name);

// Convert any identifier-like name to UPPER_SNAKE_CASE.
//   `DigitalOceanEnvType` → `DIGITAL_OCEAN_ENV_TYPE`
//   `XMLParser`           → `XML_PARSER`
//   `myVar`               → `MY_VAR`
//   `MY_ENUM`             → `MY_ENUM` (idempotent)
const toUpperSnake = (name : string) : string =>
    name
        .replaceAll(/([\da-z])([A-Z])/g, '$1_$2')
        .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .toUpperCase();

// Walk the entire program and collect every node matching the predicate. Used
// to find enum-member access sites (e.g. `MyEnum.member`) so the autofix can
// rename them in lockstep with the declaration. Skips the `parent` cycle to
// avoid infinite recursion.
const collectNodes = <T extends TSESTree.Node>(
    root : TSESTree.Node,
    predicate : (node : TSESTree.Node) => node is T
) : Array<T> => {
    const found : Array<T> = [];

    const visit = (node : TSESTree.Node) : void => {
        if (predicate(node)) {
            found.push(node);
        }

        for (const key of Object.keys(node)) {
            if (key === 'parent') {
                continue;
            }

            const value = (node as unknown as Record<string, unknown>)[key];

            if (Array.isArray(value)) {
                for (const item of value) {
                    if (item && typeof item === 'object' && 'type' in item) {
                        visit(item as TSESTree.Node);
                    }
                }
            } else if (value && typeof value === 'object' && 'type' in value) {
                visit(value as TSESTree.Node);
            }
        }
    };

    visit(root);

    return found;
};

export const enumDeclaration = {
    meta: {
        type: 'problem',

        docs: {
            description:
                `Enforce enum declarations are module-level, non-empty, fully initialized, have string values, and use UPPER_SNAKE_CASE names.`
        },

        fixable: 'code',

        messages,

        schema: []
    },

    create: (context : RuleContext) => {
        return {
            TSEnumDeclaration: (node : TSESTree.TSEnumDeclaration) => {
                const enumName = node.id.name;

                if (!isModuleLevel(node)) {
                    context.report({
                        node:      node.id,
                        messageId: 'enumNotModuleLevel',
                        data:      { enumName }
                    });
                }

                if (node.body.members.length === 0) {
                    context.report({
                        node:      node.id,
                        messageId: 'enumEmpty',
                        data:      { enumName }
                    });
                }

                // Collect violations across all members and report each kind
                // once on the enum's name. This way a single
                // `eslint-disable-next-line` above the enum suppresses every
                // violation for that enum, instead of needing one per member.
                const missingInitializer : Array<TSESTree.TSEnumMember> = [];
                const nonStringValue : Array<string> = [];
                const nonUppercaseMembers : Array<TSESTree.TSEnumMember> = [];

                for (const member of node.body.members) {
                    if (!member.initializer) {
                        missingInitializer.push(member);

                        continue;
                    }

                    if (!isStringValue(member.initializer)) {
                        nonStringValue.push(getMemberName(member));
                    }

                    // Only check Identifier-keyed members; quoted string keys
                    // (e.g. `'A-B'`) are intentionally allowed to stay as-is
                    // since they're typically chosen to match wire formats.
                    if (
                        member.id.type === 'Identifier' &&
                        !isUpperSnake(member.id.name)
                    ) {
                        nonUppercaseMembers.push(member);
                    }
                }

                if (missingInitializer.length > 0) {
                    context.report({
                        node:      node.id,
                        messageId: 'enumMembersMissingInitializer',
                        data:      {
                            enumName,
                            memberList: missingInitializer.map(getMemberName).join(', ')
                        },

                        // Fill in `= '<lowercased-key>'` for each member that
                        // omitted its value. This matches the default identity
                        // behavior most string enums want; reviewers can still
                        // tweak any value before merging.
                        fix: fixer => missingInitializer.map(member => fixer.insertTextAfter(
                            member.id,
                            ` = '${ getMemberName(member).toLowerCase() }'`
                        ))
                    });
                }

                if (nonStringValue.length > 0) {
                    context.report({
                        node:      node.id,
                        messageId: 'enumMembersNotString',
                        data:      {
                            enumName,
                            memberList: nonStringValue.join(', ')
                        }
                    });
                }

                // Build the enum-reference set once if either the name or
                // any member is wrongly cased — both autofixes need it to
                // rewrite usages in the same file.
                const needsRefRewrites =
                    !isUpperSnake(enumName) || nonUppercaseMembers.length > 0;

                const enumVariable = needsRefRewrites
                    ? context.sourceCode.getDeclaredVariables(node)[0]
                    : undefined;

                const enumReferenceIdentifiers = new Set<TSESTree.Identifier>(
                    (enumVariable?.references ?? [])
                        .map(ref => ref.identifier as TSESTree.Identifier)
                );

                if (!isUpperSnake(enumName)) {
                    const suggestedName = toUpperSnake(enumName);

                    context.report({
                        node:      node.id,
                        messageId: 'enumNameNotUppercase',
                        data:      { enumName, suggestedName },

                        // Rename the declaration and every in-file reference.
                        // Cross-file references will trip TypeScript on the
                        // next compile — the user resolves those manually.
                        // `references` typically excludes the declaration, so
                        // rename it explicitly and dedupe on the off-chance.
                        fix: fixer => [
                            fixer.replaceText(node.id, suggestedName),
                            ...[ ...enumReferenceIdentifiers ]
                                .filter(ident => ident !== node.id)
                                .map(ident => fixer.replaceText(ident, suggestedName))
                        ]
                    });
                }

                if (nonUppercaseMembers.length > 0) {
                    const renamedMembers = new Map<string, string>(
                        nonUppercaseMembers
                            .map(m => [ getMemberName(m), toUpperSnake(getMemberName(m)) ])
                    );

                    // Find every `EnumName.member` access in the file whose
                    // object resolves to this enum and whose property name is
                    // being renamed. Pre-resolve the new name here so the fixer
                    // doesn't need a Map lookup that the type system can't prove
                    // succeeds.
                    const memberAccessUpdates = collectNodes(
                        context.sourceCode.ast,
                        (n) : n is TSESTree.MemberExpression =>
                            n.type === 'MemberExpression' &&
                            !n.computed &&
                            n.object.type === 'Identifier' &&
                            n.property.type === 'Identifier' &&
                            enumReferenceIdentifiers.has(n.object) &&
                            renamedMembers.has(n.property.name)
                    ).flatMap(access => {
                        const propertyName = (access.property as TSESTree.Identifier).name;
                        const newName = renamedMembers.get(propertyName);

                        // Filter above guarantees presence; satisfies the type system.
                        return newName === undefined
                            ? []
                            : [ { property: access.property, newName } ];
                    });

                    context.report({
                        node:      node.id,
                        messageId: 'enumMembersNotUppercase',
                        data:      {
                            enumName,
                            memberList: [ ...renamedMembers.keys() ].join(', ')
                        },

                        fix: fixer => [
                            // Rename declarations.
                            ...nonUppercaseMembers.map(m =>
                                fixer.replaceText(m.id, toUpperSnake(getMemberName(m)))),
                            // Rename in-file usages.
                            ...memberAccessUpdates.map(({ property, newName }) =>
                                fixer.replaceText(property, newName))
                        ]
                    });
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<keyof typeof messages>;
