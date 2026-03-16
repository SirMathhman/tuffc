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
  create(context: {
    sourceCode: {
      parserServices?: {
        program?: {
          getTypeChecker: () => {
            getTypeAtLocation: (node: unknown) => unknown;
            isArrayType: (type: unknown) => boolean;
            isTupleType: (type: unknown) => boolean;
          };
        };
        esTreeNodeToTSNodeMap?: {
          get: (node: unknown) => unknown;
        };
      };
    };
    report: (descriptor: { node: unknown; messageId: string }) => void;
  }) {
    const services = context.sourceCode.parserServices;
    if (!services || !services.program || !services.esTreeNodeToTSNodeMap) {
      return {};
    }

    const checker = services.program.getTypeChecker();

    return {
      'CallExpression[callee.type="MemberExpression"][callee.property.name="push"]'(
        node: {
          callee: {
            object: unknown;
          };
        },
      ) {
        const tsNodeMap = services.esTreeNodeToTSNodeMap;
        if (!tsNodeMap) {
          return;
        }
        const tsNode = tsNodeMap.get(node.callee.object);
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
