interface Ok<T> {
  type: "ok";
  value: T;
}

interface Err<E> {
  type: "err";
  error: E;
}

interface CompileError {
  code: string;
  message: string;
  reason: string;
  fix: string;
}

type Result<T, E> = Ok<T> | Err<E>;

function ok<T, E>(value: T): Result<T, E> {
  return { type: "ok", value };
}

function err<T, E>(error: E): Result<T, E> {
  return { type: "err", error };
}

function createCompileError(
  code: string,
  message: string,
  reason: string,
  fix: string,
): CompileError {
  return { code, message, reason, fix };
}

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

function identifierAfterDeref(source: string, pos: number): string {
  return extractIdentifier(source, pos + 1);
}

function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}

function isAlpha(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
}

function pushIfNonEmpty(statements: string[], current: string): void {
  if (current.trim() !== "") {
    statements.push(current.trim());
  }
}

function extractAfterEq(stmt: string): string {
  const eqIndex = stmt.indexOf("=");
  return stmt.substring(eqIndex + 1).trim();
}

function extractNumericPart(
  source: string,
  startIndex: number,
): { numericPart: string; endIndex: number } {
  let numericPart = "";
  let endIndex = startIndex;
  let i = startIndex;
  while (i < source.length) {
    const char = source[i];
    if (isDigit(char) || char === ".") {
      numericPart += char;
      endIndex = i + 1;
      i++;
    } else {
      break;
    }
  }
  return { numericPart, endIndex };
}

function skipTypeAnnotation(source: string, i: number): number {
  if (i < source.length - 1 && source[i] === ":" && source[i + 1] === " ") {
    let j = i + 2;
    while (j < source.length) {
      const char = source[j];
      const isTypePart =
        isAlpha(char) ||
        isDigit(char) ||
        char === "<" ||
        char === ">" ||
        char === "," ||
        char === "*";
      const isSpace =
        char === " " && j + 1 < source.length && isAlpha(source[j + 1]);
      if (isTypePart || isSpace) {
        j++;
      } else {
        break;
      }
    }
    while (j < source.length && source[j] === " ") {
      j++;
    }
    return j;
  }
  return i;
}

function stripTypeAnnotations(source: string): string {
  let result = "";
  let i = 0;
  while (i < source.length) {
    if (i < source.length - 5 && source.substring(i, i + 8) === "let mut ") {
      result += "let ";
      i += 8;
    } else {
      const newI = skipTypeAnnotation(source, i);
      if (newI > i) {
        i = newI;
      } else {
        const suffix = (() => {
          const isNumber =
            isDigit(source[i]) ||
            (source[i] === "-" &&
              i + 1 < source.length &&
              isDigit(source[i + 1]));
          if (!isNumber) {
            return { newIndex: i, result: "" };
          }
          let j = i;
          if (source[j] === "-") j++;
          while (j < source.length && isDigit(source[j])) {
            j++;
          }
          const numericPart = source.substring(i, j);
          let suffixEnd = j;
          while (suffixEnd < source.length && isAlpha(source[suffixEnd])) {
            suffixEnd++;
          }
          return { newIndex: suffixEnd, result: numericPart };
        })();
        if (suffix.newIndex > i) {
          result += suffix.result;
          i = suffix.newIndex;
        } else {
          result += source[i];
          i++;
        }
      }
    }
  }
  return result;
}

function splitStatementsKeepBlocks(source: string): string[] {
  const statements: string[] = [];
  let current = "";
  let braceDepth = 0;
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === "{") {
      braceDepth++;
      current += char;
    } else if (char === "}") {
      braceDepth--;
      current += char;
    } else if (char === ";" && braceDepth === 0) {
      pushIfNonEmpty(statements, current);
      current = "";
    } else {
      current += char;
    }
    i++;
  }
  pushIfNonEmpty(statements, current);
  return statements;
}

function extractIdentifier(str: string, startIndex: number): string {
  let identifier = "";
  let i = startIndex;
  while (
    i < str.length &&
    ((str[i] >= "a" && str[i] <= "z") ||
      (str[i] >= "A" && str[i] <= "Z") ||
      (str[i] >= "0" && str[i] <= "9") ||
      str[i] === "_")
  ) {
    identifier += str[i];
    i++;
  }
  return identifier;
}

