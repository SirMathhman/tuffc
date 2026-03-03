export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => {
  return { ok: true, value };
};

export const err = <E>(error: E): Result<never, E> => {
  return { ok: false, error };
};

const isValidTypeStr = (typeStr: string): boolean => {
  // Handle pointer types like *I32 or *U8
  if (typeStr.startsWith("*")) {
    return isValidTypeStr(typeStr.substring(1));
  }
  if (typeStr === "Bool") {
    return true;
  }
  return (
    (typeStr[0] === "U" || typeStr[0] === "I") &&
    typeStr
      .substring(1)
      .split("")
      .every((c: string) => c >= "0" && c <= "9")
  );
};

const extractValueType = (
  valueExpr: string,
  declarationTypes: Record<string, string>,
): string => {
  // Handle dereference operator
  if (valueExpr.startsWith("*")) {
    const innerType = extractValueType(
      valueExpr.substring(1),
      declarationTypes,
    );
    if (innerType.startsWith("*")) {
      return innerType.substring(1);
    }
    return innerType;
  }

  // Handle reference operator
  if (valueExpr.startsWith("&")) {
    const innerType = extractValueType(
      valueExpr.substring(1),
      declarationTypes,
    );
    if (innerType) {
      return "*" + innerType;
    }
    return "";
  }

  let valueType = "";

  // Check for boolean literals
  if (valueExpr === "true" || valueExpr === "false") {
    return "Bool";
  }

  const typeMarkerIdx = Math.max(
    valueExpr.lastIndexOf("U"),
    valueExpr.lastIndexOf("I"),
  );

  if (typeMarkerIdx > 0 && typeMarkerIdx < valueExpr.length - 1) {
    if (
      valueExpr
        .substring(0, typeMarkerIdx)
        .split("")
        .every((c) => c >= "0" && c <= "9") &&
      valueExpr
        .substring(typeMarkerIdx + 1)
        .split("")
        .every((c) => c >= "0" && c <= "9")
    ) {
      valueType = valueExpr.substring(typeMarkerIdx);
    }
  }

  if (!valueType) {
    if (valueExpr.startsWith("read<") && valueExpr.endsWith(">()")) {
      const typeEnd = valueExpr.indexOf(">");
      if (typeEnd > 5) {
        valueType = valueExpr.substring(5, typeEnd);
      }
    }
  }
  if (!valueType && valueExpr in declarationTypes) {
    valueType = declarationTypes[valueExpr];
  }
  return valueType;
};

const validateTypeAssignment = (
  valueType: string,
  declaredType: string,
): Result<undefined, string> => {
  if (!valueType) {
    return ok(undefined);
  }

  // Handle Bool types
  if (valueType === "Bool" || declaredType === "Bool") {
    return valueType === declaredType
      ? ok(undefined)
      : err(`Cannot assign ${valueType} to ${declaredType}`);
  }

  // Handle pointer types
  const isValuePointer = valueType.startsWith("*");
  const isDeclaredPointer = declaredType.startsWith("*");

  if (isValuePointer !== isDeclaredPointer) {
    return err(`Cannot assign ${valueType} to ${declaredType}`);
  }

  // Remove pointer markers for comparison
  const innerValueType = isValuePointer ? valueType.substring(1) : valueType;
  const innerDeclaredType = isDeclaredPointer
    ? declaredType.substring(1)
    : declaredType;

  if (
    innerValueType &&
    !(
      innerDeclaredType[0] === innerValueType[0] &&
      parseInt(innerValueType.substring(1), 10) <=
        parseInt(innerDeclaredType.substring(1), 10)
    )
  ) {
    return err(`Cannot assign ${valueType} to ${declaredType}`);
  }
  return ok(undefined);
};

