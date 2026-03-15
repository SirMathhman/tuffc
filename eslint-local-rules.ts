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
  create(context: any) {
    const services = context.sourceCode.parserServices;
    if (
      !services ||
      !services.program ||
      !services.esTreeNodeToTSNodeMap
    ) {
      return {};
    }

    const checker = services.program.getTypeChecker();

    return {
      'CallExpression[callee.type="MemberExpression"][callee.property.name="push"]'(
        node: any,
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

const localPlugin = {
  rules: { "ban-array-push": banArrayPush },
};

export default localPlugin;
