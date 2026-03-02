import {
  VariableInfo,
  Result,
  CompileError,
  ok,
  err,
  createCompileError,
} from "./types";
import {
  extractIdentifier,
  extractReadType,
  extractAfterEq,
  isAlpha,
  findBlockEnd,
  advancePast,
  forEachAddressOf,
  extractBlockContent,
  isAssignmentOperator,
} from "./extractors";
import {
  splitStatementsKeepBlocks,
  findVariable,
  buildVariableMetadata,
  parseBlockStatements,
  getLastStatement,
} from "./metadata";

function validateTypeSuffix(
  suffix: string,
  value: number,
  code: string,
): Result<void, CompileError> {
  if (suffix === "U8") {
    if (value < 0 || value > 255) {
      return err(
        createCompileError(
          code,
          `U8 values must be in range 0-255, got: ${value}`,
          "U8 is an unsigned 8-bit integer with valid range 0-255",
          `Use a value between 0 and 255, or use a different type like I16 or I32 for larger values`,
        ),
      );
    }
  }
  return ok(void 0);
}

function validateReassignment(
  stmt: string,
  identifier: string,
  metaVar: VariableInfo,
): Result<void, CompileError> {
  if (!metaVar.isMutable) {
    return err(
      createCompileError(
        stmt,
        `Cannot reassign immutable variable: '${identifier}'`,
        "Only mutable variables declared with 'let mut' can be reassigned",
        `Change the declaration to 'let mut ${identifier} = ...' to allow reassignment`,
      ),
    );
  }
  const afterEq = extractAfterEq(stmt);
  const assignedType = extractReadType(afterEq);
  if (assignedType !== "") {
    const varType = metaVar.inferredType;
    if (!isUpconversionAllowed(assignedType, varType)) {
      return err(
        createCompileError(
          stmt,
          `Type mismatch in reassignment: cannot assign '${assignedType}' to variable '${identifier}' of type '${varType}'`,
          "Variable reassignments must match the declared type",
          `Change the assignment to use type '${varType}' or change the variable's type`,
        ),
      );
    }
  }
  return ok(void 0);
}
function checkVariableDuplicates(
  metadata: VariableInfo[],
): Result<void, CompileError> {
  let i = 0;
  while (i < metadata.length) {
    const varInfo = metadata[i];
    let j = i + 1;
    while (j < metadata.length) {
      if (metadata[j].name === varInfo.name) {
        return err(
          createCompileError(
            varInfo.stmt,
            `Duplicate variable declaration: '${varInfo.name}' is already declared`,
            "Variables can only be declared once in a scope",
            `Use a different variable name, or remove the duplicate declaration`,
          ),
        );
      }
      j++;
    }
    i++;
  }
  return ok(void 0);
}
function isUpconversionAllowed(fromType: string, toType: string): boolean {
  return (
    fromType === toType ||
    (fromType === "U8" &&
      ["U16", "U32", "U64", "I16", "I32", "I64"].indexOf(toType) !== -1) ||
    (fromType === "U16" &&
      ["U32", "U64", "I32", "I64"].indexOf(toType) !== -1) ||
    (fromType === "U32" && ["U64", "I64"].indexOf(toType) !== -1) ||
    (fromType === "I8" && ["I16", "I32", "I64"].indexOf(toType) !== -1) ||
    (fromType === "I16" && ["I32", "I64"].indexOf(toType) !== -1) ||
    (fromType === "I32" && toType === "I64")
  );
}

function checkAssignmentTypeMatch(
  metadata: VariableInfo[],
): Result<void, CompileError> {
  let i = 0;
  while (i < metadata.length) {
    const varInfo = metadata[i];
    if (varInfo.declaredType === "") {
      i++;
      continue;
    }
    const eqIndex = varInfo.stmt.indexOf("=");
    let assignedVar = "";
    if (eqIndex !== -1) {
      const afterEq = varInfo.stmt.substring(eqIndex + 1).trim();
      assignedVar = extractIdentifier(afterEq, 0);
    }
    if (assignedVar !== "") {
      let j = 0;
      while (j < metadata.length) {
        if (metadata[j].name === assignedVar) {
          const fromType = metadata[j].inferredType;
          const toType = varInfo.declaredType;
          if (!isUpconversionAllowed(fromType, toType)) {
            return err(
              createCompileError(
                varInfo.stmt,
                `Type mismatch: variable '${assignedVar}' has type '${fromType}' but '${toType}' was expected`,
                "Variable assignments must match the declared type",
                `Change the declared type to '${fromType}' or assign a different variable`,
              ),
            );
          }
          break;
        }
        j++;
      }
    }
    i++;
  }
  return ok(void 0);
}
function checkUndefinedVariables(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    return ok(void 0);
  }
  const firstChar = trimmed[0];
  if (!isAlpha(firstChar)) {
    return ok(void 0);
  }
  const identifier = extractIdentifier(trimmed, 0);
  if (identifier === trimmed) {
    const varInfo = findVariable(identifier, metadata);
    if (varInfo === undefined) {
      return err(
        createCompileError(
          source,
          `Undefined variable: '${identifier}' is referenced but never declared`,
          "All variables must be declared with 'let' before they can be used",
          `Declare '${identifier}' using 'let ${identifier} = <value>;' before using it`,
        ),
      );
    }
  }
  return ok(void 0);
}

