import ts from 'typescript';

import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';

const messages = {
    removesNullish:
        `Avoid \`as\` casts that remove \`{{ removed }}\` from the value's type. Tighten the source type so it doesn't include \`{{ removed }}\` in the first place, or use \`assertExists(x)\` at the call site to check at runtime.`
} as const;

type RuleContext = TSESLint.RuleContext<keyof typeof messages, ReadonlyArray<never>>;

const hasFlag = (type : ts.Type, flag : number) : boolean => {
    // eslint-disable-next-line no-bitwise
    return (type.flags & flag) !== 0;
};

const containsFlag = (type : ts.Type, flag : number) : boolean => {
    if (hasFlag(type, flag)) {
        return true;
    }

    if (hasFlag(type, ts.TypeFlags.Union)) {
        for (const constituent of (type as ts.UnionType).types) {
            if (containsFlag(constituent, flag)) {
                return true;
            }
        }
    }

    return false;
};

// `any` and `unknown` subsume null/undefined, so casting nullish-into them
// isn't a narrowing operation we want to flag.
const subsumesNullish = (type : ts.Type) : boolean => {
    // eslint-disable-next-line no-bitwise
    return hasFlag(type, ts.TypeFlags.Any | ts.TypeFlags.Unknown);
};

export const noNullishNarrowingCast = {
    meta: {
        type: 'problem',

        docs: {
            description:
                `Disallow \`as\` casts that remove \`null\` or \`undefined\` from the value's type without a runtime check.`
        },

        messages,

        schema: []
    },

    create: (context : RuleContext) => {
        const services = ESLintUtils.getParserServices(context);
        const checker = services.program.getTypeChecker();

        const check = (node : TSESTree.TSAsExpression | TSESTree.TSTypeAssertion) : void => {
            const sourceTSNode = services.esTreeNodeToTSNodeMap.get(node.expression);
            const sourceType = checker.getTypeAtLocation(sourceTSNode);

            // `any` / `unknown` source isn't a clearly-typed nullish narrowing —
            // other rules (e.g. no-unsafe-type-assertion) cover those.
            if (subsumesNullish(sourceType)) {
                return;
            }

            const targetTSNode = services.esTreeNodeToTSNodeMap.get(node);
            const targetType = checker.getTypeAtLocation(targetTSNode);

            if (subsumesNullish(targetType)) {
                return;
            }

            const removesNull = containsFlag(sourceType, ts.TypeFlags.Null) &&
                !containsFlag(targetType, ts.TypeFlags.Null);

            const removesUndefined = containsFlag(sourceType, ts.TypeFlags.Undefined) &&
                !containsFlag(targetType, ts.TypeFlags.Undefined);

            if (!removesNull && !removesUndefined) {
                return;
            }

            const removed = removesNull && removesUndefined
                ? 'null | undefined'
                : removesNull
                    ? 'null'
                    : 'undefined';

            context.report({
                node,
                messageId: 'removesNullish',
                data:      { removed }
            });
        };

        return {
            TSAsExpression:  check,
            TSTypeAssertion: check
        };
    }
} satisfies TSESLint.RuleModule<keyof typeof messages>;
