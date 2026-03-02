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

function extractNumericPart(
  source: string,
  startIndex: number,
): { numericPart: string; endIndex: number } {
  let numericPart = "";
  let endIndex = startIndex;
  let i = startIndex;
  while (i < source.length) {
    const char = source[i];
    if ((char >= "0" && char <= "9") || char === ".") {
      numericPart += char;
      endIndex = i + 1;
      i++;
    } else {
      break;
    }
  }
  return { numericPart, endIndex };
}

function stripTypeAnnotations(source: string): string {
  let result = "";
  let i = 0;
  while (i < source.length) {
    if (i < source.length - 5 && source.substring(i, i + 8) === "let mut ") {
      result += "let ";
      i += 8;
    } else if (
      i < source.length - 1 &&
      source[i] === ":" &&
      source[i + 1] === " "
    ) {
      let j = i + 2; // skip ": "
      while (j < source.length) {
        const char = source[j];
        if (
          (char >= "a" && char <= "z") ||
          (char >= "A" && char <= "Z") ||
          (char >= "0" && char <= "9") ||
          char === "<" ||
          char === ">" ||
          char === "," ||
          char === "*"
        ) {
          j++;
        } else if (
          char === " " &&
          j + 1 < source.length &&
          ((source[j + 1] >= "a" && source[j + 1] <= "z") ||
            (source[j + 1] >= "A" && source[j + 1] <= "Z"))
        ) {
          j++;
        } else {
          break;
        }
      }
      while (j < source.length && source[j] === " ") {
        j++;
      }
      i = j;
    } else {
      result += source[i];
      i++;
    }
  }
  return result;
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
  const afterEq = stmt.substring(eqIndex + 1).trim();
  let digitEnd = 0;
  while (digitEnd < afterEq.length) {
    const c = afterEq[digitEnd];
    if ((c >= "0" && c <= "9") || c === ".") {
      digitEnd++;
    } else {
      break;
    }
  }
  if (digitEnd === 0) {
    return "";
  }
  const _numericPart = afterEq.substring(0, digitEnd);
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

function splitStatements(source: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === ";") {
      if (current.trim() !== "") {
        statements.push(current.trim());
      }
      current = "";
    } else {
      current += char;
    }
    i++;
  }
  if (current.trim() !== "") {
    statements.push(current.trim());
  }
  return statements;
}

function buildVariableMetadata(source: string): VariableInfo[] {
  const statements = splitStatements(source);
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
  const eqIndex = stmt.indexOf("=");
  const afterEq = stmt.substring(eqIndex + 1).trim();
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
    varInfo: VariableInfo,
    index: number,
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

function checkReadTypeMatch(
  metadata: VariableInfo[],
): Result<void, CompileError> {
  return forEachVariable(metadata, (varInfo) => {
    if (varInfo.stmt.indexOf("read<") === -1) {
      return ok(void 0);
    }
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
    return ok(void 0);
  });
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
  varName: string,
  varInfo: VariableInfo | undefined,
  source: string,
) => Result<void, CompileError>;

function checkOperatorOnVariables(
  source: string,
  metadata: VariableInfo[],
  operator: string,
  checker: OperatorChecker,
  shouldSkipTypeAnnotation: boolean,
  prefixAfterOperator?: string,
): Result<void, CompileError> {
  const statements = splitStatements(source);
  let si = 0;
  while (si < statements.length) {
    const stmt = statements[si];

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
          i = varStart + varName.length;
        } else {
          i++;
        }
      } else {
        i++;
      }
    }
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

