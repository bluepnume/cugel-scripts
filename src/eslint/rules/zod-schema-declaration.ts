import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

const messages = {
    schemaNotModuleLevel:
        `Zod schema \`{{ schemaName }}\` must be declared at the module level. Schemas declared inside functions are recreated on every call — they're immutable, so reuse them across calls.`,
    schemaNameInvalid:
        `Zod schema variable name \`{{ schemaName }}\` must be camelCase ending in \`Schema\` (suggestion: \`{{ suggestedName }}\`).`
} as const;

type RuleContext = TSESLint.RuleContext<keyof typeof messages, ReadonlyArray<never>>;

// v4 zod aliases. v3 (`z3`) follows different conventions and isn't covered.
const ZOD_ROOT_NAMES = new Set([ 'z', 'z4' ]);

// Methods that consume a schema and return parsed VALUES rather than a new
// schema. Variables initialized via these aren't schemas — exclude them.
const PARSE_METHOD_NAMES = new Set([
    'parse', 'safeParse', 'parseAsync', 'safeParseAsync'
]);

// Walk down a CallExpression chain following `.callee.object` of MemberExpression
// callees. Returns the leftmost identifier name in the chain, or undefined if
// the chain doesn't bottom out at an Identifier.
//
//   `z.string().min(1).max(10)` → 'z'
//   `enumSchema(X).optional()`  → 'enumSchema'
//   `someVar.extend({})`        → 'someVar'
const getRootCalleeName = (
    node : TSESTree.Expression
) : string | undefined => {
    let current : TSESTree.Expression = node;

    while (current.type === 'CallExpression') {
        const callee = current.callee;

        if (callee.type === 'Identifier') {
            return callee.name;
        }

        if (callee.type === 'MemberExpression') {
            // Step into the object — the leftmost call in `a.b.c()` is `a.b`.
            if (
                callee.object.type === 'Identifier'
            ) {
                return callee.object.name;
            }

            current = callee.object;

            continue;
        }

        return undefined;
    }

    return undefined;
};

// Returns true when the outermost call ends in a parsing method like `.parse`,
// in which case the variable holds a parsed value, not a schema.
const isParseTerminal = (
    node : TSESTree.Expression
) : boolean => {
    if (node.type !== 'CallExpression') {
        return false;
    }

    const callee = node.callee;

    if (callee.type !== 'MemberExpression') {
        return false;
    }

    return callee.property.type === 'Identifier'
        ? PARSE_METHOD_NAMES.has(callee.property.name)
        : false;
};

const isZodSchemaInit = (
    init : TSESTree.Expression
) : boolean => {
    if (isParseTerminal(init)) {
        return false;
    }

    const root = getRootCalleeName(init);

    return root !== undefined && ZOD_ROOT_NAMES.has(root);
};

// A variable is module-level when its containing VariableDeclaration is a
// direct child of Program (optionally wrapped in `export`).
const isModuleLevelDeclarator = (
    declarator : TSESTree.VariableDeclarator
) : boolean => {
    let target : TSESTree.Node = declarator.parent;

    if (
        target.parent.type === 'ExportNamedDeclaration' ||
        target.parent.type === 'ExportDefaultDeclaration'
    ) {
        target = target.parent;
    }

    return target.parent.type === 'Program';
};

const SCHEMA_NAME_PATTERN = /^[a-z][\dA-Za-z]*Schema$/;

const isValidSchemaName = (name : string) : boolean =>
    SCHEMA_NAME_PATTERN.test(name);

// Split an identifier into word parts, handling snake_case, SCREAMING_SNAKE,
// camelCase, PascalCase, and consecutive-uppercase boundaries (XMLHttp →
// ['XML', 'Http']).
const splitWords = (name : string) : Array<string> =>
    name
        .split(/_+/)
        .flatMap(part =>
            part
                .replaceAll(/([\da-z])([A-Z])/g, '$1_$2')
                .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
                .split('_'))
        .filter(Boolean);

// True when the name already starts with a lowercase letter and contains
// only letters/digits (no underscores) — i.e. plausible camelCase. We don't
// rewrite these because doing so would clobber acronyms the author chose to
// preserve (e.g. `postMockWebhookSMSAPIQuery` → don't mangle `SMS`/`API`).
const looksCamelCase = (name : string) : boolean =>
    (/^[a-z][\dA-Za-z]*$/).test(name);

// Suggest a valid `<camelCase>Schema` name for any malformed input.
//   `FOO_BAR`                    → `fooBarSchema`     (snake_case path)
//   `MySchema`                   → `mySchema`         (PascalCase path)
//   `myschema`                   → `mySchema`         (camelCase path: fix lowercase suffix)
//   `httpResponse`               → `httpResponseSchema`        (camelCase path: append)
//   `postMockWebhookSMSAPIQuery` → `postMockWebhookSMSAPIQuerySchema` (acronyms preserved)
const suggestSchemaName = (name : string) : string => {
    if (looksCamelCase(name)) {
        // Already camelCase — only fix the suffix, leave acronyms intact.
        if (name.endsWith('Schema')) {
            return name;
        }

        return name.toLowerCase().endsWith('schema')
            ? `${ name.slice(0, -6) }Schema`
            : `${ name }Schema`;
    }

    const words = splitWords(name);

    if (words.length === 0) {
        return 'somethingSchema';
    }

    const camel = [
        words[0]?.toLowerCase() ?? '',
        ...words.slice(1).map(w =>
            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    ].join('');

    if (camel.endsWith('Schema')) {
        return camel;
    }

    return camel.toLowerCase().endsWith('schema')
        ? `${ camel.slice(0, -6) }Schema`
        : `${ camel }Schema`;
};

export const zodSchemaDeclaration = {
    meta: {
        type: 'problem',

        docs: {
            description:
                `Require zod schema variables to be declared at the module level and named \`<camelCase>Schema\`.`
        },

        fixable: 'code',

        messages,

        schema: []
    },

    create: (context : RuleContext) => {
        return {
            VariableDeclarator: (node : TSESTree.VariableDeclarator) => {
                if (node.id.type !== 'Identifier') {
                    return;
                }

                if (!node.init) {
                    return;
                }

                if (!isZodSchemaInit(node.init)) {
                    return;
                }

                const schemaName = node.id.name;

                if (!isModuleLevelDeclarator(node)) {
                    context.report({
                        node:      node.id,
                        messageId: 'schemaNotModuleLevel',
                        data:      { schemaName }
                    });
                }

                if (!isValidSchemaName(schemaName)) {
                    const suggestedName = suggestSchemaName(schemaName);

                    const variable = context.sourceCode
                        .getDeclaredVariables(node)
                        .find(v => v.name === schemaName);

                    context.report({
                        node:      node.id,
                        messageId: 'schemaNameInvalid',
                        data:      { schemaName, suggestedName },

                        // Rename the declaration plus every in-file reference
                        // via scope analysis. Cross-file references will surface
                        // as TypeScript errors on next compile.
                        fix: fixer => [
                            fixer.replaceText(node.id, suggestedName),
                            ...(variable?.references ?? [])
                                .map(ref => ref.identifier)
                                .filter(ident => ident !== node.id)
                                .map(ident => fixer.replaceText(ident, suggestedName))
                        ]
                    });
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<keyof typeof messages>;
