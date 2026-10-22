import ts from 'typescript';

import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';

const messages = {
    nonLiteralBrandedCast:
        `Avoid \`as\` casts to branded primitive type \`{{ typeName }}\` from non-literal values. The cast bypasses validation; use a constructor, parser, or validator that actually checks the value.`
} as const;

type RuleContext = TSESLint.RuleContext<keyof typeof messages, ReadonlyArray<never>>;

// eslint-disable-next-line no-bitwise
const PRIMITIVE_FLAGS = ts.TypeFlags.String | ts.TypeFlags.Number | ts.TypeFlags.BigInt
    | ts.TypeFlags.Boolean | ts.TypeFlags.TemplateLiteral | ts.TypeFlags.StringMapping;

const hasFlag = (type : ts.Type, flag : number) : boolean => {
    // eslint-disable-next-line no-bitwise
    return (type.flags & flag) !== 0;
};

// A branded primitive is a primitive (string / number / bigint / boolean, or a
// template-literal narrowing of string) intersected with an object "brand" — the
// shape produced by `Tagged<T, ...>` from type-fest and the local `Opaque<N, T>`
// helper. For unions, treat as branded if any constituent is.
const isBrandedPrimitiveType = (type : ts.Type) : boolean => {
    if (hasFlag(type, ts.TypeFlags.Union)) {
        for (const t of (type as ts.UnionType).types) {
            if (isBrandedPrimitiveType(t)) {
                return true;
            }
        }

        return false;
    }

    if (!hasFlag(type, ts.TypeFlags.Intersection)) {
        return false;
    }

    let hasPrimitive = false;
    let hasBrand = false;

    for (const t of (type as ts.IntersectionType).types) {
        if (hasFlag(t, PRIMITIVE_FLAGS)) {
            hasPrimitive = true;
        } else if (hasFlag(t, ts.TypeFlags.Object)) {
            hasBrand = true;
        }
    }

    return hasPrimitive && hasBrand;
};

const isLiteralExpression = (node : TSESTree.Expression) : boolean => {
    if (node.type === 'Literal') {
        return true;
    }

    if (node.type === 'TemplateLiteral') {
        return node.expressions.length === 0;
    }

    // Allow `-1 as Cents` / `+1 as Cents` — still effectively literal values.
    if (node.type === 'UnaryExpression' && (node.operator === '-' || node.operator === '+')) {
        return isLiteralExpression(node.argument);
    }

    // Unwrap chained casts like `0 as const as Cents`.
    return node.type === `TSAsExpression` || node.type === `TSTypeAssertion`
        ? isLiteralExpression(node.expression)
        : false;
};

export const noBrandedPrimitiveCast = {
    meta: {
        type: 'problem',

        docs: {
            description:
                `Disallow \`as\` casts to branded primitive types (Tagged / Opaque) from non-literal values.`
        },

        messages,

        schema: []
    },

    create: (context : RuleContext) => {
        const services = ESLintUtils.getParserServices(context);
        const checker = services.program.getTypeChecker();

        return {
            TSAsExpression: (node : TSESTree.TSAsExpression) => {
                if (isLiteralExpression(node.expression)) {
                    return;
                }

                const typeNode = services.esTreeNodeToTSNodeMap.get(node.typeAnnotation);
                const type = checker.getTypeAtLocation(typeNode);

                if (!isBrandedPrimitiveType(type)) {
                    return;
                }

                const typeName = context.sourceCode.getText(node.typeAnnotation);

                context.report({
                    node,
                    messageId: 'nonLiteralBrandedCast',
                    data:      { typeName }
                });
            }
        };
    }
} satisfies TSESLint.RuleModule<keyof typeof messages>;
