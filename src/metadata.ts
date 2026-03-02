/* eslint-disable max-lines */
import { VariableInfo } from "./types";
import {
  extractIdentifier,
  extractDeclaredType,
  extractReadType,
  extractAfterEq,
  findBlockEnd,
  isDigit,
} from "./extractors";
import {
  splitStatementsKeepBlocks,
  findVariable,
  parseBlockStatements,
  getLastStatement,
} from "./metadata-helpers";

function extractBlockExpressionType(blockStr: string): string {
  if (!blockStr.startsWith("{")) {
    return "";
  }
  const blockEnd = findBlockEnd(blockStr);
  if (blockEnd === -1) {
    return "";
  }
  const blockContent = blockStr.substring(1, blockEnd);
  const blockStmts = splitStatementsKeepBlocks(blockContent);
  if (blockStmts.length === 0) {
    return "I32";
  }
  const lastStmt = blockStmts[blockStmts.length - 1].trim();
  if (lastStmt === "" || lastStmt === "{}") {
    return "I32";
  }
  if (lastStmt.substring(0, 4) === "let ") {
    const stmtMetadata = buildVariableMetadata(lastStmt);
    if (stmtMetadata.length > 0) {
      return stmtMetadata[0].inferredType;
    }
    return "";
  }
  const varName = extractIdentifier(lastStmt, 0);
  if (varName !== "") {
    const blockMetadata = buildVariableMetadata(blockContent);
    let mi = 0;
    while (mi < blockMetadata.length) {
      if (blockMetadata[mi].name === varName) {
        return blockMetadata[mi].inferredType;
      }
      mi++;
    }
  }
  return "";
}

function extractLiteralType(stmt: string): string {
  const eqIndex = stmt.indexOf("=");
  if (eqIndex === -1) {
    return "";
  }
  const afterEq = extractAfterEq(stmt);
  const blockType = extractBlockExpressionType(afterEq.trim());
  if (blockType !== "") {
    return blockType;
  }
  if (afterEq.trim() === "false" || afterEq.trim() === "true") {
    return "Bool";
  }
  let digitEnd = 0;
  while (digitEnd < afterEq.length) {
    const c = afterEq[digitEnd];
    if (isDigit(c) || c === ".") {
      digitEnd++;
    } else {
      break;
    }
  }
  if (digitEnd === 0) {
    return "";
  }
  const suffix = afterEq.substring(digitEnd).trim();
  if (suffix === "") {
    return "I32";
  }
  return suffix;
}

function buildVariableMetadata(source: string): VariableInfo[] {
  const statements = splitStatementsKeepBlocks(source);
  const metadata: VariableInfo[] = [];
  let j = 0;
  while (j < statements.length) {
    const stmt = statements[j];
    if (stmt.substring(0, 4) === "let ") {
      let isMutable = false;
      let skipOffset = 4;
      if (stmt.substring(4, 8) === "mut ") {
        isMutable = true;
        skipOffset = 8;
      }
      const name = extractIdentifier(stmt, skipOffset);
      const declaredType = extractDeclaredType(stmt);
      const readType = extractReadType(stmt);
      const literalType = extractLiteralType(stmt);
      let inferredType: string;
      if (declaredType !== "") {
        inferredType = declaredType;
      } else if (readType !== "") {
        inferredType = readType;
      } else {
        inferredType = literalType;
      }
      metadata.push({ name, declaredType, inferredType, isMutable, stmt });
    }
    j++;
  }
  return metadata;
}

export {
  splitStatementsKeepBlocks,
  extractBlockExpressionType,
  extractLiteralType,
  buildVariableMetadata,
  findVariable,
  parseBlockStatements,
  getLastStatement,
};
