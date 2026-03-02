import { findBlockEnd, extractBlockContent } from "../extractors/extractors";
import { parseBlockStatements, getLastStatement } from "../metadata/metadata";

function looksLikeObjectLiteralBlock(blockContent: string): boolean {
  let i = 0;
  while (i < blockContent.length) {
    const c = blockContent[i];
    if (c !== " " && c !== "\t" && c !== "\n") {
      break;
    }
    i++;
  }
  let j = i;
  while (
    j < blockContent.length &&
    ((blockContent[j] >= "a" && blockContent[j] <= "z") ||
      (blockContent[j] >= "A" && blockContent[j] <= "Z") ||
      (blockContent[j] >= "0" && blockContent[j] <= "9") ||
      blockContent[j] === "_")
  ) {
    j++;
  }
  if (j === i) return false;
  while (
    j < blockContent.length &&
    (blockContent[j] === " " || blockContent[j] === "\t")
  ) {
    j++;
  }
  return blockContent[j] === ":";
}

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
  if (looksLikeObjectLiteralBlock(blockContent)) {
    return source;
  }
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
