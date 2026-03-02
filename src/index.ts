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

function containsReadPattern(source: string): boolean {
  return source.indexOf("read<") !== -1;
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

function containsLetDeclaration(source: string): boolean {
  return source.indexOf("let ") !== -1;
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

function wrapInIife(code: string): string {
  // Find the last statement that's not a declaration
  // and add return to it
  const lastSemicolonIndex = code.lastIndexOf(";");
  if (lastSemicolonIndex === -1) {
    // No semicolon, wrap the whole thing with return
    return `(function() { return ${code}; })()`;
  }
  const beforeLastStatement = code.substring(0, lastSemicolonIndex + 1);
  const lastStatement = code.substring(lastSemicolonIndex + 1).trim();
  if (lastStatement === "") {
    // Only semicolons, no final statement - return 0
    return `(function() { ${code} return 0; })()`;
  }
  return `(function() { ${beforeLastStatement} return ${lastStatement}; })()`;
}

function validateNegativeWithSuffix(
  source: string,
): Result<string, CompileError> {
  return err(
    createCompileError(
      source,
      "Negative numbers with type suffixes are not allowed",
      "Type suffixes are only valid for positive literal values",
      "Remove the type suffix from the negative number, or remove the minus sign if the value should be positive",
    ),
  );
}

function splitByStatement(source: string): string[] {
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

function extractVariableName(stmt: string): string {
  if (stmt.substring(0, 4) !== "let ") {
    return "";
  }
  return extractIdentifier(stmt, 4);
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

function extractVariableFromAssignment(stmt: string): string {
  const eqIndex = stmt.indexOf("=");
  if (eqIndex === -1) {
    return "";
  }
  const afterEq = stmt.substring(eqIndex + 1).trim();
  return extractIdentifier(afterEq, 0);
}

interface VariableInfo {
  name: string;
  declaredType: string;
  inferredType: string;
  stmt: string;
}

function buildVariableMetadata(source: string): VariableInfo[] {
  const statements = splitByStatement(source);
  const metadata: VariableInfo[] = [];
  let j = 0;
  while (j < statements.length) {
    const stmt = statements[j];
    if (stmt.substring(0, 4) === "let ") {
      const name = extractVariableName(stmt);
      const declaredType = extractDeclaredType(stmt);
      const readType = extractReadType(stmt);
      let inferredType: string;
      if (declaredType !== "") {
        inferredType = declaredType;
      } else {
        inferredType = readType;
      }
      metadata.push({
        name,
        declaredType,
        inferredType,
        stmt,
      });
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
  let i = 0;
  while (i < metadata.length) {
    const varInfo = metadata[i];
    if (varInfo.stmt.indexOf("read<") === -1) {
      i++;
      continue;
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
    i++;
  }
  return ok(void 0);
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
    const assignedVar = extractVariableFromAssignment(varInfo.stmt);
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
    i++;
  }
  return ok(void 0);
}

function checkVariableValidation(source: string): Result<void, CompileError> {
  const metadata = buildVariableMetadata(source);
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
        return validateNegativeWithSuffix(trimmed);
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

  // Check for variable declarations
  if (containsLetDeclaration(trimmed)) {
    const varValidationResult = checkVariableValidation(trimmed);
    if (varValidationResult.type === "err") {
      return varValidationResult;
    }
    const transformed = transformReadPatterns(trimmed);
    const stripped = stripTypeAnnotations(transformed);
    const wrapped = wrapInIife(stripped);
    return ok(wrapped);
  }

  // Check for read<TYPE>() pattern (simple or in expression)
  if (containsReadPattern(trimmed)) {
    const transformed = transformReadPatterns(trimmed);
    return ok(transformed);
  }

  return parseNumberLiteral(trimmed);
}
