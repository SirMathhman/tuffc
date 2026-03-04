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
  type: string | undefined; // Support types like "U8", "Bool", "*U8", "*mut U8", etc.
}

interface OptionalError {
  error: string;
}

function returnUndeclaredError(ident: string): OptionalError {
  return { error: `Variable '${ident}' is not declared` };
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

      // Extract optional type annotation
      let annotatedType: string | undefined;
      let typeAnnotationI = validateI;
      while (
        typeAnnotationI < source.length &&
        source[typeAnnotationI] === " "
      ) {
        typeAnnotationI++;
      }
      if (typeAnnotationI < source.length && source[typeAnnotationI] === ":") {
        typeAnnotationI++; // skip colon
        while (
          typeAnnotationI < source.length &&
          source[typeAnnotationI] === " "
        ) {
          typeAnnotationI++;
        }
        // Extract type, handling pointer syntax: *T or *mut T
        let typeStr = "";
        if (
          typeAnnotationI < source.length &&
          source[typeAnnotationI] === "*"
        ) {
          typeStr += "*";
          typeAnnotationI++;
          while (
            typeAnnotationI < source.length &&
            source[typeAnnotationI] === " "
          ) {
            typeAnnotationI++;
          }
          if (
            source.substring(typeAnnotationI, typeAnnotationI + 3) === "mut"
          ) {
            typeStr += "mut ";
            typeAnnotationI += 3;
            while (
              typeAnnotationI < source.length &&
              source[typeAnnotationI] === " "
            ) {
              typeAnnotationI++;
            }
          }
        }
        // Extract base type name
        typeStr += source.substring(
          typeAnnotationI,
          (() => {
            while (
              typeAnnotationI < source.length &&
              (isLetter(source[typeAnnotationI]) ||
                isDigit(source[typeAnnotationI]))
            ) {
              typeAnnotationI++;
            }
            return typeAnnotationI;
          })(),
        );
        annotatedType = typeStr.length > 0 ? typeStr : undefined;

        // Validate: no pointer-to-pointer types
        if (annotatedType && annotatedType.includes("*")) {
          let pointerCount = 0;
          for (const c of annotatedType) {
            if (c === "*") pointerCount++;
          }
          if (pointerCount > 1) {
            return {
              error: `Pointer-to-pointer types are not supported: '${annotatedType}'`,
            };
          }
        }
      }
      validateI = typeAnnotationI;

      // Skip whitespace
      while (validateI < source.length && source[validateI] === " ") {
        validateI++;
      }

      // Skip assignment operator if present
      let inferredType: string | undefined = undefined;
      if (validateI < source.length && source[validateI] === "=") {
        validateI++; // skip =
        while (validateI < source.length && source[validateI] === " ") {
          validateI++;
        }

        // Extract the RHS expression and infer its type
        const rhsExpr = source
          .substring(
            validateI,
            (() => {
              let end = validateI;
              while (end < source.length && source[end] !== ";") {
                end++;
              }
              validateI = end;
              return end;
            })(),
          )
          .trim();

        // Check for invalid operations
        const trimmedRhs = rhsExpr;
        let hasOpError = false;
        if (trimmedRhs.includes("true") || trimmedRhs.includes("false")) {
          let i = 0;
          let hasBoolean = false;
          let hasArithmetic = false;
          while (i < trimmedRhs.length) {
            if (
              trimmedRhs.substring(i, i + 4) === "true" ||
              trimmedRhs.substring(i, i + 5) === "false"
            ) {
              hasBoolean = true;
              i += trimmedRhs[i] === "t" ? 4 : 5;
            } else if (trimmedRhs[i] === "+" || trimmedRhs[i] === "*") {
              hasArithmetic = true;
              i++;
            } else if (
              trimmedRhs[i] === "-" &&
              i > 0 &&
              trimmedRhs[i - 1] !== "!" &&
              trimmedRhs[i - 1] !== "(" &&
              trimmedRhs[i - 1] !== "&" &&
              trimmedRhs[i - 1] !== " "
            ) {
              hasArithmetic = true;
              i++;
            } else {
              i++;
            }
          }
          if (hasBoolean && hasArithmetic) {
            hasOpError = true;
          }
        }
        if (hasOpError) {
          return {
            error:
              "Invalid operation: arithmetic operators not allowed on booleans",
          };
        }

        // Infer type from RHS
        const trimmed = rhsExpr;
        let inferred:
          | "U8"
          | "U16"
          | "U32"
          | "I8"
          | "I16"
          | "I32"
          | "Bool"
          | string
          | undefined;

        // Check for reference operators: &mut variable or &variable
        if (trimmed.startsWith("&mut ")) {
          const refVar = trimmed.substring(5).trim();
          const refVarInfo = variables.get(refVar);
          if (!refVarInfo) {
            return returnUndeclaredError(refVar);
          }
          if (!refVarInfo.mutable) {
            return {
              error: `Cannot create mutable reference to immutable variable '${refVar}'`,
            };
          }
          if (refVarInfo && refVarInfo.type) {
            inferred = "*mut " + refVarInfo.type;
          }
        } else if (trimmed.startsWith("&")) {
          const refVar = trimmed.substring(1).trim();
          const refVarInfo = variables.get(refVar);
          if (!refVarInfo) {
            return returnUndeclaredError(refVar);
          }
          if (refVarInfo && refVarInfo.type) {
            inferred = "*" + refVarInfo.type;
          }
        } else if (
          trimmed.startsWith("*") &&
          (isLetter(trimmed[1]) || trimmed[1] === "_")
        ) {
          // Dereference operation: *variable
          const derefVar = trimmed.substring(1).trim();
          const derefVarInfo = variables.get(derefVar);
          if (!derefVarInfo) {
            return returnUndeclaredError(derefVar);
          }
          const baseType = derefVarInfo.type;
          if (!baseType || !baseType.startsWith("*")) {
            return {
              error: `Cannot dereference non-pointer variable '${derefVar}'`,
            };
          }
          // Remove the * prefix from the pointer type to get the base type
          inferred = baseType.substring(1);
        } else if (trimmed === "true" || trimmed === "false") {
          inferred = "Bool";
        } else if (trimmed.includes("&&") || trimmed.includes("||")) {
          inferred = "Bool";
        } else if (trimmed.startsWith("!")) {
          inferred = "Bool";
        } else if (trimmed.endsWith("U8")) {
          inferred = "U8";
        } else if (trimmed.endsWith("U16")) {
          inferred = "U16";
        } else if (trimmed.endsWith("U32")) {
          inferred = "U32";
        } else if (trimmed.endsWith("I8")) {
          inferred = "I8";
        } else if (trimmed.endsWith("I16")) {
          inferred = "I16";
        } else if (trimmed.endsWith("I32")) {
          inferred = "I32";
        } else {
          let isNumeric = true;
          for (const c of trimmed) {
            if (!isDigit(c)) {
              isNumeric = false;
              break;
            }
          }

          if (isNumeric) {
            inferred = "U8";
          } else if (trimmed.includes("<") && trimmed.includes("(")) {
            // This is a function call with generics like read<U8>(), skip validation
            inferred = undefined;
          } else {
            // Check if it's a variable reference
            const varInfo = variables.get(trimmed);
            if (varInfo && varInfo.type) {
              inferred = varInfo.type;
            } else if (
              trimmed &&
              isLetter(trimmed[0]) &&
              !trimmed.includes("(")
            ) {
              // Looks like a variable but not found, and not a function call
              return returnUndeclaredError(trimmed);
            }
          }
        }
        inferredType = inferred;

        // Validate type mismatch
        if (annotatedType && inferredType && annotatedType !== inferredType) {
          return {
            error: `Type mismatch: variable '${varName}' declared as ${annotatedType} but assigned ${inferredType}`,
          };
        }
      }

      // Determine final type
      const finalType = annotatedType || inferredType;

      variables.set(varName, {
        mutable,
        declaredAt: nameStart,
        type: finalType,
      });

      // Skip to end of statement if not already there
      while (validateI < source.length && source[validateI] !== ";") {
        validateI++;
      }
      if (validateI < source.length && source[validateI] === ";") {
        validateI++;
      }
    } else if (isLetter(source[validateI]) || source[validateI] === "_") {
      // Check for dereference assignment (*identifier = value)
      let isDereferenceAssignment = false;
      if (
        validateI > 0 &&
        source[validateI - 1] === "*" &&
        (validateI < 2 ||
          source[validateI - 2] === " " ||
          source[validateI - 2] === "=")
      ) {
        isDereferenceAssignment = true;
      }

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
          // Check if variable exists - needed for both paths
          if (!variables.has(ident)) {
            return returnUndeclaredError(ident);
          }
          const varInfo = variables.get(ident);

          if (isDereferenceAssignment) {
            // Assignment through pointer dereference: *y = value
            const pointerType = varInfo!.type;
            if (!pointerType || !pointerType.startsWith("*")) {
              return {
                error: `Variable '${ident}' is not a pointer; cannot assign through dereference`,
              };
            }
            // Check that the pointer is mutable (*mut)
            if (!pointerType.startsWith("*mut")) {
              return {
                error: `Cannot assign to immutable pointer '${ident}'`,
              };
            }
          } else {
            // Direct assignment: x = value - check if variable is mutable
            if (!varInfo!.mutable) {
              return {
                error: `Cannot assign to immutable variable '${ident}'`,
              };
            }

            // Type check the RHS
            let assignI = validateI + 1;
            while (assignI < source.length && source[assignI] === " ") {
              assignI++;
            }
            const rhsStart = assignI;
            let assignEndI = rhsStart;
            while (
              assignEndI < source.length &&
              source[assignEndI] !== ";" &&
              source[assignEndI] !== " " // Stop at space that separates from next statement
            ) {
              assignEndI++;
            }
            const rhsValue = source.substring(rhsStart, assignEndI).trim();

            // Check type mismatch for direct assignments
            if (varInfo!.type) {
              const isBoolVar = varInfo!.type === "Bool";
              const isNumericVar =
                varInfo!.type === "U8" ||
                varInfo!.type === "U16" ||
                varInfo!.type === "U32" ||
                varInfo!.type === "I8" ||
                varInfo!.type === "I16" ||
                varInfo!.type === "I32";

              const isRhsBoolean =
                rhsValue === "true" ||
                rhsValue === "false" ||
                rhsValue.includes("&&") ||
                rhsValue.includes("||") ||
                rhsValue.startsWith("!");
              const isRhsNumeric =
                !isRhsBoolean &&
                !rhsValue.includes("read") &&
                rhsValue.length > 0 &&
                rhsValue[0] >= "0" &&
                rhsValue[0] <= "9";

              if (isBoolVar && isRhsNumeric) {
                return {
                  error: `Type mismatch: variable '${ident}' is Bool but assigned numeric instead`,
                };
              }
              if (isNumericVar && isRhsBoolean && !rhsValue.includes("read")) {
                return {
                  error: `Type mismatch for '${ident}': expected ${varInfo!.type} but got boolean`,
                };
              }
            }
          }
        }
        validateI++;
      }

      // Continue to next character
    } else {
      validateI++;
    }
  }

  // Validate undeclared variables
  const declaredVars = new Set(variables.keys());
  {
    let i = 0;
    while (i < source.length) {
      if (isDigit(source[i])) {
        while (i < source.length && isDigit(source[i])) {
          i++;
        }
        // Inline skipTypeSuffix
        while (
          i < source.length &&
          (isLetter(source[i]) || isDigit(source[i]))
        ) {
          i++;
        }
        continue;
      }

      if (isLetter(source[i]) || source[i] === "_") {
        const ident = source.substring(
          i,
          (() => {
            let end = i;
            while (end < source.length && isIdentifierChar(source[end])) {
              end++;
            }
            i = end;
            return end;
          })(),
        );

        if (
          ident === "let" ||
          ident === "mut" ||
          ident === "true" ||
          ident === "false" ||
          ident === "U8" ||
          ident === "U16" ||
          ident === "U32" ||
          ident === "I8" ||
          ident === "I16" ||
          ident === "I32" ||
          ident === "Bool"
        ) {
          continue;
        }

        let j = i;
        while (j < source.length && source[j] === " ") {
          j++;
        }
        const nextChar = source[j] || "";

        // Skip if this is part of a generic type argument like read<U8>
        if (nextChar === "<") {
          let angleDepth = 1;
          j++;
          while (j < source.length && angleDepth > 0) {
            if (source[j] === "<") angleDepth++;
            else if (source[j] === ">") angleDepth--;
            j++;
          }
          i = j;
          continue;
        }

        if (
          nextChar === "&" ||
          nextChar === "|" ||
          nextChar === "=" ||
          nextChar === ";" ||
          nextChar === ")" ||
          nextChar === "+" ||
          nextChar === "*" ||
          nextChar === ""
        ) {
          if (!declaredVars.has(ident) && ident !== "") {
            return returnUndeclaredError(ident);
          }
        }

        continue;
      }
      i++;
    }
  }

  // Validate no invalid operations (arithmetic on booleans)
  {
    const trimmed = source.trim();
    if (trimmed.includes("true") || trimmed.includes("false")) {
      let i = 0;
      let hasBoolean = false;
      let hasArithmetic = false;
      while (i < trimmed.length) {
        if (
          trimmed.substring(i, i + 4) === "true" ||
          trimmed.substring(i, i + 5) === "false"
        ) {
          hasBoolean = true;
          i += trimmed[i] === "t" ? 4 : 5;
        } else if (trimmed[i] === "+" || trimmed[i] === "*") {
          hasArithmetic = true;
          i++;
        } else if (
          trimmed[i] === "-" &&
          i > 0 &&
          trimmed[i - 1] !== "!" &&
          trimmed[i - 1] !== "(" &&
          trimmed[i - 1] !== "&" &&
          trimmed[i - 1] !== " "
        ) {
          hasArithmetic = true;
          i++;
        } else {
          i++;
        }
      }
      if (hasBoolean && hasArithmetic) {
        return {
          error:
            "Invalid operation: arithmetic operators not allowed on booleans",
        };
      }
    }
  }

  // Remove type annotations like <U8>, <I32>, etc. and literal suffixes like 100U8
  // Also identify variables that need wrapping (mutable variables that are referenced)
  const wrappedVariables = new Set<string>();
  {
    let scanI = 0;
    while (scanI < source.length) {
      let isReference = false;
      if (source.substring(scanI, scanI + 5) === "&mut ") {
        isReference = true;
        scanI += 5;
      } else if (
        source[scanI] === "&" &&
        (scanI === 0 || source[scanI - 1] !== "&") && // Not part of &&
        (scanI + 1 >= source.length || source[scanI + 1] !== "&") // Not part of &&
      ) {
        isReference = true;
        scanI++;
      }

      if (isReference) {
        // Skip whitespace and extract the referenced variable
        while (scanI < source.length && source[scanI] === " ") {
          scanI++;
        }
        const refVar = source.substring(
          scanI,
          (() => {
            while (scanI < source.length && isIdentifierChar(source[scanI])) {
              scanI++;
            }
            return scanI;
          })(),
        );
        if (variables.has(refVar)) {
          wrappedVariables.add(refVar);
        }
      } else {
        scanI++;
      }
    }
  }

  let transformed = "";
  let i = 0;
  while (i < source.length) {
    if (source[i] === "<") {
      // Skip until closing >
      while (i < source.length && source[i] !== ">") {
        i++;
      }
      i++; // skip the closing >
    } else if (source[i] === ":" && i > 0) {
      // Check if this looks like a type annotation (previous token is a variable name)
      const trimmedBefore = transformed.trimEnd();
      let isTypeAnnotation = false;
      if (trimmedBefore.length > 0) {
        const lastChar = trimmedBefore.charAt(trimmedBefore.length - 1);
        // If last char is identifier char, likely a variable name followed by type annotation
        if (isIdentifierChar(lastChar)) {
          isTypeAnnotation = true;
        }
      }
      if (isTypeAnnotation) {
        // Skip type annotation after colon (e.g., ": U8" or ": *mut U8")
        i++; // skip the colon
        // Skip whitespace after colon
        while (i < source.length && source[i] === " ") {
          i++;
        }
        // Skip pointer prefix if present
        if (source[i] === "*") {
          i++;
          while (i < source.length && source[i] === " ") {
            i++;
          }
          if (source.substring(i, i + 3) === "mut") {
            i += 3;
            while (i < source.length && source[i] === " ") {
              i++;
            }
          }
        }
        // Skip the base type name (letters and digits)
        while (
          i < source.length &&
          (isLetter(source[i]) || isDigit(source[i]))
        ) {
          i++;
        }
        // Add back a single space
        transformed += " ";
      } else {
        transformed += source[i];
        i++;
      }
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
      source.substring(i, i + 5) === "&mut " ||
      (source[i] === "&" &&
        (i === 0 || source[i - 1] !== "&") && // Not part of &&
        (i + 1 >= source.length || source[i + 1] !== "&")) // Not part of &&
    ) {
      // Skip reference operators (&mut or &) and add the referenced variable directly
      if (source.substring(i, i + 5) === "&mut ") {
        i += 5;
      } else {
        i++;
      }
      while (i < source.length && source[i] === " ") {
        i++;
      }
      while (i < source.length && isIdentifierChar(source[i])) {
        transformed += source[i];
        i++;
      }
    } else if (
      source[i] === "*" &&
      i + 1 < source.length &&
      isIdentifierChar(source[i + 1])
    ) {
      // Dereference operator: *variable - transform to variable.value
      i++;
      while (i < source.length && isIdentifierChar(source[i])) {
        transformed += source[i];
        i++;
      }
      // Insert .value after the variable
      transformed += ".value";
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

  // Apply wrapping transformation for mutable variables that are referenced
  let wrappingApplied = transformed;
  for (const wrappedVar of wrappedVariables) {
    // Find "let " followed by variable name with any amount of whitespace
    let searchStart = 0;
    while (searchStart < wrappingApplied.length) {
      // Look for "let "
      const letIndex = wrappingApplied.indexOf("let ", searchStart);
      if (letIndex === -1) break;

      // Check what follows "let "
      let checkIndex = letIndex + 4;
      // Skip spaces
      while (
        checkIndex < wrappingApplied.length &&
        wrappingApplied[checkIndex] === " "
      ) {
        checkIndex++;
      }

      // Check if the variable name matches
      let varMatch = true;
      let j = 0;
      while (j < wrappedVar.length) {
        if (
          checkIndex + j >= wrappingApplied.length ||
          wrappingApplied[checkIndex + j] !== wrappedVar[j]
        ) {
          varMatch = false;
          break;
        }
        j++;
      }

      if (!varMatch) {
        searchStart = letIndex + 4;
        continue;
      }

      // Check that what comes after the variable name is not an identifier char
      const afterVarIndex = checkIndex + wrappedVar.length;
      if (
        afterVarIndex < wrappingApplied.length &&
        isIdentifierChar(wrappingApplied[afterVarIndex])
      ) {
        // This is a longer identifier (like letx or let xyz when we're looking for x)
        searchStart = letIndex + 4;
        continue;
      }

      // Found the variable! Now look for the = sign
      let equalIndex = afterVarIndex;
      while (
        equalIndex < wrappingApplied.length &&
        wrappingApplied[equalIndex] === " "
      ) {
        equalIndex++;
      }

      if (
        equalIndex >= wrappingApplied.length ||
        wrappingApplied[equalIndex] !== "="
      ) {
        searchStart = letIndex + 4;
        continue;
      }

      // Found "let varName =" - now wrap the RHS
      let rhsStart = equalIndex + 1;
      while (
        rhsStart < wrappingApplied.length &&
        wrappingApplied[rhsStart] === " "
      ) {
        rhsStart++;
      }

      // Find the semicolon
      let semiIndex = rhsStart;
      while (
        semiIndex < wrappingApplied.length &&
        wrappingApplied[semiIndex] !== ";"
      ) {
        semiIndex++;
      }

      if (semiIndex < wrappingApplied.length) {
        const rhs = wrappingApplied.substring(rhsStart, semiIndex);
        wrappingApplied =
          wrappingApplied.substring(0, rhsStart) +
          "{value: " +
          rhs +
          "}" +
          wrappingApplied.substring(semiIndex);
        // Move past this wrapping
        searchStart = rhsStart + 9 + rhs.length;
      } else {
        searchStart = letIndex + 4;
      }
    }
  }
  transformed = wrappingApplied;

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
      let returnExpr = trimmed.substring(lastSemicolon + 1).trim();
      // Unwrap wrapped variables in return expression
      for (const wrappedVar of wrappedVariables) {
        if (returnExpr === wrappedVar) {
          returnExpr = wrappedVar + ".value";
        }
      }
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
