import ts from 'typescript';

import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';

const messages = {
    missingDefault:
        `switch over an enum must end with \`default: throw assertUnreachable(x)\`.`,
    wrongDefaultBody:
        `default case in a switch over an enum must be exactly \`throw assertUnreachable(...)\`.`
} as const;

const hasFlag = (type : ts.Type, flag : number) : boolean => {
    // eslint-disable-next-line no-bitwise
    return (type.flags & flag) !== 0;
};

// Returns true when the given type is an enum or a union whose every
// constituent (after stripping null/undefined) is an enum literal.
const isEnumOrEnumUnion = (type : ts.Type) : boolean => {
    const types = type.isUnion()
        ? type.types
        : [ type ];

    let sawEnum = false;

    for (const t of types) {
        // Allow `undefined` / `null` constituents in unions like `MyEnum | undefined`.
        if (hasFlag(t, ts.TypeFlags.Undefined) || hasFlag(t, ts.TypeFlags.Null)) {
            continue;
        }

        if (!hasFlag(t, ts.TypeFlags.EnumLiteral)) {
            return false;
        }

        sawEnum = true;
    }

    return sawEnum;
};

const isAssertUnreachableThrow = (statement : TSESTree.Statement) : boolean => {
    if (statement.type !== 'ThrowStatement') {
        return false;
    }

    const argument = statement.argument;

    if (argument.type !== 'CallExpression') {
        return false;
    }

    const callee = argument.callee;

    return callee.type === 'Identifier' && callee.name === 'assertUnreachable';
};

// A default case can be either:
//   default: throw assertUnreachable(x);
//   default: { throw assertUnreachable(x); }
// Strip a single wrapping block and ignore empty statements when checking.
const getEffectiveStatements = (consequent : ReadonlyArray<TSESTree.Statement>) : ReadonlyArray<TSESTree.Statement> => {
    const statements = consequent.filter(s => s.type !== 'EmptyStatement');

    return statements.length === 1 && statements[0]?.type === `BlockStatement`
        ? statements[0].body.filter(s => s.type !== `EmptyStatement`)
        : statements;
};

export const requireAssertUnreachable = {
    meta: {
        type: 'problem',

        docs: {
            description:
                `Require switches over enums to end with \`default: throw assertUnreachable(x)\` so the compiler errors when a new enum variant is added.`
        },

        messages,

        schema: []
    },

    create: (context) => {
        const services = ESLintUtils.getParserServices(context);
        const checker = services.program.getTypeChecker();

        return {
            SwitchStatement: (node : TSESTree.SwitchStatement) => {
                const tsNode = services.esTreeNodeToTSNodeMap.get(node.discriminant);
                const type = checker.getTypeAtLocation(tsNode);

                if (!isEnumOrEnumUnion(type)) {
                    return;
                }

                const defaultCase = node.cases.find(c => c.test === null);

                if (!defaultCase) {
                    context.report({
                        node,
                        messageId: 'missingDefault'
                    });

                    return;
                }

                const statements = getEffectiveStatements(defaultCase.consequent);

                const onlyStatement = statements.length === 1
                    ? statements[0]
                    : undefined;

                if (!onlyStatement || !isAssertUnreachableThrow(onlyStatement)) {
                    context.report({
                        node:      defaultCase,
                        messageId: 'wrongDefaultBody'
                    });
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<keyof typeof messages>;