function extractDeclaredType(stmt: string): string {
  if (stmt.substring(0, 4) !== "let ") {
    return "";
  }
  const colonIndex = stmt.indexOf(":");
  if (colonIndex === -1) {
    return "";
  }
  let typeStart = colonIndex + 1;
  while (typeStart < stmt.length && stmt[typeStart] === " ") {
    typeStart++;
  }
  let typeEnd = typeStart;
  while (
    typeEnd < stmt.length &&
    ((stmt[typeEnd] >= "a" && stmt[typeEnd] <= "z") ||
      (stmt[typeEnd] >= "A" && stmt[typeEnd] <= "Z") ||
      (stmt[typeEnd] >= "0" && stmt[typeEnd] <= "9") ||
      stmt[typeEnd] === "*")
  ) {
    typeEnd++;
  }
  return stmt.substring(typeStart, typeEnd);
}

function extractReadType(stmt: string): string {
  const readIndex = stmt.indexOf("read<");
  if (readIndex === -1) {
    return "";
  }
  const typeStart = readIndex + 5;
  let typeEnd = typeStart;
  while (typeEnd < stmt.length && stmt[typeEnd] !== ">") {
    typeEnd++;
  }
  return stmt.substring(typeStart, typeEnd);
}

function extractLiteralType(stmt: string): string {
  const eqIndex = stmt.indexOf("=");
  if (eqIndex === -1) {
    return "";
  }
  const afterEq = extractAfterEq(stmt);
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

interface VariableInfo {
  name: string;
  declaredType: string;
  inferredType: string;
  isMutable: boolean;
  stmt: string;
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
    const allowed =
      varType === assignedType ||
      (varType === "U16" && assignedType === "U8") ||
      (varType === "U32" && ["U8", "U16"].indexOf(assignedType) !== -1) ||
      (varType === "U64" &&
        ["U8", "U16", "U32"].indexOf(assignedType) !== -1) ||
      (varType === "I16" && assignedType === "I8") ||
      (varType === "I32" && ["I8", "I16"].indexOf(assignedType) !== -1) ||
      (varType === "I64" && ["I8", "I16", "I32"].indexOf(assignedType) !== -1);
    if (!allowed) {
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

function forEachVariable(
  metadata: VariableInfo[],
  callback: (
    _varInfo: VariableInfo,
    _index: number,
  ) => Result<void, CompileError>,
): Result<void, CompileError> {
  let i = 0;
  while (i < metadata.length) {
    const result = callback(metadata[i], i);
    if (result.type === "err") {
      return result;
    }
    i++;
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

function checkAssignmentTypeMatch(
  metadata: VariableInfo[],
): Result<void, CompileError> {
  return forEachVariable(metadata, (varInfo) => {
    if (varInfo.declaredType === "") {
      return ok(void 0);
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
          const allowed =
            fromType === toType ||
            (fromType === "U8" &&
              ["U16", "U32", "U64", "I16", "I32", "I64"].indexOf(toType) !==
                -1) ||
            (fromType === "U16" &&
              ["U32", "U64", "I32", "I64"].indexOf(toType) !== -1) ||
            (fromType === "U32" && ["U64", "I64"].indexOf(toType) !== -1) ||
            (fromType === "I8" &&
              ["I16", "I32", "I64"].indexOf(toType) !== -1) ||
            (fromType === "I16" && ["I32", "I64"].indexOf(toType) !== -1) ||
            (fromType === "I32" && toType === "I64");
          if (!allowed) {
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
    return ok(void 0);
  });
}

function findVariable(
  varName: string,
  metadata: VariableInfo[],
): VariableInfo | undefined {
  let i = 0;
  while (i < metadata.length) {
    if (metadata[i].name === varName) {
      return metadata[i];
    }
    i++;
  }
  return undefined;
}

type OperatorChecker = (
  _varName: string,
  _varInfo: VariableInfo | undefined,
  _source: string,
) => Result<void, CompileError>;

function checkOperatorOnVariables(
  source: string,
  metadata: VariableInfo[],
  operator: string,
  checker: OperatorChecker,
  shouldSkipTypeAnnotation: boolean,
  prefixAfterOperator?: string,
): Result<void, CompileError> {
  const statements = splitStatementsKeepBlocks(source);
  let stmtIdx = 0;
  while (stmtIdx < statements.length) {
    const stmt = statements[stmtIdx];

    // Skip type annotation part if needed
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
          const varInfo = findVariable(varName, metadata);
          const checkRes = checker(varName, varInfo, source);
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

function forEachAddressOf(
  source: string,
  callback: (
    _varName: string,
    _isMut: boolean,
    _position: number,
    _varEnd: number,
  ) => void,
): void {
  let i = 0;
  while (i < source.length) {
    if (source[i] === "&") {
      let varStart = i + 1;
      let isMut = false;
      if (source.substring(i + 1, i + 5) === "mut ") {
        varStart = i + 5;
        isMut = true;
      }
      const varName = extractIdentifier(source, varStart);
      if (varName !== "") {
        callback(varName, isMut, i, advancePast(varStart, varName));
        i = advancePast(varStart, varName);
      } else {
        i++;
      }
    } else {
      i++;
    }
  }
}

interface DereferenceAssignment {
  varName: string;
  position: number;
  exprStart: number;
  exprEnd: number;
}

function findDereferenceAssignments(source: string): DereferenceAssignment[] {
  const assignments: DereferenceAssignment[] = [];
  let i = 0;
  while (i < source.length) {
    if (source[i] === "*") {
      const varName = identifierAfterDeref(source, i);
      if (varName !== "") {
        const afterVar = i + 1 + varName.length;
        if (source.substring(afterVar, afterVar + 3) === " = ") {
          let exprEnd = afterVar + 3;
          while (exprEnd < source.length && source[exprEnd] !== ";") {
            exprEnd++;
          }
          assignments.push({
            varName,
            position: i,
            exprStart: afterVar + 3,
            exprEnd,
          });
        }
      }
    }
    i++;
  }
  return assignments;
}

function checkImmutablePointerAssignments(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  const assignments = findDereferenceAssignments(source);
  let i = 0;
  while (i < assignments.length) {
    const assignment = assignments[i];
    const varInfo = findVariable(assignment.varName, metadata);
    if (varInfo !== undefined && !varInfo.declaredType.includes("mut")) {
      return err(
        createCompileError(
          source,
          `Cannot assign through immutable pointer: '${assignment.varName}' has type '${varInfo.declaredType}' but assignment through pointer requires mutable pointer type (*mut)`,
          "Assignment through dereference (*ptr = value) requires a mutable pointer",
          `Change '${assignment.varName}' to a mutable pointer type (: *mut <type>) or use direct assignment`,
        ),
      );
    }
    i++;
  }
  return ok(void 0);
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

  const entries: Array<[string, { hasImmut: boolean; hasMut: boolean }]> =
    Array.from(varMap.entries());
  let i = 0;
  while (i < entries.length) {
    const [varName, info] = entries[i];
    if (info.hasImmut && info.hasMut) {
      return err(
        createCompileError(
          source,
          `Cannot have both immutable and mutable pointers to '${varName}'`,
          "A variable cannot be borrowed both immutably (&x) and mutably (&mut x) at the same time",
          `Remove either the immutable pointer (&${varName}) or the mutable pointer (&mut ${varName})`,
        ),
      );
    }
    i++;
  }
  return ok(void 0);
}

function varNotDeclaredHint(varName: string, usage: string): string {
  return `Declare '${varName}' using 'let ${varName}${usage}' before using it`;
}

function advancePast(varStart: number, varName: string): number {
  return varStart + varName.length;
}

function checkAddressOfOperator(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  const mixedRes = checkMixedPointerTypes(source);
  if (mixedRes.type === "err") return mixedRes;

  const addressOfChecker: OperatorChecker = (varName, varInfo) => {
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

  const derefChecker: OperatorChecker = (varName, varInfo) => {
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
      return undeclaredVariableError(
        source,
        identifier,
        "is referenced but never declared",
        `Declare '${identifier}' using 'let ${identifier} = <value>;' before using it`,
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

function parseNumberLiteral(trimmed: string): Result<string, CompileError> {
  // Try parsing as a full number first
  let num = Number(trimmed);
  if (!Number.isNaN(num) && String(num) === trimmed) {
    return ok(trimmed);
  }

  // Check if input starts with minus sign
  const isNegative = trimmed[0] === "-";
  let numericStart: number;
  if (isNegative) {
    numericStart = 1;
  } else {
    numericStart = 0;
  }

  const { numericPart, endIndex } = extractNumericPart(trimmed, numericStart);

  if (numericPart !== "") {
    num = Number(numericPart);
    if (!Number.isNaN(num)) {
      // Check if there's a type suffix after the numeric part
      const hasSuffix = endIndex < trimmed.length;

      // Negative numbers with type suffixes are not allowed
      if (isNegative && hasSuffix) {
        return err(
          createCompileError(
            trimmed,
            "Negative numbers with type suffixes are not allowed",
            "Type suffixes are only valid for positive literal values",
            "Remove the type suffix from the negative number, or remove the minus sign if the value should be positive",
          ),
        );
      }

      // Extract and validate type suffix if present
      if (hasSuffix) {
        const suffix = trimmed.slice(endIndex);
        const validationResult = validateTypeSuffix(suffix, num, trimmed);
        if (validationResult.type === "err") {
          return validationResult;
        }
      }

      let resultValue: string;
      if (isNegative) {
        resultValue = "-" + numericPart;
      } else {
        resultValue = numericPart;
      }
      return ok(resultValue);
    }
  }

  return ok("0");
}

function transformAddressOf(source: string): string {
  let result = "";
  let lastEnd = 0;

  forEachAddressOf(source, (varName, isMut, position, varEnd) => {
    result += source.substring(lastEnd, position);
    if (isMut) {
      result += `{get:()=>${varName},set:(v)=>{${varName}=v}}`;
    } else {
      result += `{get:()=>${varName}}`;
    }
    lastEnd = varEnd;
  });

  result += source.substring(lastEnd);
  return result;
}

function transformDereference(source: string): string {
  let result = "";
  let lastEnd = 0;
  const assignments = findDereferenceAssignments(source);
  const assignmentSet = new Set(assignments.map((a) => a.position));

  let i = 0;
  while (i < source.length) {
    if (source[i] === "*") {
      result += source.substring(lastEnd, i);
      if (assignmentSet.has(i)) {
        const assignment = assignments.find((a) => a.position === i)!;
        result += `${assignment.varName}.set(${source.substring(assignment.exprStart, assignment.exprEnd)})`;
        lastEnd = assignment.exprEnd;
        i = assignment.exprEnd;
      } else {
        const varName = identifierAfterDeref(source, i);
        if (varName !== "") {
          result += `${varName}.get()`;
          lastEnd = i + 1 + varName.length;
          i = lastEnd;
        } else {
          result += source[i];
          lastEnd = i + 1;
          i++;
        }
      }
    } else {
      i++;
    }
  }
  result += source.substring(lastEnd);
  return result;
}

function transformReadPatterns(source: string): string {
  let result = "";
  let i = 0;
  while (i < source.length) {
    let consumed = 1;
    if (source.substring(i, i + 5) === "read<") {
      let j = i + 5;
      while (j < source.length && source[j] !== ">") {
        j++;
      }
      if (source[j] === ">" && source[j + 1] === "(" && source[j + 2] === ")") {
        result += "read()";
        consumed = j + 3 - i;
      }
    }
    if (consumed === 1) {
      result += source[i];
    }
    i += consumed;
  }
  return result;
}

function stripNumericTypeSuffixes(code: string): string {
  let result = "";
  let i = 0;
  while (i < code.length) {
    const char = code[i];
    if (isDigit(char)) {
      // Found start of a number
      let j = i;
      while (j < code.length && isDigit(code[j])) {
        j++;
      }
      // j is now at the first non-digit character
      result += code.substring(i, j);

      // Check if there's a type suffix (U8, I32, etc.)
      let suffixEnd = j;
      while (suffixEnd < code.length && isAlpha(code[suffixEnd])) {
        suffixEnd++;
      }

      // Skip the suffix
      i = suffixEnd;
    } else {
      result += char;
      i++;
    }
  }
  return result;
}

function extractBlockAndAfter(text: string): {
  block: string | null;
  after: string;
} {
  let braceDepth = 0;
  let blockStart = -1;
  let blockEnd = -1;

  let i = 0;
  while (i < text.length) {
    if (text[i] === "{") {
      if (braceDepth === 0) {
        blockStart = i;
      }
      braceDepth++;
    } else if (text[i] === "}") {
      braceDepth--;
      if (braceDepth === 0) {
        blockEnd = i + 1;
        break;
      }
    }
    i++;
  }

  if (blockStart === -1) {
    return { block: null, after: text };
  }

  const block = text.substring(blockStart, blockEnd);
  const after = text.substring(blockEnd).trim();
  return { block, after };
}

function verifyLetStatement(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  const dupRes = checkVariableDuplicates(metadata);
  if (dupRes.type === "err") return dupRes;
  // Inline checkReadTypeMatch
  let i = 0;
  while (i < metadata.length) {
    const varInfo = metadata[i];
    if (varInfo.stmt.indexOf("read<") !== -1) {
      const readType = extractReadType(varInfo.stmt);
      if (
        varInfo.declaredType !== "" &&
        readType !== "" &&
        varInfo.declaredType !== readType
      ) {
        return err(
          createCompileError(
            varInfo.stmt,
            `Type mismatch: declared variable as '${varInfo.declaredType}' but initialized with 'read<${readType}>()'`,
            "Variable declaration type must match the type of the read operation",
            `Change either the declared type to '${readType}' or the read type to '<${varInfo.declaredType}>'`,
          ),
        );
      }
    }
    i++;
  }
  const assignRes = checkAssignmentTypeMatch(metadata);
  if (assignRes.type === "err") return assignRes;
  const ptrRes = checkPointerOperators(source, metadata);
  if (ptrRes.type === "err") return ptrRes;
  const undefRes = checkUndefinedVariables(source, metadata);
  if (undefRes.type === "err") return undefRes;
  const reassignRes = checkReassignments(source, metadata);
  if (reassignRes.type === "err") return reassignRes;
  return ok(void 0);
}

function generateFunctionFromLastStatement(
  beforeLastStatement: string,
  lastStatement: string,
): string {
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

function findBlockEnd(text: string): number {
  let braceDepth = 0;
  let i = 0;
  while (i < text.length) {
    if (text[i] === "{") {
      braceDepth++;
    } else if (text[i] === "}") {
      braceDepth--;
      if (braceDepth === 0) {
        return i;
      }
    }
    i++;
  }
  return -1;
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

  let firstChar: string;
  if (afterBlock.length > 0) {
    firstChar = afterBlock[0];
  } else {
    firstChar = "";
  }

  const isLetter = isAlpha(firstChar);

  if (!isLetter) {
    return null;
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

function compileLetStatement(
  source: string,
): Result<string, CompileError> | null {
  const trimmed = source.trim();
  if (trimmed.indexOf("let ") === -1) {
    return null;
  }
  const metadata = buildVariableMetadata(trimmed);
  const verRes = verifyLetStatement(trimmed, metadata);
  if (verRes.type === "err") return verRes;
  const code = stripNumericTypeSuffixes(
    transformDereference(
      transformAddressOf(stripTypeAnnotations(transformReadPatterns(trimmed))),
    ),
  );
  let braceDepth = 0;
  let lastSemicolonIndex = -1;
  let i = 0;
  while (i < code.length) {
    if (code[i] === "{") {
      braceDepth++;
    } else if (code[i] === "}") {
      braceDepth--;
    } else if (code[i] === ";" && braceDepth === 0) {
      lastSemicolonIndex = i;
    }
    i++;
  }
  if (lastSemicolonIndex === -1) {
    return ok(`(function() { return ${code}; })()`);
  }
  const beforeLastStatement = code.substring(0, lastSemicolonIndex + 1);
  const lastStatement = code.substring(lastSemicolonIndex + 1).trim();
  if (lastStatement === "") {
    return ok(`(function() { ${code} return 0; })()`);
  }
  const generatedCode = generateFunctionFromLastStatement(
    beforeLastStatement,
    lastStatement,
  );
  return ok(generatedCode);
}

export function compile(source: string): Result<string, CompileError> {
  const trimmed = source.trim();

  if (trimmed === "") {
    return ok("0");
  }

  const blockScopeRes = checkBlockScopes(source);
  if (blockScopeRes !== null) {
    return blockScopeRes;
  }

  const letRes = compileLetStatement(source);
  if (letRes !== null) {
    return letRes;
  }

  if (trimmed.indexOf("read<") !== -1) {
    const emptyMetadata: VariableInfo[] = [];
    const reassignRes = checkReassignments(trimmed, emptyMetadata);
    if (reassignRes.type === "err") {
      return reassignRes;
    }
    return ok(transformReadPatterns(trimmed));
  }

  if (trimmed.startsWith("{}")) {
    const afterBlock = trimmed.substring(2).trim();
    if (afterBlock !== "") {
      return compile(afterBlock);
    }
    return ok("0");
  }

  const undefCheckResult = checkUndefinedVariables(trimmed, []);
  if (undefCheckResult.type === "err") {
    return undefCheckResult;
  }

  return parseNumberLiteral(trimmed);
}
