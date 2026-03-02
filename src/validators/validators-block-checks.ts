/* eslint-disable max-lines */
import { Result, CompileError, err, createCompileError } from "../types";
import {
  extractIdentifier,
  extractDeclaredType,
  findBlockEnd,
  extractBlockContent,
} from "../extractors/extractors";
import {
  buildVariableMetadata,
  parseBlockStatements,
  getLastStatement,
  extractBlockExpressionType,
} from "../metadata/metadata";
import { isUpconversionAllowed } from "./validators-type-checks";

interface BlockAssignment {
  beforeEq: string;
  afterEq: string;
}

interface ProcessedBlock {
  blockInfo: BlockAssignment;
  blockContent: string;
  blockEnd: number;
  afterEq: string;
}

function processBlockAssignment(source: string): ProcessedBlock | null {
  const trimmed = source.trim();
  if (trimmed.indexOf("let ") === -1 || trimmed.indexOf("=") === -1) {
    return null;
  }
  const eqIndex = trimmed.indexOf("=");
  const beforeEq = trimmed.substring(0, eqIndex).trim();
  const afterEq = trimmed.substring(eqIndex + 1).trim();
  if (!afterEq.startsWith("{")) {
    return null;
  }
  const blockEnd = findBlockEnd(afterEq);
  if (blockEnd === -1 || blockEnd >= afterEq.length - 1) {
    return null;
  }
  const blockContent = extractBlockContent(afterEq, blockEnd);
  if (blockContent === "") {
    return null;
  }
  const blockInfo = { beforeEq, afterEq };
  return { blockInfo, blockContent, blockEnd, afterEq };
}

function checkBlockScopeViolation(
  blockContent: string,
  afterBlockText: string,
  source: string,
): Result<string, CompileError> | null {
  if (afterBlockText === "") {
    return null;
  }
  const blockMetadata = buildVariableMetadata(blockContent);
  const blockVarNames = new Set<string>();
  let mi = 0;
  while (mi < blockMetadata.length) {
    blockVarNames.add(blockMetadata[mi].name);
    mi++;
  }
  const identifier = extractIdentifier(afterBlockText, 0);
  if (identifier !== afterBlockText || !blockVarNames.has(identifier)) {
    return null;
  }
  return err(
    createCompileError(
      source,
      `Variable '${identifier}' is not in scope: it was declared inside a block and is being accessed outside`,
      "Variables declared in a block are only accessible within that block",
      `Declare the variable outside the block or use it only within the block`,
    ),
  );
}

function checkBlockScopes(source: string): Result<string, CompileError> | null {
  const trimmed = source.trim();
  if (trimmed.startsWith("{")) {
    const blockEnd = findBlockEnd(trimmed);
    if (blockEnd === -1 || blockEnd >= trimmed.length - 1) {
      return null;
    }
    const blockContent = trimmed.substring(1, blockEnd);
    const afterBlock = trimmed.substring(blockEnd + 1).trim();
    return checkBlockScopeViolation(blockContent, afterBlock, source);
  }
  const processed = processBlockAssignment(source);
  if (processed === null) {
    return null;
  }
  const { blockContent, blockEnd, afterEq } = processed;
  let afterBlockWithoutBrace = afterEq.substring(blockEnd + 1).trim();
  if (afterBlockWithoutBrace.startsWith(";")) {
    afterBlockWithoutBrace = afterBlockWithoutBrace.substring(1).trim();
  }
  return checkBlockScopeViolation(blockContent, afterBlockWithoutBrace, source);
}

function checkBlockExpressions(
  source: string,
): Result<string, CompileError> | null {
  const processed = processBlockAssignment(source);
  if (processed === null) {
    return null;
  }
  const { blockContent } = processed;
  const stmts = parseBlockStatements(blockContent);
  if (stmts.length === 0) {
    return null;
  }
  const lastStmt = getLastStatement(stmts);
  if (lastStmt.startsWith("let ")) {
    return err(
      createCompileError(
        source,
        `Block expression must have a final value, but ends with a statement`,
        "Blocks used in assignments must evaluate to a value",
        `Add a final expression after the last statement, e.g., '{ let y = 100; y }'`,
      ),
    );
  }
  return null;
}

function checkBlockExpressionType(
  source: string,
): Result<string, CompileError> | null {
  const processed = processBlockAssignment(source);
  if (processed === null) {
    return null;
  }
  const { blockInfo, afterEq } = processed;
  const { beforeEq } = blockInfo;
  const declaredType = extractDeclaredType(beforeEq);
  if (declaredType === "") {
    return null;
  }
  const blockExprType = extractBlockExpressionType(afterEq);
  if (blockExprType === "") {
    return null;
  }
  if (!isUpconversionAllowed(blockExprType, declaredType)) {
    return err(
      createCompileError(
        source,
        `Type mismatch: block expression evaluates to type '${blockExprType}' but variable is declared as type '${declaredType}'`,
        "Block expression type must match or be upconvertible to the variable's declared type",
        `Change the block expression to evaluate to '${declaredType}' or change the variable's declared type to '${blockExprType}'`,
      ),
    );
  }
  return null;
}

export {
  checkBlockScopes,
  checkBlockExpressions,
  checkBlockExpressionType,
  processBlockAssignment,
};