function checkPointerOperators(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  const addressOfChecker: OperatorChecker = (varName, varInfo) => {
    if (varInfo === undefined) {
      return undeclaredVariableError(
        source,
        varName,
        "is referenced with address-of operator but never declared",
        `Declare '${varName}' using 'let ${varName} = <value>;' before using &${varName}`,
      );
    }
    return ok(void 0);
  };
  const addressOfRes = checkOperatorOnVariables(
    source,
    metadata,
    "&",
    addressOfChecker,
    false,
    "mut ",
  );
  if (addressOfRes.type === "err") return addressOfRes;

  const derefChecker: OperatorChecker = (varName, varInfo) => {
    if (varInfo === undefined) {
      return undeclaredVariableError(
        source,
        varName,
        "is dereferenced but never declared",
        `Declare '${varName}' using 'let ${varName} : *<type> = <value>;' before using *${varName}`,
      );
    }
    if (!varInfo.declaredType.includes("*")) {
      return err(
        createCompileError(
          source,
          `Cannot dereference non-pointer variable: '${varName}' has type '${varInfo.declaredType}' but attempted dereference requires pointer type`,
          "Dereference operator (*) can only be applied to pointer types",
          `Change '${varName}' to a pointer type (e.g., : *${varInfo.declaredType}) or use variable directly`,
        ),
      );
    }
    return ok(void 0);
  };
  return checkOperatorOnVariables(source, metadata, "*", derefChecker, true);
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
  const isLetter =
    (firstChar >= "a" && firstChar <= "z") ||
    (firstChar >= "A" && firstChar <= "Z");
  if (!isLetter) {
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
  const statements = splitStatements(source);
  for (const stmt of statements) {
    if (stmt.substring(0, 4) === "let ") {
      continue;
    }
    const eqIndex = stmt.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }
    const beforeEq = stmt.substring(0, eqIndex).trim();
    const identifier = extractIdentifier(beforeEq, 0);
    if (identifier !== beforeEq) {
      continue;
    }
    let metaVar: VariableInfo | null = null;
    for (const v of metadata) {
      if (v.name === identifier) {
        metaVar = v;
        break;
      }
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
        if (isMut) {
          result += `{get:()=>${varName},set:(v)=>{${varName}=v}}`;
        } else {
          result += `{get:()=>${varName}}`;
        }
        i = varStart + varName.length;
      } else {
        result += "&";
        i++;
      }
    } else {
      result += source[i];
      i++;
    }
  }
  return result;
}

function transformDereference(source: string): string {
  let result = "";
  let i = 0;
  while (i < source.length) {
    if (source[i] === "*") {
      const varName = extractIdentifier(source, i + 1);
      if (varName !== "") {
        const afterVar = i + 1 + varName.length;
        if (source.substring(afterVar, afterVar + 3) === " = ") {
          let exprEnd = afterVar + 3;
          while (exprEnd < source.length && source[exprEnd] !== ";") {
            exprEnd++;
          }
          result += `${varName}.set(${source.substring(afterVar + 3, exprEnd)})`;
          i = exprEnd;
        } else {
          result += `${varName}.get()`;
          i += 1 + varName.length;
        }
      } else {
        result += source[i];
        i++;
      }
    } else {
      result += source[i];
      i++;
    }
  }
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


export function compile(source: string): Result<string, CompileError> {
  const trimmed = source.trim();

  if (trimmed === "") {
    return ok("0");
  }

  if (trimmed.indexOf("let ") !== -1) {
    const metadata = buildVariableMetadata(trimmed);
    // Check duplicates
    const dupRes = checkVariableDuplicates(metadata);
    if (dupRes.type === "err") return dupRes;
    // Check read types
    const readRes = checkReadTypeMatch(metadata);
    if (readRes.type === "err") return readRes;
    // Check assignment types
    const assignRes = checkAssignmentTypeMatch(metadata);
    if (assignRes.type === "err") return assignRes;
    // Check address-of and dereference variables
    const ptrRes = checkPointerOperators(trimmed, metadata);
    if (ptrRes.type === "err") return ptrRes;
    // Check undefined vars
    const undefRes = checkUndefinedVariables(trimmed, metadata);
    if (undefRes.type === "err") return undefRes;
    // Check reassignments
    const reassignRes = checkReassignments(trimmed, metadata);
    if (reassignRes.type === "err") return reassignRes;
    const code = transformDereference(transformAddressOf(stripTypeAnnotations(transformReadPatterns(trimmed))));
    const lastSemicolonIndex = code.lastIndexOf(";");
    if (lastSemicolonIndex === -1) {
      return ok(`(function() { return ${code}; })()`);
    }
    const beforeLastStatement = code.substring(0, lastSemicolonIndex + 1);
    const lastStatement = code.substring(lastSemicolonIndex + 1).trim();
    if (lastStatement === "") {
      return ok(`(function() { ${code} return 0; })()`);
    }
    return ok(
      `(function() { ${beforeLastStatement} return ${lastStatement}; })()`,
    );
  }

  if (trimmed.indexOf("read<") !== -1) {
    const emptyMetadata: VariableInfo[] = [];
    const reassignRes = checkReassignments(trimmed, emptyMetadata);
    if (reassignRes.type === "err") {
      return reassignRes;
    }
    return ok(transformReadPatterns(trimmed));
  }

  const undefCheckResult = checkUndefinedVariables(trimmed, []);
  if (undefCheckResult.type === "err") {
    return undefCheckResult;
  }

  return parseNumberLiteral(trimmed);
}
