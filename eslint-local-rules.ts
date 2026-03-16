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
      'CallExpression[callee.type="MemberExpression"][callee.property.name="push"]'(node: {
        callee: {
          object: unknown;
        };
      }) {
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

interface FunctionLikeNode {
  type: string;
  parent?: FunctionLikeNode;
  body?: {
    type: string;
  };
}

function isFunctionLike(type: string): boolean {
  return (
    type === "FunctionDeclaration" ||
    type === "FunctionExpression" ||
    type === "ArrowFunctionExpression"
  );
}

function hasFunctionAncestor(node: FunctionLikeNode): boolean {
  let cursor = node.parent;
  while (cursor) {
    if (isFunctionLike(cursor.type)) {
      return true;
    }
    cursor = cursor.parent;
  }
  return false;
}

const banFunctionWithinFunction = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow nested function declarations/expressions and block-bodied arrows inside functions",
    },
    messages: {
      noNestedFunction:
        "Do not declare functions inside functions. Move it to module scope or use a concise one-line arrow function.",
      noBlockArrowInFunction:
        "Arrow functions inside functions must be one-line concise expressions (no {}).",
    },
    schema: [],
  },
  create(context: {
    report: (descriptor: { node: unknown; messageId: string }) => void;
  }) {
    return {
      FunctionDeclaration(node: FunctionLikeNode) {
        if (hasFunctionAncestor(node)) {
          context.report({ node, messageId: "noNestedFunction" });
        }
      },
      FunctionExpression(node: FunctionLikeNode) {
        if (hasFunctionAncestor(node)) {
          context.report({ node, messageId: "noNestedFunction" });
        }
      },
      ArrowFunctionExpression(node: FunctionLikeNode) {
        if (hasFunctionAncestor(node) && node.body?.type === "BlockStatement") {
          context.report({ node, messageId: "noBlockArrowInFunction" });
        }
      },
    };
  },
};

const localPlugin = {
  rules: {
    "ban-array-push": banArrayPush,
    "ban-function-within-function": banFunctionWithinFunction,
  },
};

export default localPlugin;
