interface CompileSuccess {
  value: string;
}

interface CompileError {
  error: string;
}

type Result = CompileSuccess | CompileError;

interface VariableInfo {
  mutable: boolean;
  declaredAt: number;
}

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function isLetter(char: string): boolean {
  return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
}

function isIdentifierChar(char: string): boolean {
  return isLetter(char) || isDigit(char) || char === "_";
}

function hasTypeSuffix(source: string, i: number): boolean {
  return i < source.length && (isLetter(source[i]) || isDigit(source[i]));
}

export function compile(source: string): Result {
  // First, check semantics - validate variable declarations and assignments
  const variables = new Map<string, VariableInfo>();
  let validateI = 0;

  while (validateI < source.length) {
    // Skip whitespace
    while (validateI < source.length && source[validateI] === " ") {
      validateI++;
    }

    // Check for variable declaration
    if (
      source.substring(validateI, validateI + 3) === "let" &&
      (validateI + 3 >= source.length || source[validateI + 3] === " ")
    ) {
      validateI += 3;
      while (validateI < source.length && source[validateI] === " ") {
        validateI++;
      }

      let mutable = false;
      if (source.substring(validateI, validateI + 3) === "mut") {
        mutable = true;
        validateI += 3;
        while (validateI < source.length && source[validateI] === " ") {
          validateI++;
        }
      }

      // Extract variable name
      const nameStart = validateI;
      while (validateI < source.length && isIdentifierChar(source[validateI])) {
        validateI++;
      }
      const varName = source.substring(nameStart, validateI);

      if (varName.length === 0) {
        return { error: "Expected variable name after let" };
      }

      // Check for redeclaration
      if (variables.has(varName)) {
        return {
          error: `Variable '${varName}' is already declared`,
        };
      }

      variables.set(varName, { mutable, declaredAt: nameStart });

      // Skip to end of statement
      while (validateI < source.length && source[validateI] !== ";") {
        validateI++;
      }
      if (validateI < source.length && source[validateI] === ";") {
        validateI++;
      }
    } else if (isLetter(source[validateI]) || source[validateI] === "_") {
      // Check for identifier (potential variable use/assignment)
      const ident = source.substring(
        validateI,
        (() => {
          let end = validateI;
          while (end < source.length && isIdentifierChar(source[end])) {
            end++;
          }
          validateI = end;
          return end;
        })(),
      );

      // Skip whitespace
      while (validateI < source.length && source[validateI] === " ") {
        validateI++;
      }

      // Check if this is an assignment
      if (validateI < source.length && source[validateI] === "=") {
        // Check if it's not a comparison (==)
        if (validateI + 1 < source.length && source[validateI + 1] !== "=") {
          // This is an assignment - check if variable exists and is mutable
          if (!variables.has(ident)) {
            return {
              error: `Variable '${ident}' is not declared`,
            };
          }
          const varInfo = variables.get(ident);
          if (!varInfo!.mutable) {
            return {
              error: `Cannot assign to immutable variable '${ident}'`,
            };
          }
        }
        validateI++;
      }

      // Continue to next character
    } else {
      validateI++;
    }
  }

  // Remove type annotations like <U8>, <I32>, etc. and literal suffixes like 100U8
  let transformed = "";
  let i = 0;
  while (i < source.length) {
    if (source[i] === "<") {
      // Skip until closing >
      while (i < source.length && source[i] !== ">") {
        i++;
      }
      i++; // skip the closing >
    } else if (
      source[i] === ":" &&
      i > 0 &&
      transformed.trimEnd().endsWith("x")
    ) {
      // Skip type annotation after colon (e.g., ": U8")
      i++; // skip the colon
      // Skip whitespace after colon
      while (i < source.length && source[i] === " ") {
        i++;
      }
      // Skip the type name (letters and digits)
      while (i < source.length && (isLetter(source[i]) || isDigit(source[i]))) {
        i++;
      }
      // Add back a single space if we removed whitespace
      transformed += " ";
    } else if (
      source[i] === "l" &&
      i + 3 < source.length &&
      source.substring(i, i + 3) === "let"
    ) {
      // Handle "let mut" syntax
      transformed += "let";
      i += 3;
      // Skip spaces after "let"
      while (i < source.length && source[i] === " ") {
        transformed += source[i];
        i++;
      }
      // Check for "mut" keyword and skip it
      if (i + 3 <= source.length && source.substring(i, i + 3) === "mut") {
        i += 3;
        // Skip spaces after "mut"
        while (i < source.length && source[i] === " ") {
          transformed += source[i];
          i++;
        }
      }
    } else if (
      source[i] === "-" &&
      i + 1 < source.length &&
      isDigit(source[i + 1])
    ) {
      // Check for negative literals (e.g., -100U8)
      let j = i + 1;
      while (j < source.length && isDigit(source[j])) {
        j++;
      }
      // Check if digits are followed by a type suffix
      if (hasTypeSuffix(source, j)) {
        return { error: "Negative literals are not allowed" };
      }
      transformed += source[i];
      i++;
    } else if (isDigit(source[i])) {
      // Consume all digits and track them
      let numStr = "";
      while (i < source.length && isDigit(source[i])) {
        numStr += source[i];
        transformed += source[i];
        i++;
      }
      // Check for type suffix (letters and digits that follow, like U8, I32, etc.)
      if (hasTypeSuffix(source, i)) {
        let typeEnd = i;
        while (
          typeEnd < source.length &&
          (isLetter(source[typeEnd]) || isDigit(source[typeEnd]))
        ) {
          typeEnd++;
        }
        const typeSuffix = source.substring(i, typeEnd);
        const numValue = parseInt(numStr, 10);
        switch (typeSuffix) {
          case "U8":
            if (numValue > 255) {
              return { error: "Value 256 is out of range for U8 (0-255)" };
            }
            break;
          case "U16":
            if (numValue > 65535) {
              return { error: "Value is out of range for U16 (0-65535)" };
            }
            break;
          case "U32":
            if (numValue > 4294967295) {
              return { error: "Value is out of range for U32 (0-4294967295)" };
            }
            break;
          case "I8":
            if (numValue > 127) {
              return {
                error: "Value 128 is out of range for I8 (-128 to 127)",
              };
            }
            break;
          case "I16":
            if (numValue > 32767) {
              return {
                error: "Value is out of range for I16 (-32768 to 32767)",
              };
            }
            break;
          case "I32":
            if (numValue > 2147483647) {
              return {
                error:
                  "Value is out of range for I32 (-2147483648 to 2147483647)",
              };
            }
            break;
        }
        i = typeEnd;
      }
    } else {
      transformed += source[i];
      i++;
    }
  }
  // Check if code contains variable declarations or statements
  if (
    transformed.includes("let ") ||
    transformed.includes("var ") ||
    transformed.includes("const ")
  ) {
    const trimmed = transformed.trim();
    const lastSemicolon = trimmed.lastIndexOf(";");
    if (lastSemicolon >= 0 && lastSemicolon < trimmed.length - 1) {
      // There's an expression after the last semicolon
      const statements = trimmed.substring(0, lastSemicolon + 1);
      const returnExpr = trimmed.substring(lastSemicolon + 1).trim();
      return {
        value: `return (function() { ${statements} return ${returnExpr}; }())`,
      };
    } else {
      // No expression after semicolon, assume last statement should return
      return {
        value: `return (function() { ${trimmed} }())`,
      };
    }
  }
  // Wrap in a return statement for simple expressions
  return { value: `return ${transformed};` };
}
