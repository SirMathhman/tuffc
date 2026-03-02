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

function extractVariableName(stmt: string): string {
  if (stmt.substring(0, 4) !== "let ") {
    return "";
  }
  let varName = "";
  let k = 4;
  while (k < stmt.length) {
    const c = stmt[k];
    if (
      (c >= "a" && c <= "z") ||
      (c >= "A" && c <= "Z") ||
      (c >= "0" && c <= "9") ||
      c === "_"
    ) {
      varName += c;
      k++;
    } else {
      break;
    }
  }
  return varName;
}

function checkDuplicateVariables(source: string): Result<void, CompileError> {
  const statements = splitByStatement(source);
  const declaredVars: string[] = [];
  let j = 0;
  while (j < statements.length) {
    const stmt = statements[j];
    const varName = extractVariableName(stmt);
    if (varName !== "") {
      let isDuplicate = false;
      let m = 0;
      while (m < declaredVars.length) {
        if (declaredVars[m] === varName) {
          isDuplicate = true;
          break;
        }
        m++;
      }
      if (isDuplicate) {
        return err(
          createCompileError(
            stmt,
            `Duplicate variable declaration: '${varName}' is already declared`,
            "Variables can only be declared once in a scope",
            `Use a different variable name, or remove the duplicate declaration`,
          ),
        );
      }
      declaredVars.push(varName);
    }
    j++;
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
    const dupCheckResult = checkDuplicateVariables(trimmed);
    if (dupCheckResult.type === "err") {
      return dupCheckResult;
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