export const compile = (source: string): Result<string, string> => {
  const replaceReadCalls = (expr: string): Result<string, string> => {
    let result = expr;
    while (result.includes("read<")) {
      const start = result.indexOf("read<");
      const typeEnd = result.indexOf(">", start + 5);
      const parenStart = result.indexOf("(", typeEnd);

      if (
        typeEnd === -1 ||
        parenStart === -1 ||
        result[parenStart + 1] !== ")"
      ) {
        return err("Invalid read syntax in expression");
      }

      if (!isValidTypeStr(result.substring(start + 5, typeEnd))) {
        return err("Invalid type in read<> expression");
      }

      result =
        result.substring(0, start) +
        "read()" +
        result.substring(parenStart + 2);
    }
    return ok(result);
  };

  // Empty input returns 0
  if (source === "") {
    return ok("return 0");
  }

  // Variable declarations (let x : Type = expr; or let x = expr; or let mut x = expr;)
  if (source.includes("let ")) {
    const declarations: Record<string, string> = {};
    const declarationTypes: Record<string, string> = {};
    const mutableVars: Set<string> = new Set();
    const statements: string[] = [];
    let returnExpr = "";

    const compilePointerExpr = (expr: string): Result<string, string> => {
      // Handle dereference operator *x
      if (expr.startsWith("*")) {
        const innerExpr = expr.substring(1).trim();
        if (innerExpr in declarations) {
          // Check if the variable is a pointer type
          const varType = declarationTypes[innerExpr];
          if (varType && !varType.startsWith("*")) {
            return err(`Cannot dereference non-pointer type '${varType}'`);
          }
          return ok(`${innerExpr}.value`);
        }
        // Try to recursively dereference
        const innerResult = compilePointerExpr(innerExpr);
        if (innerResult.ok) {
          return ok(`${innerResult.value}.value`);
        }
        return err(`Cannot dereference '${innerExpr}'`);
      }

      // Handle reference operator &x
      if (expr.startsWith("&")) {
        const innerExpr = expr.substring(1).trim();
        if (innerExpr in declarations) {
          return ok(`{ value: ${innerExpr} }`);
        }
        return err(`Variable '${innerExpr}' is not declared`);
      }

      return err("Not a pointer expression");
    };

    const extractCompiledValue = (
      expr: string,
      isAssignmentContext: boolean,
    ): Result<string, string> => {
      // Try pointer expressions first
      const pointerResult = compilePointerExpr(expr);
      if (pointerResult.ok) {
        return ok(pointerResult.value);
      }

      if (expr in declarations) {
        return ok(expr);
      }

      const compileResult = compile(expr);
      if (!compileResult.ok) {
        return compileResult;
      }

      const returnValue = compileResult.value;
      if (!returnValue.startsWith("return ")) {
        return err(
          isAssignmentContext
            ? "Invalid variable assignment"
            : "Invalid variable initialization",
        );
      }

      return ok(
        returnValue.substring(7).endsWith(";")
          ? returnValue.substring(7, returnValue.length - 1)
          : returnValue.substring(7),
      );
    };

    const stmtResult = source
      .split(";")
      .map((s) => s.trim())
      .reduce(
        (acc, stmt) => {
          if (acc.ok === false) {
            return acc;
          }

          if (stmt.startsWith("let ")) {
            const isMutable = stmt.substring(4, 8) === "mut ";
            const afterLet = stmt.substring(isMutable ? 8 : 4);
            const colonIdx = afterLet.indexOf(":");
            const equalIdx = afterLet.indexOf("=");

            if (equalIdx === -1) {
              return err("Invalid variable declaration: missing initializer");
            }

            const isTyped = colonIdx !== -1 && colonIdx < equalIdx;
            const declaredType = isTyped
              ? afterLet.substring(colonIdx + 1, equalIdx).trim()
              : "";
            const valueExpr = afterLet
              .substring(
                isTyped ? afterLet.indexOf("=", colonIdx) + 1 : equalIdx + 1,
              )
              .trim();

            const compiledValueResult = extractCompiledValue(valueExpr, false);
            if (!compiledValueResult.ok) {
              return compiledValueResult;
            }
            const compiledValue = compiledValueResult.value;

            if (isTyped && declaredType) {
              if (!isValidTypeStr(declaredType)) {
                return err(`Invalid type: ${declaredType}`);
              }

              const validationResult = validateTypeAssignment(
                extractValueType(valueExpr, declarationTypes),
                declaredType,
              );
              if (!validationResult.ok) {
                return validationResult;
              }
            }

            const varName = afterLet
              .substring(0, isTyped ? colonIdx : equalIdx)
              .trim();
            if (varName in declarations) {
              return err(`Variable '${varName}' is already declared`);
            }

            declarations[varName] = compiledValue;
            if (isMutable) {
              mutableVars.add(varName);
            }
            statements.push(
              `${mutableVars.has(varName) ? "var" : "const"} ${varName} = ${compiledValue};`,
            );

            if (isTyped && declaredType) {
              declarationTypes[varName] = declaredType;
            } else if (valueExpr === "true" || valueExpr === "false") {
              // Infer Bool type for boolean literals
              declarationTypes[varName] = "Bool";
            } else if (valueExpr.startsWith("&")) {
              // Handle reference operator: infer pointer type
              const refVarName = valueExpr.substring(1).trim();
              if (refVarName in declarationTypes) {
                declarationTypes[varName] = "*" + declarationTypes[refVarName];
              }
            } else if (valueExpr in declarationTypes) {
              declarationTypes[varName] = declarationTypes[valueExpr];
            } else if (
              valueExpr.startsWith("read<") &&
              valueExpr.endsWith(">()")
            ) {
              const typeEnd = valueExpr.indexOf(">");
              if (typeEnd > 5)
                declarationTypes[varName] = valueExpr.substring(5, typeEnd);
            } else {
              const tIdx = Math.max(
                valueExpr.lastIndexOf("U"),
                valueExpr.lastIndexOf("I"),
              );
              if (
                tIdx > 0 &&
                valueExpr
                  .substring(0, tIdx)
                  .split("")
                  .every((c) => c >= "0" && c <= "9") &&
                valueExpr
                  .substring(tIdx + 1)
                  .split("")
                  .every((c) => c >= "0" && c <= "9")
              ) {
                declarationTypes[varName] = valueExpr.substring(tIdx);
              }
            }

            return ok(undefined);
          } else if (stmt.includes("=")) {
            // Handle assignment statements
            const equalIdx = stmt.indexOf("=");
            const varName = stmt.substring(0, equalIdx).trim();

            if (!(varName in declarations)) {
              return err(`Variable '${varName}' is not declared`);
            }
            if (!mutableVars.has(varName)) {
              return err(`Variable '${varName}' is not mutable`);
            }

            const valueExpr = stmt.substring(equalIdx + 1).trim();
            const compiledValueResult = extractCompiledValue(valueExpr, true);
            if (!compiledValueResult.ok) {
              return compiledValueResult;
            }
            const compiledValue = compiledValueResult.value;

            // Type check the assignment
            if (varName in declarationTypes) {
              const validationResult = validateTypeAssignment(
                extractValueType(valueExpr, declarationTypes),
                declarationTypes[varName],
              );
              if (!validationResult.ok) {
                return validationResult;
              }
            }

            declarations[varName] = compiledValue;
            statements.push(`${varName} = ${compiledValue};`);

            return ok(undefined);
          } else if (stmt.length > 0) {
            // Try to compile as return expression
            const pointerResult = compilePointerExpr(stmt);
            if (pointerResult.ok) {
              returnExpr = pointerResult.value;
            } else if (
              !pointerResult.error.includes("Not a pointer expression")
            ) {
              // It's a pointer expression but has an error (type checking, etc.)
              return pointerResult;
            } else {
              // Check if this is a binary operation with boolean operands
              if (
                stmt.includes("+") ||
                stmt.includes("-") ||
                stmt.includes("*") ||
                stmt.includes("/")
              ) {
                // Split by binary operators to extract operands
                const opIndex = Math.max(
                  stmt.indexOf("+"),
                  stmt.indexOf("-"),
                  stmt.indexOf("*"),
                  stmt.indexOf("/"),
                );
                if (opIndex !== -1) {
                  const leftOperand = stmt.substring(0, opIndex).trim();
                  const rightOperand = stmt.substring(opIndex + 1).trim();

                  if (
                    (leftOperand in declarationTypes &&
                      declarationTypes[leftOperand] === "Bool") ||
                    (rightOperand in declarationTypes &&
                      declarationTypes[rightOperand] === "Bool")
                  ) {
                    return err(
                      "Binary operations are not allowed on boolean types",
                    );
                  }
                }
              }
              returnExpr = stmt;
            }

            return ok(undefined);
          }

          return ok(undefined);
        },
        ok(undefined) as Result<undefined, string>,
      );

    if (!stmtResult.ok) {
      return stmtResult;
    }

    // Validate return expression for boolean operations
    if (!returnExpr) {
      returnExpr = "0";
    } else {
      // Check for arithmetic operations with boolean operands (disallow)
      // But allow logical operations (|| and &&)
      const isLogicalOp =
        returnExpr.includes("||") || returnExpr.includes("&&");
      const isArithmeticOp =
        returnExpr.includes("+") ||
        returnExpr.includes("-") ||
        returnExpr.includes("*") ||
        returnExpr.includes("/");

      if (isArithmeticOp && !isLogicalOp) {
        const opChars = ["+", "-", "*", "/"];
        const opIndex = [...returnExpr].findIndex((c) => opChars.includes(c));
        if (opIndex !== -1) {
          const leftOp = returnExpr.substring(0, opIndex).trim();
          const rightOp = returnExpr.substring(opIndex + 1).trim();
          if (
            (leftOp in declarationTypes &&
              declarationTypes[leftOp] === "Bool") ||
            (rightOp in declarationTypes &&
              declarationTypes[rightOp] === "Bool")
          ) {
            return err("Binary operations are not allowed on boolean types");
          }
        }
      }

      // Handle logical operations on booleans
      const hasLogicalOp =
        returnExpr.includes("||") || returnExpr.includes("&&");
      if (hasLogicalOp) {
        returnExpr = `${returnExpr} ? 1 : 0`;
      }
    }

    return ok(statements.join("\n") + "\nreturn " + returnExpr + ";");
  }

  // Logical expressions with operators (|| and &&)
  if (source.includes("||") || source.includes("&&")) {
    const readReplaced = replaceReadCalls(source);
    if (!readReplaced.ok) {
      return readReplaced;
    }

    // Convert boolean result to 0 or 1
    return ok(`return ${readReplaced.value} ? 1 : 0;`);
  }

  // Binary expressions with operators
  if (
    source.includes("+") ||
    source.includes("-") ||
    source.includes("*") ||
    source.includes("/")
  ) {
    const readReplaced = replaceReadCalls(source);
    if (!readReplaced.ok) {
      return readReplaced;
    }

    let result = readReplaced.value;

    // Validate the resulting expression contains only valid characters
    const validChars = "0123456789+-*/ ()read";
    const invalidCharIndex = [...result].findIndex(
      (c) => !validChars.includes(c),
    );
    if (invalidCharIndex !== -1) {
      return err("Invalid character in expression");
    }

    return ok(`return ${result};`);
  }

  // read<Type>() - read from stdin
  if (source.startsWith("read<") && source.endsWith(">()")) {
    const typeEnd = source.indexOf(">");
    if (typeEnd > 5) {
      if (isValidTypeStr(source.substring(5, typeEnd))) {
        return ok("return read();");
      }
    }
    return err("Invalid read syntax");
  }

  // Boolean literals (true/false)
  if (source === "true") {
    return ok("return 1");
  }
  if (source === "false") {
    return ok("return 0");
  }

  // Numeric literals with optional type suffixes (e.g., 100U8, 100I32)
  // Must start with a digit
  if (source.length > 0 && source[0] >= "0" && source[0] <= "9") {
    let i = 0;
    while (i < source.length && source[i] >= "0" && source[i] <= "9") {
      i++;
    }
    const numValue = source.substring(0, i);
    const typeSuffix = source.substring(i);

    if (
      !(
        typeSuffix.length === 0 ||
        (typeSuffix.length >= 2 &&
          typeSuffix.length <= 3 &&
          (typeSuffix[0] === "U" || typeSuffix[0] === "I") &&
          typeSuffix
            .split("")
            .slice(1)
            .every((c) => c >= "0" && c <= "9"))
      )
    ) {
      return err("Not implemented yet");
    }

    // Validate value fits in type
    if (typeSuffix.length > 0) {
      const typeChar = typeSuffix[0];
      const bitWidth = parseInt(typeSuffix.substring(1), 10);
      if (
        BigInt(numValue) >
        (BigInt(1) << BigInt(typeChar === "U" ? bitWidth : bitWidth - 1)) -
          BigInt(1)
      ) {
        return err(
          `Value ${numValue} exceeds maximum for ${typeChar}${bitWidth}`,
        );
      }
    }

    return ok(`return ${numValue}`);
  }

  // Invalid input returns error
  if (
    source.length > 0 &&
    ((source[0] >= "a" && source[0] <= "z") ||
      (source[0] >= "A" && source[0] <= "Z") ||
      source[0] === "_")
  ) {
    return err("Invalid input");
  }

  return err("Not implemented yet");
};