function checkReassignments(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  const statements = splitStatementsKeepBlocks(source);
  let si = 0;
  while (si < statements.length) {
    const stmt = statements[si];
    if (stmt.substring(0, 4) === "let ") {
      si++;
      continue;
    }
    const eqIndex = stmt.indexOf("=");
    if (eqIndex === -1) {
      si++;
      continue;
    }
    const beforeEq = stmt.substring(0, eqIndex).trim();
    const identifier = extractIdentifier(beforeEq, 0);
    if (identifier !== beforeEq) {
      si++;
      continue;
    }
    let metaVar: VariableInfo | null = null;
    let mi = 0;
    while (mi < metadata.length) {
      if (metadata[mi].name === identifier) {
        metaVar = metadata[mi];
        break;
      }
      mi++;
    }
    if (metaVar === null) {
      return err(
        createCompileError(
          stmt,
          `Cannot reassign undefined variable: '${identifier}'`,
          "Variable must be declared before reassignment",
          `Add a declaration: 'let mut ${identifier} = ...'`,
        ),
      );
    }
    const validRes = validateReassignment(stmt, identifier, metaVar);
    if (validRes.type === "err") return validRes;
    si++;
  }
  return ok(void 0);
}
function undeclaredVariableError(
  source: string,
  varName: string,
  context: string,
  hint: string,
): Result<void, CompileError> {
  return err(
    createCompileError(
      source,
      `Undefined variable: '${varName}' ${context}`,
      "All variables must be declared with 'let' before they can be used",
      hint,
    ),
  );
}

