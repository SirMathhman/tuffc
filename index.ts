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

const parseIfElse = (
  expr: string,
):
  | {
      condition: string;
      consequent: string;
      alternate: string;
    }
  | undefined => {
  if (!expr.startsWith("if (")) {
    return undefined;
  }

  let depthCounter = 0;
  let conditionEndIdx = -1;

  [...expr].reduce((idx: number, char: string) => {
    if (idx < 4 || conditionEndIdx !== -1) {
      return idx + 1;
    }

    if (char === "(") depthCounter++;
    if (char === ")") {
      if (depthCounter === 0) {
        conditionEndIdx = idx;
      } else {
        depthCounter--;
      }
    }
    return idx + 1;
  }, 0);

  if (conditionEndIdx === -1) {
    return undefined;
  }

  const condition = expr.substring(4, conditionEndIdx).trim();
  const remaining = expr.substring(conditionEndIdx + 1).trim();

  const elseIdx = remaining.lastIndexOf(" else ");
  if (elseIdx === -1) {
    return undefined;
  }

  const consequent = remaining.substring(0, elseIdx).trim();
  const alternate = remaining.substring(elseIdx + 6).trim();

  return { condition, consequent, alternate };
};

const extractValueType = (
  valueExpr: string,
  declarationTypes: Record<string, string>,
): string => {
  // Handle block expressions first
  if (valueExpr.startsWith("{") && valueExpr.endsWith("}")) {
    const blockContent = valueExpr.substring(1, valueExpr.length - 1).trim();
    if (blockContent.length === 0) {
      return "";
    }
    // Parse the block content to extract types
    const blockDeclarationTypes: Record<string, string> = {};
    const blockStatements = splitStatements(blockContent);
    let lastStatement = "";

    blockStatements.forEach((stmt, idx) => {
      if (stmt.startsWith("let ")) {
        const parsed = parseLetStatement(stmt);
        if (parsed.isTyped) {
          blockDeclarationTypes[parsed.varName] = parsed.declaredType;
        } else {
          // Infer type from value expr
          const inferredType = extractValueType(
            parsed.valueExpr,
            blockDeclarationTypes,
          );
          if (inferredType) {
            blockDeclarationTypes[parsed.varName] = inferredType;
          }
        }
      }
      if (idx === blockStatements.length - 1) {
        lastStatement = stmt;
      }
    });

    // The last statement should determine the return type
    if (!lastStatement.startsWith("let ")) {
      // It's a plain expression
      return extractValueType(lastStatement, blockDeclarationTypes);
    }

    // If it's a let statement, extract the type of its value
    const parsed = parseLetStatement(lastStatement);
    if (parsed.isTyped) {
      return parsed.declaredType;
    }
    const inferredType = extractValueType(
      parsed.valueExpr,
      blockDeclarationTypes,
    );
    return inferredType;
  }

  // Handle if/else expressions
  const ifElseParts = parseIfElse(valueExpr);
  if (ifElseParts) {
    const consequentType = extractValueType(
      ifElseParts.consequent,
      declarationTypes,
    );
    const alternateType = extractValueType(
      ifElseParts.alternate,
      declarationTypes,
    );

    // Return the type if they match, otherwise return empty string
    if (consequentType === alternateType) {
      return alternateType;
    }
    return "";
  }

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

  // Check for plain numeric literals (just digits)
  const isPlainNumber =
    valueExpr.length > 0 && [...valueExpr].every((c) => c >= "0" && c <= "9");
  if (isPlainNumber) {
    return "I32"; // Default to I32 for plain numbers
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

const splitStatements = (source: string): string[] => {
  const statements: string[] = [];
  let currentStatement = "";
  let braceDepth = 0;
  const chars = [...source];

  chars.forEach((char, idx) => {
    if (char === "{") {
      braceDepth++;
      currentStatement += char;
    } else if (char === "}") {
      braceDepth--;
      currentStatement += char;
      // If we just closed a brace at depth 0 and there's non-whitespace after it,
      // treat this as a statement boundary
      if (braceDepth === 0) {
        const restOfSource = source.substring(idx + 1).trim();
        if (restOfSource.length > 0 && !restOfSource.startsWith(";")) {
          // There's something after the block that's not a semicolon
          if (currentStatement.trim().length > 0) {
            statements.push(currentStatement.trim());
          }
          currentStatement = "";
        }
      }
    } else if (char === ";" && braceDepth === 0) {
      if (currentStatement.trim().length > 0) {
        statements.push(currentStatement.trim());
      }
      currentStatement = "";
    } else {
      currentStatement += char;
    }
  });

  if (currentStatement.trim().length > 0) {
    statements.push(currentStatement.trim());
  }

  return statements;
};

const parseLetStatement = (
  stmt: string,
): {
  isMutable: boolean;
  varName: string;
  declaredType: string;
  valueExpr: string;
  isTyped: boolean;
} => {
  const isMutable = stmt.substring(4, 8) === "mut ";
  const afterLet = stmt.substring(isMutable ? 8 : 4);
  const colonIdx = afterLet.indexOf(":");
  const equalIdx = afterLet.indexOf("=");

  const isTyped = colonIdx !== -1 && colonIdx < equalIdx;
  const declaredType = isTyped
    ? afterLet.substring(colonIdx + 1, equalIdx).trim()
    : "";
  const varName = afterLet.substring(0, isTyped ? colonIdx : equalIdx).trim();
  const valueExpr = afterLet
    .substring(isTyped ? afterLet.indexOf("=", colonIdx) + 1 : equalIdx + 1)
    .trim();

  return { isMutable, varName, declaredType, valueExpr, isTyped };
};

export const compile = (
  source: string,
  requiresFinalExpression = false,
): Result<string, string> => {
  const processBlockExpression = (
    blockExpr: string,
    requiresFinalExpr = true,
  ): Result<{ statements: string; returnValue: string }, string> => {
    if (!blockExpr.startsWith("{") || !blockExpr.endsWith("}")) {
      return err("Not a block expression");
    }

    const blockContent = blockExpr.substring(1, blockExpr.length - 1).trim();
    if (blockContent.length === 0) {
      return ok({ statements: "", returnValue: "0" });
    }

    const blockResult = compile(blockContent, requiresFinalExpr);
    if (!blockResult.ok) {
      return blockResult;
    }

    const compiledCode = blockResult.value;
    const returnIdx = compiledCode.lastIndexOf("return ");
    if (returnIdx === -1) {
      return err("Invalid block expression");
    }

    const blockStatements = compiledCode.substring(0, returnIdx).trim();
    let returnValue = compiledCode.substring(returnIdx + 7).trim();
    if (returnValue.endsWith(";")) {
      returnValue = returnValue.substring(0, returnValue.length - 1).trim();
    }

    return ok({ statements: blockStatements, returnValue });
  };

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

  const extractOperandTypes = (
    leftOp: string,
    rightOp: string,
    declarationTypes: Record<string, string>,
  ): {
    leftType: string;
    rightType: string;
  } => {
    const leftType =
      leftOp in declarationTypes
        ? declarationTypes[leftOp]
        : extractValueType(leftOp, declarationTypes);
    const rightType =
      rightOp in declarationTypes
        ? declarationTypes[rightOp]
        : extractValueType(rightOp, declarationTypes);
    return { leftType, rightType };
  };

  const compileIfElse = (
    expr: string,
    declarationTypes?: Record<string, string>,
  ): Result<string, string> => {
    const ifElseParts = parseIfElse(expr);

    if (!ifElseParts) {
      return err("Invalid if/else expression");
    }

    const { condition, consequent, alternate } = ifElseParts;

    // Validate that the condition is a boolean type
    if (declarationTypes) {
      // Only allow boolean literals or boolean variables
      const isBoolLiteral = condition === "true" || condition === "false";
      const isBoolVar =
        condition in declarationTypes && declarationTypes[condition] === "Bool";

      if (!isBoolLiteral && !isBoolVar) {
        return err("If/else condition must be of type Bool");
      }
    } else {
      // Without declaration types, only allow boolean literals
      if (condition !== "true" && condition !== "false") {
        return err("If/else condition must be of type Bool");
      }
    }

    // Validate that consequent and alternate have the same type
    const consequentType = declarationTypes
      ? extractValueType(consequent, declarationTypes)
      : extractValueType(consequent, {});
    const alternateType = declarationTypes
      ? extractValueType(alternate, declarationTypes)
      : extractValueType(alternate, {});

    if (consequentType !== alternateType) {
      return err(
        `If/else branches have mismatched types: ${consequentType} vs ${alternateType}`,
      );
    }

    return ok(`(${condition}) ? (${consequent}) : (${alternate})`);
  };

  // Empty input returns 0
  if (source === "") {
    return ok("return 0");
  }

  // Multi-statement handler - triggered for complex inputs with multiple statements or declarations
  // This includes: variable declarations (let), semicolon-separated statements, or expressions after block closures
  const hasMultipleStatements =
    source.includes("let ") ||
    source.includes(";") ||
    (source.includes("}") &&
      source.lastIndexOf("}") < source.length - 1 &&
      source.substring(source.lastIndexOf("}") + 1).trim().length > 0);

  if (hasMultipleStatements) {
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
      // Handle block expressions: { ... }
      const blockResult = processBlockExpression(expr);
      if (blockResult.ok) {
        return ok(blockResult.value.returnValue);
      }

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

    const stmtResult = splitStatements(source).reduce(
      (acc, stmt) => {
        if (acc.ok === false) {
          return acc;
        }

        // Helper to extract variable name from an assignment statement
        const extractVariableNameFromAssignment = (
          assignStmt: string,
        ): string => {
          const equalIdx = assignStmt.indexOf("=");
          return assignStmt.substring(0, equalIdx).trim();
        };

        // Helper to handle variable assignments (used both for regular and block assignments)
        const handleAssignment = (
          assignStmt: string,
        ): Result<undefined, string> => {
          const varName = extractVariableNameFromAssignment(assignStmt);

          // Validate variable is declared
          if (!(varName in declarations)) {
            return err(`Variable '${varName}' is not declared`);
          }

          if (!mutableVars.has(varName)) {
            return err(`Variable '${varName}' is not mutable`);
          }

          const equalIdx = assignStmt.indexOf("=");
          const valueExpr = assignStmt.substring(equalIdx + 1).trim();
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
        };

        if (stmt.startsWith("let ")) {
          const parsed = parseLetStatement(stmt);

          if (!parsed.valueExpr) {
            return err("Invalid variable declaration: missing initializer");
          }

          if (parsed.varName in declarations) {
            return err(`Variable '${parsed.varName}' is already declared`);
          }

          let compiledValue: string;
          // Handle block expressions specially to preserve their statements
          const blockResult = processBlockExpression(parsed.valueExpr);
          if (blockResult.ok) {
            const { statements: blockStatements, returnValue } =
              blockResult.value;
            if (blockStatements.length > 0) {
              statements.push(blockStatements);
            }
            compiledValue = returnValue;
          } else {
            const compiledValueResult = extractCompiledValue(
              parsed.valueExpr,
              false,
            );
            if (!compiledValueResult.ok) {
              return compiledValueResult;
            }
            compiledValue = compiledValueResult.value;
          }

          if (parsed.isTyped && parsed.declaredType) {
            if (!isValidTypeStr(parsed.declaredType)) {
              return err(`Invalid type: ${parsed.declaredType}`);
            }

            const validationResult = validateTypeAssignment(
              extractValueType(parsed.valueExpr, declarationTypes),
              parsed.declaredType,
            );
            if (!validationResult.ok) {
              return validationResult;
            }
          }

          declarations[parsed.varName] = compiledValue;
          if (parsed.isMutable) {
            mutableVars.add(parsed.varName);
          }
          statements.push(
            `${parsed.isMutable ? "var" : "const"} ${parsed.varName} = ${compiledValue};`,
          );

          if (parsed.isTyped && parsed.declaredType) {
            declarationTypes[parsed.varName] = parsed.declaredType;
          } else if (
            parsed.valueExpr === "true" ||
            parsed.valueExpr === "false"
          ) {
            // Infer Bool type for boolean literals
            declarationTypes[parsed.varName] = "Bool";
          } else if (parsed.valueExpr.startsWith("&")) {
            // Handle reference operator: infer pointer type
            const refVarName = parsed.valueExpr.substring(1).trim();
            if (refVarName in declarationTypes) {
              declarationTypes[parsed.varName] =
                "*" + declarationTypes[refVarName];
            }
          } else if (parsed.valueExpr in declarationTypes) {
            declarationTypes[parsed.varName] =
              declarationTypes[parsed.valueExpr];
          } else if (
            parsed.valueExpr.startsWith("read<") &&
            parsed.valueExpr.endsWith(">()")
          ) {
            const typeEnd = parsed.valueExpr.indexOf(">");
            if (typeEnd > 5)
              declarationTypes[parsed.varName] = parsed.valueExpr.substring(
                5,
                typeEnd,
              );
          } else {
            const tIdx = Math.max(
              parsed.valueExpr.lastIndexOf("U"),
              parsed.valueExpr.lastIndexOf("I"),
            );
            if (
              tIdx > 0 &&
              parsed.valueExpr
                .substring(0, tIdx)
                .split("")
                .every((c) => c >= "0" && c <= "9") &&
              parsed.valueExpr
                .substring(tIdx + 1)
                .split("")
                .every((c) => c >= "0" && c <= "9")
            ) {
              declarationTypes[parsed.varName] =
                parsed.valueExpr.substring(tIdx);
            }
          }

          return ok(undefined);
        } else if (stmt.startsWith("{") && stmt.endsWith("}")) {
          // Handle block statements as standalone statements with proper scoping
          const blockContent = stmt.substring(1, stmt.length - 1).trim();
          if (blockContent.length > 0) {
            // Track which variables existed before the block (for scope isolation)
            const outerDeclarations = new Set(Object.keys(declarations));

            // Split statements within the block
            const blockStmts = splitStatements(blockContent);
            // Process each statement in the block
            const blockProcessResult = blockStmts.reduce(
              (blockAcc, blockStmt) => {
                if (blockAcc.ok === false) {
                  return blockAcc;
                }

                // Handle let statements within the block (block-scoped)
                if (blockStmt.startsWith("let ")) {
                  const parsed = parseLetStatement(blockStmt);
                  if (!parsed.valueExpr) {
                    return err(
                      "Invalid variable declaration: missing initializer",
                    );
                  }

                  // Block-scoped variables
                  const compiledValueResult = extractCompiledValue(
                    parsed.valueExpr,
                    false,
                  );
                  if (!compiledValueResult.ok) {
                    return compiledValueResult;
                  }

                  // Add to declarations for use within this block
                  declarations[parsed.varName] = compiledValueResult.value;
                  // Add to block statements
                  statements.push(
                    `${parsed.isMutable ? "var" : "const"} ${parsed.varName} = ${compiledValueResult.value};`,
                  );

                  if (parsed.isTyped && parsed.declaredType) {
                    declarationTypes[parsed.varName] = parsed.declaredType;
                  }

                  return ok(undefined);
                } else if (blockStmt.includes("=")) {
                  // Handle assignments within the block - only allow modifying outer-scope variables
                  const varName = extractVariableNameFromAssignment(blockStmt);

                  // Check if this variable is from outer scope only
                  if (!outerDeclarations.has(varName)) {
                    return err(
                      `Variable '${varName}' is not available in this scope`,
                    );
                  }

                  return handleAssignment(blockStmt);
                }

                return ok(undefined);
              },
              ok(undefined) as Result<undefined, string>,
            );

            if (!blockProcessResult.ok) {
              return blockProcessResult;
            }

            // Remove block-scoped variables from declarations
            // by restoring to pre-block state (only keep outer declarations)
            Object.keys(declarations).forEach((varName) => {
              if (!outerDeclarations.has(varName)) {
                delete declarations[varName];
                delete declarationTypes[varName];
              }
            });
          }

          return ok(undefined);
        } else if (stmt.includes("=")) {
          // Handle assignment statements
          return handleAssignment(stmt);
        } else if (stmt.startsWith("read<") && stmt.endsWith(">()")) {
          // Handle read<Type>() as return expression
          const typeEnd = stmt.indexOf(">");
          if (typeEnd > 5 && isValidTypeStr(stmt.substring(5, typeEnd))) {
            returnExpr = stmt;
            return ok(undefined);
          } else {
            return err("Invalid read syntax");
          }
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
    // First, replace any read<Type>() calls BEFORE checking for operators
    // This prevents read<I32>() from being misidentified as a comparison due to < and >
    if (!returnExpr) {
      if (requiresFinalExpression) {
        return err("Block expression must have a final expression");
      }
      returnExpr = "0";
    } else {
      // Replace read<Type>() calls early to avoid operator misdetection
      const earlyReadReplaced = replaceReadCalls(returnExpr);
      if (!earlyReadReplaced.ok) {
        return earlyReadReplaced;
      }
      returnExpr = earlyReadReplaced.value;

      // Handle if/else expressions
      if (returnExpr.startsWith("if (")) {
        const ifElseCompiled = compileIfElse(returnExpr, declarationTypes);
        if (ifElseCompiled.ok) {
          returnExpr = ifElseCompiled.value;
        } else {
          return ifElseCompiled;
        }
      }

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
        // Validate that logical operations only work on booleans
        const logicalOpIndex = Math.max(
          returnExpr.indexOf("||"),
          returnExpr.indexOf("&&"),
        );
        if (logicalOpIndex !== -1) {
          const leftOp = returnExpr.substring(0, logicalOpIndex).trim();
          const rightOp = returnExpr
            .substring(
              logicalOpIndex + (returnExpr[logicalOpIndex] === "&" ? 2 : 2),
            )
            .trim();

          const { leftType, rightType } = extractOperandTypes(
            leftOp,
            rightOp,
            declarationTypes,
          );

          if (leftType !== "Bool" || rightType !== "Bool") {
            return err(
              "Logical operations (|| and &&) can only be used with boolean types",
            );
          }
        }
        returnExpr = `${returnExpr} ? 1 : 0`;
      }

      // Handle comparison operators (<, >, <=, >=, ==, !=)
      const comparisonOps = ["<=", ">=", "==", "!=", "<", ">"];
      const hasComparison = comparisonOps.some((op) => returnExpr.includes(op));

      if (hasComparison) {
        // Find which comparison operator is in the expression
        let compOp = "";
        let opIndex = -1;
        for (const op of comparisonOps) {
          const idx = returnExpr.indexOf(op);
          if (idx !== -1 && (opIndex === -1 || idx < opIndex)) {
            opIndex = idx;
            compOp = op;
          }
        }

        if (opIndex !== -1) {
          const leftOp = returnExpr.substring(0, opIndex).trim();
          const rightOp = returnExpr.substring(opIndex + compOp.length).trim();

          const { leftType, rightType } = extractOperandTypes(
            leftOp,
            rightOp,
            declarationTypes,
          );

          if (leftType === "Bool" || rightType === "Bool") {
            return err(
              "Comparison operators cannot be used with boolean types",
            );
          }
        }

        returnExpr = `${returnExpr} ? 1 : 0`;
      }
    }

    return ok(statements.join("\n") + "\nreturn " + returnExpr + ";");
  }

  // If/else expressions: if (condition) consequent else alternate
  if (source.startsWith("if (")) {
    const ifElseCompiled = compileIfElse(source);
    if (ifElseCompiled.ok) {
      // Recursively compile the ternary expression
      return compile(ifElseCompiled.value);
    } else {
      return ifElseCompiled;
    }
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

  // Ternary expressions (condition ? consequent : alternate)
  if (source.includes("?") && source.includes(":")) {
    const questionIdx = source.indexOf("?");
    const colonIdx = source.indexOf(":", questionIdx);

    if (questionIdx > 0 && colonIdx > questionIdx) {
      const readReplaced = replaceReadCalls(source);
      if (!readReplaced.ok) {
        return readReplaced;
      }

      // Validate basic structure - allow alphanumeric, operators, parentheses, and read()
      const validChars =
        "()? :<>=!+-*/ 0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_read";
      const invalidCharIndex = [...readReplaced.value].findIndex(
        (c) => !validChars.includes(c),
      );
      if (invalidCharIndex !== -1) {
        return err("Invalid character in ternary expression");
      }

      return ok(`return ${readReplaced.value};`);
    }
  }

  // Block expressions: { ... }
  if (source.startsWith("{") && source.endsWith("}")) {
    const blockResult = processBlockExpression(source);
    if (blockResult.ok) {
      const { statements: blockStatements, returnValue } = blockResult.value;
      if (blockStatements.length > 0) {
        return ok(blockStatements + "\nreturn " + returnValue + ";");
      } else {
        return ok("return " + returnValue + ";");
      }
    } else if (!blockResult.error.includes("Not a block expression")) {
      return blockResult;
    }
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
