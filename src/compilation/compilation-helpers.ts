import { extractBlockAndAfter } from "../extractors/extractors";
import { extractIfElseAndAfter } from "./compilation-if-else";
import { parseNumberLiteral } from "./compilation-number";

function generateFunctionFromLastStatement(
  beforeLastStatement: string,
  lastStatement: string,
): string {
  // Check if the last statement starts with an if statement
  const ifElseResult = extractIfElseAndAfter(lastStatement);
  if (ifElseResult !== null) {
    const { ifElse, after } = ifElseResult;
    if (after === "") {
      // No expression after the if-else, return 0
      return `(function() { ${beforeLastStatement} ${ifElse}; return 0; })()`;
    } else {
      // Execute if-else then return the expression after it
      return `(function() { ${beforeLastStatement} ${ifElse}; return ${after}; })()`;
    }
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