function varNotDeclaredHint(varName: string, usage: string): string {
  return `Declare '${varName}' using 'let ${varName}${usage}' before using it`;
}
function checkBlockScopes(source: string): Result<string, CompileError> | null {
  const trimmed = source.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  const blockEnd = findBlockEnd(trimmed);
  if (blockEnd === -1 || blockEnd >= trimmed.length - 1) {
    return null;
  }
  const blockContent = trimmed.substring(1, blockEnd);
  const afterBlock = trimmed.substring(blockEnd + 1).trim();
  if (afterBlock === "") {
    return null;
  }
  const blockMetadata = buildVariableMetadata(blockContent);
  const blockVarNames = new Set<string>();
  let mi = 0;
  while (mi < blockMetadata.length) {
    blockVarNames.add(blockMetadata[mi].name);
    mi++;
  }
  const identifier = extractIdentifier(afterBlock, 0);
  if (identifier !== afterBlock || !blockVarNames.has(identifier)) {
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

function checkBlockExpressions(
  source: string,
): Result<string, CompileError> | null {
  const trimmed = source.trim();
  if (trimmed.indexOf("let ") === -1 || trimmed.indexOf("=") === -1) {
    return null;
  }
  const eqIndex = trimmed.indexOf("=");
  const afterEq = trimmed.substring(eqIndex + 1).trim();
  if (!afterEq.startsWith("{")) {
    return null;
  }
  const blockEnd = findBlockEnd(afterEq);
  if (blockEnd === -1) {
    return null;
  }
  const blockContent = extractBlockContent(afterEq, blockEnd);
  if (blockContent === "") {
    return null;
  }
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
function checkMixedPointerTypes(source: string): Result<void, CompileError> {
  const varMap = new Map<string, { hasImmut: boolean; hasMut: boolean }>();
  forEachAddressOf(source, (varName, isMut) => {
    if (!varMap.has(varName)) {
      varMap.set(varName, { hasImmut: false, hasMut: false });
    }
    const info = varMap.get(varName)!;
    if (isMut) {
      info.hasMut = true;
    } else {
      info.hasImmut = true;
    }
  });

  for (const [varName, { hasImmut, hasMut }] of varMap) {
    if (hasImmut && hasMut) {
      return err(
        createCompileError(
          source,
          `Cannot mix immutable and mutable pointers for the same variable: '${varName}' has both '&${varName}' and '&mut ${varName}'`,
          "A variable can either have immutable pointers or mutable pointers, but not both at the same time",
          `Use only '&${varName}' for immutable references or only '&mut ${varName}' for mutable references`,
        ),
      );
    }
  }
  return ok(void 0);
}

function checkOperatorOnVariables(
  source: string,
  metadata: VariableInfo[],
  operator: string,
  checker: (_varName: string) => Result<void, CompileError>,
  shouldSkipTypeAnnotation: boolean,
  prefixAfterOperator?: string,
): Result<void, CompileError> {
  const statements = splitStatementsKeepBlocks(source);
  let stmtIdx = 0;
  while (stmtIdx < statements.length) {
    const stmt = statements[stmtIdx];
    let startCheck = 0;
    if (shouldSkipTypeAnnotation && stmt.substring(0, 4) === "let ") {
      const eqIndex = stmt.indexOf("=");
      if (eqIndex !== -1) {
        startCheck = eqIndex + 1;
      }
    }
    let i = startCheck;
    while (i < stmt.length) {
      if (stmt[i] === operator) {
        let varStart = i + 1;
        if (
          prefixAfterOperator !== undefined &&
          stmt.substring(i + 1, i + 1 + prefixAfterOperator.length) ===
            prefixAfterOperator
        ) {
          varStart = i + 1 + prefixAfterOperator.length;
        }
        const varName = extractIdentifier(stmt, varStart);
        if (varName !== "") {
          const checkRes = checker(varName);
          if (checkRes.type === "err") return checkRes;
          i = advancePast(varStart, varName);
        } else {
          i++;
        }
      } else {
        i++;
      }
    }
    stmtIdx++;
  }
  return ok(void 0);
}

function checkAddressOfOperator(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  const mixedRes = checkMixedPointerTypes(source);
  if (mixedRes.type === "err") return mixedRes;
  const addressOfChecker = (varName: string): Result<void, CompileError> => {
    const varInfo = findVariable(varName, metadata);
    if (varInfo === undefined) {
      return undeclaredVariableError(
        source,
        varName,
        "is referenced with address-of operator but never declared",
        varNotDeclaredHint(varName, " = <value>;"),
      );
    }
    return ok(void 0);
  };
  return checkOperatorOnVariables(
    source,
    metadata,
    "&",
    addressOfChecker,
    false,
    "mut ",
  );
}

function checkPointerOperators(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  const addressOfRes = checkAddressOfOperator(source, metadata);
  if (addressOfRes.type === "err") return addressOfRes;
  const derefChecker = (varName: string): Result<void, CompileError> => {
    const varInfo = findVariable(varName, metadata);
    if (varInfo === undefined) {
      return undeclaredVariableError(
        source,
        varName,
        "is dereferenced but never declared",
        varNotDeclaredHint(varName, " : *<type> = <value>;"),
      );
    }
    if (!varInfo.declaredType.includes("*")) {
      const t = varInfo.declaredType;
      return err(
        createCompileError(
          source,
          `Cannot dereference non-pointer variable: '${varName}' has type '${t}' but attempted dereference requires pointer type`,
          "Dereference operator (*) can only be applied to pointer types",
          `Change '${varName}' to a pointer type (e.g., : *${t}) or use variable directly`,
        ),
      );
    }
    return ok(void 0);
  };
  const derefRes = checkOperatorOnVariables(
    source,
    metadata,
    "*",
    derefChecker,
    true,
  );
  if (derefRes.type === "err") return derefRes;
  return checkImmutablePointerAssignments(source, metadata);
}

function checkImmutablePointerAssignments(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  let ai = 0;
  while (ai < source.length) {
    if (source[ai] === "*") {
      const varName = extractIdentifier(source, ai + 1);
      if (varName !== "") {
        const afterVar = ai + 1 + varName.length;
        if (isAssignmentOperator(source, afterVar)) {
          let mi = 0;
          while (mi < metadata.length) {
            if (metadata[mi].name === varName) {
              const varInfo = metadata[mi];
              if (!varInfo.declaredType.includes("mut")) {
                return err(
                  createCompileError(
                    source,
                    `Cannot assign through immutable pointer: '${varName}' has type '${varInfo.declaredType}' but assignment through pointer requires mutable pointer type (*mut)`,
                    "Assignment through dereference (*ptr = value) requires a mutable pointer",
                    `Change '${varName}' to a mutable pointer type (: *mut <type>) or use direct assignment`,
                  ),
                );
              }
              break;
            }
            mi++;
          }
        }
      }
    }
    ai++;
  }
  return ok(void 0);
}

export {
  validateTypeSuffix,
  validateReassignment,
  checkVariableDuplicates,
  checkAssignmentTypeMatch,
  checkUndefinedVariables,
  checkReassignments,
  checkBlockScopes,
  checkBlockExpressions,
  checkPointerOperators,
};
