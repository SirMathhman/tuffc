import { findBlockEnd, extractBlockContent } from "./extractors";
import { parseBlockStatements, getLastStatement } from "./metadata";

function wrapBlockExpressionInInit(source: string): string {
  if (source.indexOf("let ") === -1 || source.indexOf("=") === -1) {
    return source;
  }

  const eqIndex = source.indexOf("=");
  const beforeEq = source.substring(0, eqIndex).trim();
  const afterEq = source.substring(eqIndex + 1).trim();

  if (!afterEq.startsWith("{")) {
    return source;
  }

  const blockEnd = findBlockEnd(afterEq);
  if (blockEnd === -1) {
    return source;
  }

  const afterBlock = afterEq.substring(blockEnd + 1);
  const blockContent = extractBlockContent(afterEq, blockEnd);
  const stmts = parseBlockStatements(blockContent);

  if (stmts.length > 0) {
    const lastStmt = getLastStatement(stmts);
    if (!lastStmt.startsWith("let ")) {
      const beforeLastStmts = stmts.slice(0, -1).join("; ");
      let beforeLastPart = "";
      if (beforeLastStmts !== "") {
        beforeLastPart = beforeLastStmts + "; ";
      }
      const newBlock = `{ ${beforeLastPart} return ${lastStmt}; }`;
      return beforeEq + " = (function() " + newBlock + ")()" + afterBlock;
    }
  }

  return source;
}

export { wrapBlockExpressionInInit };
