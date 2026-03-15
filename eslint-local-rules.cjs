"use strict";

/** @type {import('@typescript-eslint/utils').TSESLint.RuleModule<'noPush', []>} */
const banArrayPush = {
  meta: {
    type: "suggestion",
    docs: { description: "Ban Array.push; use spread/concat instead" },
    messages: {
      noPush:
        "Array.push is not allowed; use spread/concat for immutable array updates",
    },
    schema: [],
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    const checker = services.program.getTypeChecker();

    return {
      'CallExpression[callee.type="MemberExpression"][callee.property.name="push"]'(
        node,
      ) {
        const tsNode = services.esTreeNodeToTSNodeMap.get(node.callee.object);
        const type = checker.getTypeAtLocation(tsNode);
        if (checker.isArrayType(type) || checker.isTupleType(type)) {
          context.report({ node, messageId: "noPush" });
        }
      },
    };
  },
};

module.exports = {
  rules: { "ban-array-push": banArrayPush },
};
