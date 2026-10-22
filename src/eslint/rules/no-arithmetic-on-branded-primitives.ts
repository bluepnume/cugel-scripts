import ts from 'typescript';

import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';

const messages = {
    arithmeticOnBranded:
        `Avoid \`{{ operator }}\` between two branded primitives (\`{{ leftBrand }}\`, \`{{ rightBrand }}\`). The result loses the brand because TypeScript widens arithmetic to plain \`number\` / \`bigint\`. Use \`{{ helper }}(...)\` from \`src/lib/math.ts\` to preserve the brand.`,
    compoundAssignmentOnBranded:
        `Avoid \`{{ operator }}\` between two branded primitives (\`{{ leftBrand }}\`, \`{{ rightBrand }}\`). The result loses the brand because TypeScript widens arithmetic to plain \`number\` / \`bigint\`. Rewrite as \`<lhs> = {{ helper }}(<lhs>, <rhs>)\` so the brand is preserved.`
} as const;

type RuleContext = TSESLint.RuleContext<keyof typeof messages, ReadonlyArray<never>>;

// eslint-disable-next-line no-bitwise
const PRIMITIVE_FLAGS = ts.TypeFlags.String | ts.TypeFlags.Number | ts.TypeFlags.BigInt
    | ts.TypeFlags.Boolean | ts.TypeFlags.TemplateLiteral | ts.TypeFlags.StringMapping;

const hasFlag = (type : ts.Type, flag : number) : boolean => {
    // eslint-disable-next-line no-bitwise
    return (type.flags & flag) !== 0;
};

// Same definition as in no-branded-primitive-cast: an intersection of a
// primitive (or template-literal narrowing of one) with an object brand.
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

const BINARY_OP_TO_HELPER : Record<string, string> = {
    '+': 'add',
    '-': 'subtract',
    '*': 'multiply',
    '/': 'divide',
    '%': 'modulo'
};

const ASSIGN_OP_TO_HELPER : Record<string, string> = {
    '+=': 'add',
    '-=': 'subtract',
    '*=': 'multiply',
    '/=': 'divide',
    '%=': 'modulo'
};

// Side-effecting LHS would be evaluated twice by the `lhs = helper(lhs, rhs)`
// rewrite (once for assignment target, once as first arg). Refuse to autofix
// in that case. We use a textual probe rather than walking the AST because
// the dangerous cases are easy to spot in source form: function calls,
// increment/decrement operators, computed property accesses with calls.
const HAS_SIDE_EFFECT_LHS = /[([]|\+\+|--/;

export const noArithmeticOnBrandedPrimitives = {
    meta: {
        type:    'problem',
        fixable: 'code',

        docs: {
            description:
                `Disallow raw arithmetic operators between two branded primitive types — the result silently loses the brand. Use the helpers in src/lib/math.ts (add, subtract, multiply, divide, modulo) instead.`
        },

        messages,

        schema: []
    },

    create: (context : RuleContext) => {
        const services = ESLintUtils.getParserServices(context);
        const checker = services.program.getTypeChecker();

        const getBrandName = (type : ts.Type) : string => {
            return checker.typeToString(type);
        };

        const check = (
            node : TSESTree.BinaryExpression | TSESTree.AssignmentExpression,
            helper : string,
            messageId : keyof typeof messages
        ) : void => {
            // AssignmentExpression's `left` can be a non-expression target
            // (e.g. ArrayPattern in destructuring), but with arithmetic
            // compound assignment ops it's always an expression in practice.
            const leftType = checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(node.left));
            const rightType = checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(node.right));

            if (!isBrandedPrimitiveType(leftType) && !isBrandedPrimitiveType(rightType)) {
                return;
            }

            const leftText = context.sourceCode.getText(node.left);
            const rightText = context.sourceCode.getText(node.right);

            const fix = messageId === 'compoundAssignmentOnBranded'
                ? (HAS_SIDE_EFFECT_LHS.test(leftText)
                    ? undefined
                    : (fixer : TSESLint.RuleFixer) =>
                        fixer.replaceText(node, `${ leftText } = ${ helper }(${ leftText }, ${ rightText })`))
                : (fixer : TSESLint.RuleFixer) =>
                    fixer.replaceText(node, `${ helper }(${ leftText }, ${ rightText })`);

            context.report({
                node,
                messageId,
                data: {
                    operator:   node.operator,
                    helper,
                    leftBrand:  getBrandName(leftType),
                    rightBrand: getBrandName(rightType)
                },
                fix
            });
        };

        return {
            BinaryExpression: (node : TSESTree.BinaryExpression) => {
                const helper = BINARY_OP_TO_HELPER[node.operator];

                if (helper === undefined) {
                    return;
                }

                check(node, helper, 'arithmeticOnBranded');
            },

            AssignmentExpression: (node : TSESTree.AssignmentExpression) => {
                const helper = ASSIGN_OP_TO_HELPER[node.operator];

                if (helper === undefined) {
                    return;
                }

                check(node, helper, 'compoundAssignmentOnBranded');
            }
        };
    }
} satisfies TSESLint.RuleModule<keyof typeof messages>;
