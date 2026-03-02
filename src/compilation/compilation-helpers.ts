import { extractBlockAndAfter } from "../extractors/extractors";
import { extractIfElseAndAfter } from "./compilation-if-else";
import { extractWhileAndAfter } from "./compilation-while-extraction";
import { parseNumberLiteral } from "./compilation-number";

function generateFunctionFromLastStatement(
  beforeLastStatement: string,
  lastStatement: string,
): string {
  const whileResult = extractWhileAndAfter(lastStatement);
  if (whileResult !== null) {
    const { whileStmt, after } = whileResult;
    if (after === "") {
      return `(function() { ${beforeLastStatement} ${whileStmt} return 0; })()`;
    }
    return `(function() { ${beforeLastStatement} ${whileStmt} return ${after}; })()`;
  }

  const ifElseResult = extractIfElseAndAfter(lastStatement);
  if (ifElseResult !== null) {
    const { ifElse, after } = ifElseResult;
    if (after === "") {
      return `(function() { ${beforeLastStatement} ${ifElse}; return 0; })()`;
    }
    return `(function() { ${beforeLastStatement} ${ifElse}; return ${after}; })()`;
  }

  const { block, after } = extractBlockAndAfter(lastStatement);
  if (block !== null) {
    let returnVal: string;
    if (after === "") {
      returnVal = "0";
    } else {
      returnVal = after;
    }
    return `(function() { ${beforeLastStatement} ${block} return ${returnVal}; })()`;
  }

  if (lastStatement.startsWith("{}")) {
    const afterBlock = lastStatement.substring(2).trim();
    let returnVal: string;
    if (afterBlock === "") {
      returnVal = "0";
    } else {
      returnVal = afterBlock;
    }
    return `(function() { ${beforeLastStatement} return ${returnVal}; })()`;
  }

  return `(function() { ${beforeLastStatement} return ${lastStatement}; })()`;
}

export { parseNumberLiteral, generateFunctionFromLastStatement };
