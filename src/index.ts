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

function transformReadPatterns(source: string): string {
  let result = "";
  let i = 0;
  while (i < source.length) {
    if (source.substring(i, i + 5) === "read<") {
      // Find the closing >()
      let j = i + 5;
      while (j < source.length && source[j] !== ">") {
        j++;
      }
      if (
        j < source.length &&
        source[j] === ">" &&
        source[j + 1] === "(" &&
        source[j + 2] === ")"
      ) {
        result += "read()";
        i = j + 3;
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

function stripTypeAnnotations(source: string): string {
  let result = "";
  let i = 0;
  while (i < source.length) {
    if (i < source.length - 1 && source[i] === ":" && source[i + 1] === " ") {
      // Skip the colon and space
      i += 2;
      // Skip the type name (letters, digits, angle brackets for generics)
      while (i < source.length) {
        const char = source[i];
        if (
          (char >= "a" && char <= "z") ||
          (char >= "A" && char <= "Z") ||
          (char >= "0" && char <= "9") ||
          char === "<" ||
          char === ">" ||
          char === ","
        ) {
          i++;
        } else {
          break;
        }
      }
      // Skip any trailing spaces after the type
      while (i < source.length && source[i] === " ") {
        i++;
      }
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
  while (i < str.length) {
    const c = str[i];
    if (
      (c >= "a" && c <= "z") ||
      (c >= "A" && c <= "Z") ||
      (c >= "0" && c <= "9") ||
      c === "_"
    ) {
      identifier += c;
      i++;
    } else {
      break;
    }
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
  while (typeEnd < stmt.length) {
    const c = stmt[typeEnd];
    if (
      (c >= "a" && c <= "z") ||
      (c >= "A" && c <= "Z") ||
      (c >= "0" && c <= "9")
    ) {
      typeEnd++;
    } else {
      break;
    }
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
  stmt: string;
}

function buildVariableMetadata(source: string): VariableInfo[] {
  const statements: string[] = [];
  let current = "";
  let si = 0;
  while (si < source.length) {
    const char = source[si];
    if (char === ";") {
      if (current.trim() !== "") {
        statements.push(current.trim());
      }
      current = "";
    } else {
      current += char;
    }
    si++;
  }
  if (current.trim() !== "") {
    statements.push(current.trim());
  }
  const metadata: VariableInfo[] = [];
  let j = 0;
  while (j < statements.length) {
    const stmt = statements[j];
    if (stmt.substring(0, 4) === "let ") {
      const name = extractIdentifier(stmt, 4);
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
      metadata.push({ name, declaredType, inferredType, stmt });
    }
    j++;
  }
  return metadata;
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
          if (metadata[j].inferredType !== varInfo.declaredType) {
            return err(
              createCompileError(
                varInfo.stmt,
                `Type mismatch: variable '${assignedVar}' has type '${metadata[j].inferredType}' but '${varInfo.declaredType}' was expected`,
                "Variable assignments must match the declared type",
                `Change the declared type to '${metadata[j].inferredType}' or assign a different variable`,
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
    let found = false;
    let j = 0;
    while (j < metadata.length) {
      if (metadata[j].name === identifier) {
        found = true;
        break;
      }
      j++;
    }
    if (!found) {
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

export function compile(source: string): Result<string, CompileError> {
  const trimmed = source.trim();

  if (trimmed === "") {
    return ok("0");
  }

  if (trimmed.indexOf("let ") !== -1) {
    const metadata = buildVariableMetadata(trimmed);
    const dupResult = checkVariableDuplicates(metadata);
    if (dupResult.type === "err") {
      return dupResult;
    }
    const readResult = checkReadTypeMatch(metadata);
    if (readResult.type === "err") {
      return readResult;
    }
    const assignResult = checkAssignmentTypeMatch(metadata);
    if (assignResult.type === "err") {
      return assignResult;
    }
    const undefResult = checkUndefinedVariables(trimmed, metadata);
    if (undefResult.type === "err") {
      return undefResult;
    }
    const transformed = transformReadPatterns(trimmed);
    const stripped = stripTypeAnnotations(transformed);
    const lastSemicolonIndex = stripped.lastIndexOf(";");
    if (lastSemicolonIndex === -1) {
      return ok(`(function() { return ${stripped}; })()`);
    }
    const beforeLastStatement = stripped.substring(0, lastSemicolonIndex + 1);
    const lastStatement = stripped.substring(lastSemicolonIndex + 1).trim();
    if (lastStatement === "") {
      return ok(`(function() { ${stripped} return 0; })()`);
    }
    return ok(
      `(function() { ${beforeLastStatement} return ${lastStatement}; })()`,
    );
  }

  if (trimmed.indexOf("read<") !== -1) {
    const transformed = transformReadPatterns(trimmed);
    return ok(transformed);
  }

  const undefCheckResult = checkUndefinedVariables(trimmed, []);
  if (undefCheckResult.type === "err") {
    return undefCheckResult;
  }

  return parseNumberLiteral(trimmed);
}
