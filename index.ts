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
  // Handle mutable pointee marker in pointer types like *mut I32
  if (typeStr.startsWith("mut ")) {
    return isValidTypeStr(typeStr.substring(4).trim());
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

const extractConditionFromParens = (
  stmt: string,
  startIdx: number,
): { condition: string; endIdx: number } | undefined => {
  let depthCounter = 0;
  let conditionEndIdx = -1;

  [...stmt].reduce((idx: number, char: string) => {
    if (idx < startIdx || conditionEndIdx !== -1) {
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

  return {
    condition: stmt.substring(startIdx, conditionEndIdx).trim(),
    endIdx: conditionEndIdx,
  };
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

  const result = extractConditionFromParens(expr, 4);
  if (!result) {
    return undefined;
  }

  const condition = result.condition;
  const remaining = expr.substring(result.endIdx + 1).trim();

  // Find the FIRST " else " at the top level (not inside nested if-else)
  // We need to skip past the consequent to find the else clause
  let elseIdx = -1;
  let depth = 0; // Track depth of nested if-else
  let i = 0;

  while (i < remaining.length) {
    // Check if we're at " else "
    if (
      remaining[i] === " " &&
      remaining.substring(i + 1, i + 6) === "else " &&
      depth === 0
    ) {
      elseIdx = i;
      break;
    }

    // Track nesting depth: if we see "if (", we go deeper
    if (remaining.substring(i, i + 3) === "if ") {
      depth++;
    }

    i++;
  }

  if (elseIdx === -1) {
    return undefined;
  }

  const consequent = remaining.substring(0, elseIdx).trim();
  const alternate = remaining.substring(elseIdx + 6).trim();

  return { condition, consequent, alternate };
};

const parseWhile = (
  stmt: string,
):
  | {
      condition: string;
      body: string;
    }
  | undefined => {
  if (!stmt.startsWith("while (")) {
    return undefined;
  }

  const result = extractConditionFromParens(stmt, 7);
  if (!result) {
    return undefined;
  }

  const condition = result.condition;
  const body = stmt.substring(result.endIdx + 1).trim();

  // Body should be a block expression { ... }
  if (!body.startsWith("{") || !body.endsWith("}")) {
    return undefined;
  }

  return { condition, body };
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
    if (innerType.startsWith("*mut ")) {
      return innerType.substring(5);
    }
    if (innerType.startsWith("*")) {
      return innerType.substring(1).trim();
    }
    return innerType;
  }

  // Handle reference operator
  if (valueExpr.startsWith("&mut ")) {
    const innerType = extractValueType(
      valueExpr.substring(5).trim(),
      declarationTypes,
    );
    if (innerType) {
      return "*mut " + innerType;
    }
    return "";
  }
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

  // Handle logical operators - any expression with || or && results in Bool
  if (valueExpr.includes("||") || valueExpr.includes("&&")) {
    return "Bool";
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
  const stripMutabilityPrefix = (typeStr: string): string => {
    const trimmedType = typeStr.trim();
    return trimmedType.startsWith("mut ")
      ? trimmedType.substring(4).trim()
      : trimmedType;
  };

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
  const innerValueType = isValuePointer
    ? stripMutabilityPrefix(valueType.substring(1))
    : valueType;
  const innerDeclaredType = isDeclaredPointer
    ? stripMutabilityPrefix(declaredType.substring(1))
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

    // If the alternate is itself an if-else expression, compile it to a ternary
    let compiledAlternate = alternate;
    if (alternate.trim().startsWith("if (")) {
      const alternateResult = compileIfElse(alternate.trim(), declarationTypes);
      if (!alternateResult.ok) {
        return alternateResult;
      }
      compiledAlternate = alternateResult.value;
    }

    return ok(`(${condition}) ? (${consequent}) : (${compiledAlternate})`);
  };

  // Empty input returns 0
  if (source === "") {
    return ok("return 0");
  }

  // Multi-statement handler - triggered for complex inputs with multiple statements or declarations
  // This includes: variable declarations (let), type aliases (type), function definitions (fn), semicolon-separated statements, or expressions after block closures
  const hasMultipleStatements =
    source.includes("fn ") ||
    source.includes("type ") ||
    source.includes("let ") ||
    source.includes(";") ||
    (source.includes("}") &&
      source.lastIndexOf("}") < source.length - 1 &&
      source.substring(source.lastIndexOf("}") + 1).trim().length > 0);

  if (hasMultipleStatements) {
    const declarations: Record<string, string> = {};
    const declarationTypes: Record<string, string> = {};
    const typeAliases: Record<string, string> = {};
    const definedFunctions: Record<
      string,
      {
        params: Array<{ name: string; type: string }>;
        returnType: string;
        body: string;
      }
    > = {};
    const mutableVars: Set<string> = new Set();
    const statements: string[] = [];
    let returnExpr = "";

    // Helper function to resolve type aliases recursively
    const resolveTypeAlias = (typeStr: string): string => {
      if (typeStr in typeAliases) {
        return resolveTypeAlias(typeAliases[typeStr]);
      }
      return typeStr;
    };

    // Helper function to check if a type is valid, including aliases
    const isValidTypeStrWithAliases = (typeStr: string): boolean => {
      const resolved = resolveTypeAlias(typeStr);
      return isValidTypeStr(resolved);
    };

    const requireDeclaredVariable = (varName: string): Result<true, string> => {
      if (!(varName in declarations)) {
        return err(`Variable '${varName}' is not declared`);
      }
      return ok(true);
    };

    const buildReferenceLiteral = (
      variableName: string,
      isMutableReference: boolean,
    ): string => {
      if (isMutableReference) {
        return `{ get value() { return ${variableName}; }, set value(v) { ${variableName} = v; } }`;
      }
      return `{ get value() { return ${variableName}; } }`;
    };

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

      // Handle mutable reference operator &mut x
      if (expr.startsWith("&mut ")) {
        const innerExpr = expr.substring(5).trim();
        const declaredResult = requireDeclaredVariable(innerExpr);
        if (!declaredResult.ok) {
          return declaredResult;
        }
        if (!mutableVars.has(innerExpr)) {
          return err(
            `Cannot take mutable reference of immutable variable '${innerExpr}'`,
          );
        }
        return ok(buildReferenceLiteral(innerExpr, true));
      }

      // Handle reference operator &x
      if (expr.startsWith("&")) {
        const innerExpr = expr.substring(1).trim();
        const declaredResult = requireDeclaredVariable(innerExpr);
        if (!declaredResult.ok) {
          return declaredResult;
        }
        return ok(buildReferenceLiteral(innerExpr, false));
      }

      return err("Not a pointer expression");
    };

    const compileFunctionCall = (
      expr: string,
    ): Result<string, string> | undefined => {
      // Check if it looks like a function call: name(...)
      const openParenIdx = expr.indexOf("(");
      if (openParenIdx === -1) {
        return undefined;
      }

      const potentialFnName = expr.substring(0, openParenIdx).trim();
      if (!(potentialFnName in definedFunctions)) {
        return undefined;
      }

      // Verify closing paren exists
      if (!expr.endsWith(")")) {
        return err("Invalid function call: missing closing parenthesis");
      }

      const fnDef = definedFunctions[potentialFnName];
      const argsStr = expr.substring(openParenIdx + 1, expr.length - 1).trim();

      // Parse arguments
      const args: string[] = [];
      if (argsStr.length > 0) {
        // Simple split by comma (doesn't handle nested calls perfectly, but good for now)
        args.push(
          ...argsStr
            .split(",")
            .map((arg) => arg.trim())
            .filter((arg) => arg.length > 0),
        );
      }

      // Validate argument count
      if (args.length !== fnDef.params.length) {
        return err(
          `Function '${potentialFnName}' expects ${fnDef.params.length} arguments, got ${args.length}`,
        );
      }

      // Compile arguments
      const compiledArgs: string[] = [];
      for (const arg of args) {
        const compiledArgRes = extractCompiledValue(arg, true);
        if (!compiledArgRes.ok) {
          return compiledArgRes;
        }
        compiledArgs.push(compiledArgRes.value);
      }

      // Create bindings for function parameters
      const paramBindings: Record<string, string> = fnDef.params.reduce(
        (bindings, param, idx) => {
          bindings[param.name] = compiledArgs[idx];
          return bindings;
        },
        {} as Record<string, string>,
      );

      // Extract return statement from function body
      const bodyContent = fnDef.body.substring(1, fnDef.body.length - 1).trim();

      // Parse return statement
      if (!bodyContent.startsWith("return ")) {
        return err(
          `Function '${potentialFnName}' body must contain a return statement`,
        );
      }

      const returnExprStr = bodyContent.substring(7).endsWith(";")
        ? bodyContent.substring(7, bodyContent.length - 1).trim()
        : bodyContent.substring(7).trim();

      // Replace parameter references with compiled values
      let finalExpr = returnExprStr;
      for (const [paramName, compiledValue] of Object.entries(paramBindings)) {
        // Replace parameter name with compiled value (using word boundaries)
        const regex = new RegExp(`\\b${paramName}\\b`, "g");
        finalExpr = finalExpr.replace(regex, `(${compiledValue})`);
      }

      // The final expression now has parameters replaced with compiled JavaScript expressions
      // Return it directly (it's already in JavaScript form)
      return ok(finalExpr);
    };

    const extractCompiledValue = (
      expr: string,
      isAssignmentContext: boolean,
    ): Result<string, string> => {
      // Try function calls first
      const fnCallResult = compileFunctionCall(expr);
      if (fnCallResult !== undefined) {
        return fnCallResult;
      }

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
          // Find the first assignment operator (=, +=, -=, *=, /=)
          let opIdx = -1;
          const compoundOps = ["+=", "-=", "*=", "/="];

          for (const compOp of compoundOps) {
            const idx = assignStmt.indexOf(compOp);
            if (idx !== -1 && (opIdx === -1 || idx < opIdx)) {
              opIdx = idx;
            }
          }

          // If no compound op found, look for simple =
          if (opIdx === -1) {
            opIdx = assignStmt.indexOf("=");
          }

          return assignStmt.substring(0, opIdx).trim();
        };

        // Helper to handle variable assignments (used both for regular and block assignments)
        const handleAssignment = (
          assignStmt: string,
        ): Result<undefined, string> => {
          const extractAndCompileAssignmentValue = (
            statement: string,
          ): Result<{ valueExpr: string; compiledValue: string }, string> => {
            const equalIdx = statement.indexOf("=");
            const valueExpr = statement.substring(equalIdx + 1).trim();
            const compiledValueResult = extractCompiledValue(valueExpr, true);
            if (!compiledValueResult.ok) {
              return compiledValueResult;
            }

            return ok({
              valueExpr,
              compiledValue: compiledValueResult.value,
            });
          };

          const varName = extractVariableNameFromAssignment(assignStmt);

          // Handle dereference assignment: *ptr = value
          if (varName.startsWith("*")) {
            const ptrName = varName.substring(1).trim();
            const declaredResult = requireDeclaredVariable(ptrName);
            if (!declaredResult.ok) {
              return declaredResult;
            }

            const ptrType = declarationTypes[ptrName] || "";
            if (!ptrType.startsWith("*")) {
              return err(
                `Cannot assign through non-pointer variable '${ptrName}'`,
              );
            }
            if (!ptrType.startsWith("*mut ")) {
              return err(
                `Cannot assign through immutable reference '${ptrName}'`,
              );
            }

            const assignmentValueResult =
              extractAndCompileAssignmentValue(assignStmt);
            if (!assignmentValueResult.ok) {
              return assignmentValueResult;
            }
            const { valueExpr, compiledValue } = assignmentValueResult.value;

            const pointedType = ptrType.substring(5).trim();
            const validationResult = validateTypeAssignment(
              extractValueType(valueExpr, declarationTypes),
              pointedType,
            );
            if (!validationResult.ok) {
              return validationResult;
            }

            statements.push(`${ptrName}.value = ${compiledValue};`);
            return ok(undefined);
          }

          // Validate variable is declared
          const declaredResult = requireDeclaredVariable(varName);
          if (!declaredResult.ok) {
            return declaredResult;
          }

          if (!mutableVars.has(varName)) {
            return err(`Variable '${varName}' is not mutable`);
          }

          // Check for compound arithmetic operators and validate type compatibility
          const isCompoundArithmetic =
            assignStmt.includes("+=") ||
            assignStmt.includes("-=") ||
            assignStmt.includes("*=") ||
            assignStmt.includes("/=");

          if (isCompoundArithmetic && varName in declarationTypes) {
            const varType = declarationTypes[varName];
            // Arithmetic operations are not valid on Bool types
            if (varType === "Bool") {
              return err(
                `Cannot perform arithmetic operation on Bool variable '${varName}'`,
              );
            }
          }

          // Handle compound assignment operators (+=, -=, *=, /=)
          let normalizedStmt = assignStmt;
          if (assignStmt.includes("+=")) {
            const plusEqIdx = assignStmt.indexOf("+=");
            const valueExpr = assignStmt.substring(plusEqIdx + 2).trim();
            normalizedStmt = `${varName} = ${varName} + ${valueExpr}`;
          } else if (assignStmt.includes("-=")) {
            const minusEqIdx = assignStmt.indexOf("-=");
            const valueExpr = assignStmt.substring(minusEqIdx + 2).trim();
            normalizedStmt = `${varName} = ${varName} - ${valueExpr}`;
          } else if (assignStmt.includes("*=")) {
            const mulEqIdx = assignStmt.indexOf("*=");
            const valueExpr = assignStmt.substring(mulEqIdx + 2).trim();
            normalizedStmt = `${varName} = ${varName} * ${valueExpr}`;
          } else if (assignStmt.includes("/=")) {
            const divEqIdx = assignStmt.indexOf("/=");
            const valueExpr = assignStmt.substring(divEqIdx + 2).trim();
            normalizedStmt = `${varName} = ${varName} / ${valueExpr}`;
          }

          const equalIdx = normalizedStmt.indexOf("=");
          const valueExpr = normalizedStmt.substring(equalIdx + 1).trim();
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

        const processScopedBodyStatements = (
          bodyContent: string,
          outerDeclarations: Set<string>,
        ): { body: string; result: Result<undefined, string> } => {
          const bodyStmts = splitStatements(bodyContent);
          let bodyOutput = "";

          const bodyProcessResult = bodyStmts.reduce(
            (acc, bodyStmt) => {
              if (acc.ok === false) {
                return acc;
              }

              if (bodyStmt.startsWith("let ")) {
                const parsed = parseLetStatement(bodyStmt);
                if (!parsed.valueExpr) {
                  return err(
                    "Invalid variable declaration: missing initializer",
                  );
                }

                const compiledValueResult = extractCompiledValue(
                  parsed.valueExpr,
                  false,
                );
                if (!compiledValueResult.ok) {
                  return compiledValueResult;
                }

                declarations[parsed.varName] = compiledValueResult.value;
                if (parsed.isMutable) {
                  mutableVars.add(parsed.varName);
                }
                bodyOutput += `${parsed.isMutable ? "var" : "const"} ${parsed.varName} = ${compiledValueResult.value}; `;

                if (parsed.isTyped && parsed.declaredType) {
                  declarationTypes[parsed.varName] = parsed.declaredType;
                }

                return ok(undefined);
              } else if (bodyStmt.includes("=")) {
                // Handle assignments - only allow modifying outer-scope variables
                const varName = extractVariableNameFromAssignment(bodyStmt);
                const scopedVarName = varName.startsWith("*")
                  ? varName.substring(1).trim()
                  : varName;

                if (!outerDeclarations.has(scopedVarName)) {
                  return err(
                    `Variable '${varName}' is not available in this scope`,
                  );
                }

                const assignmentResult = handleAssignment(bodyStmt);
                if (!assignmentResult.ok) {
                  return assignmentResult;
                }

                // Extract the assignment from statements (last statement added)
                const lastStatement = statements[statements.length - 1];
                bodyOutput += lastStatement;
                statements.pop(); // Remove from outer statements

                return ok(undefined);
              }

              return ok(undefined);
            },
            ok(undefined) as Result<undefined, string>,
          );

          return { body: bodyOutput, result: bodyProcessResult };
        };

        const cleanupScopedVariables = (
          outerDeclarations: Set<string>,
          outerMutableVars: Set<string>,
        ): void => {
          // Remove scoped variables from declarations by restoring to pre-scope state
          Object.keys(declarations).forEach((varName) => {
            if (!outerDeclarations.has(varName)) {
              delete declarations[varName];
              delete declarationTypes[varName];
            }
          });
          mutableVars.forEach((varName) => {
            if (!outerMutableVars.has(varName)) {
              mutableVars.delete(varName);
            }
          });
        };

        if (stmt.startsWith("fn ")) {
          // Handle function definitions: fn name() => body
          // For now, just validate syntax and skip (no-op)
          const afterFn = stmt.substring(3).trim();
          const parenIdx = afterFn.indexOf("(");
          if (parenIdx === -1) {
            return err("Invalid function definition: missing parentheses");
          }

          const fnName = afterFn.substring(0, parenIdx).trim();
          if (!fnName) {
            return err("Invalid function definition: missing function name");
          }

          // Check for duplicate function definition
          if (fnName in definedFunctions) {
            return err(`Function '${fnName}' is already defined`);
          }

          // Check if function name shadows a declared variable
          if (fnName in declarations) {
            return err(`Function '${fnName}' shadows declared variable`);
          }

          // Find closing paren using reduce
          let closeParenIdx = -1;
          [...afterFn].reduce((depth: number, char: string, idx: number) => {
            if (idx < parenIdx || closeParenIdx !== -1) {
              return depth;
            }
            if (char === "(") return depth + 1;
            if (char === ")") {
              const newDepth = depth - 1;
              if (newDepth === 0) {
                closeParenIdx = idx;
              }
              return newDepth;
            }
            return depth;
          }, 0);

          if (closeParenIdx === -1) {
            return err(
              "Invalid function definition: missing closing parenthesis",
            );
          }

          // Extract and validate parameters
          const parametersStr = afterFn
            .substring(parenIdx + 1, closeParenIdx)
            .trim();

          // Helper to parse and validate parameters
          const parseParameters = (
            paramStr: string,
          ): Result<Array<{ name: string; type: string }>, string> => {
            const parsedParams: Array<{ name: string; type: string }> = [];
            if (paramStr.length === 0) {
              return ok(parsedParams);
            }

            const params = paramStr.split(",").map((p) => p.trim());
            const seenParamNames = new Set<string>();

            return params.reduce(
              (acc, param) => {
                if (!acc.ok) return acc;

                // Extract parameter name (before the colon)
                const colonIdx = param.indexOf(":");
                const paramName =
                  colonIdx > -1
                    ? param.substring(0, colonIdx).trim()
                    : param.trim();
                const paramType =
                  colonIdx > -1 ? param.substring(colonIdx + 1).trim() : "";

                if (!paramName) {
                  return err(
                    "Invalid function parameter: missing parameter name",
                  );
                }

                // Check for duplicate parameter name
                if (seenParamNames.has(paramName)) {
                  return err(`Parameter '${paramName}' is already defined`);
                }

                // Check if parameter shadows a declared variable
                if (paramName in declarations) {
                  return err(
                    `Parameter '${paramName}' shadows declared variable`,
                  );
                }

                seenParamNames.add(paramName);
                acc.value.push({ name: paramName, type: paramType });
                return acc;
              },
              ok(parsedParams) as Result<
                Array<{ name: string; type: string }>,
                string
              >,
            );
          };

          const paramsResult = parseParameters(parametersStr);
          if (!paramsResult.ok) {
            return paramsResult;
          }
          const params = paramsResult.value;

          const remaining = afterFn.substring(closeParenIdx + 1).trim();

          // Parse return type if present (: Type)
          let returnType = "";
          let afterReturnType = remaining;

          if (remaining.startsWith(":")) {
            const typeEndIdx = remaining.indexOf("=>");
            if (typeEndIdx === -1) {
              return err(
                "Invalid function definition: missing arrow => after return type",
              );
            }
            returnType = remaining.substring(1, typeEndIdx).trim();
            afterReturnType = remaining.substring(typeEndIdx).trim();

            if (!isValidTypeStrWithAliases(returnType)) {
              return err(`Invalid return type: ${returnType}`);
            }
          }

          // Check for arrow =>
          if (!afterReturnType.startsWith("=>")) {
            return err("Invalid function definition: missing arrow =>");
          }

          // Extract function body
          const bodyStart = afterReturnType.indexOf("=>") + 2;
          const body = afterReturnType.substring(bodyStart).trim();

          // Remove trailing semicolon if present (for expression-only bodies)
          const normalizedBody = body.endsWith(";")
            ? body.substring(0, body.length - 1).trim()
            : body;

          // Validate body format: either a block { ... } or an expression
          if (
            !(
              (normalizedBody.startsWith("{") &&
                normalizedBody.endsWith("}")) ||
              (normalizedBody.length > 0 &&
                !normalizedBody.includes("{") &&
                !normalizedBody.includes("}"))
            )
          ) {
            return err(
              "Invalid function definition: body must be a block or expression",
            );
          }

          // Store this function definition
          definedFunctions[fnName] = {
            params,
            returnType,
            body: normalizedBody,
          };

          // Skip this statement - function definitions are no-ops
          return ok(undefined);
        } else if (stmt.startsWith("type ")) {
          // Handle type alias declarations: type MyAlias = I32;
          const afterType = stmt.substring(5);
          const equalIdx = afterType.indexOf("=");
          if (equalIdx === -1) {
            return err("Invalid type alias syntax: missing =");
          }

          const aliasName = afterType.substring(0, equalIdx).trim();
          const aliasType = afterType.substring(equalIdx + 1).trim();

          if (!aliasName || !aliasType) {
            return err(
              "Invalid type alias syntax: alias name and type required",
            );
          }

          // Prevent shadowing built-in types
          const builtInTypes = [
            "I32",
            "I64",
            "U8",
            "U16",
            "U32",
            "U64",
            "Bool",
          ];
          if (builtInTypes.includes(aliasName)) {
            return err(`Cannot use built-in type name '${aliasName}' as alias`);
          }

          // Validate that the aliased type is valid
          if (!isValidTypeStrWithAliases(aliasType)) {
            return err(`Invalid type in alias: ${aliasType}`);
          }

          // Check for duplicate alias
          if (aliasName in typeAliases) {
            return err(`Type alias '${aliasName}' is already defined`);
          }

          typeAliases[aliasName] = aliasType;
          return ok(undefined);
        } else if (stmt.startsWith("let ")) {
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
            // Wrap block statements in an IIFE to scope variables to the block
            if (blockStatements.length > 0) {
              const iife = `(() => { ${blockStatements} return ${returnValue}; })()`;
              compiledValue = iife;
            } else {
              compiledValue = returnValue;
            }
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
            const resolvedType = resolveTypeAlias(parsed.declaredType);
            if (!isValidTypeStr(resolvedType)) {
              return err(`Invalid type: ${parsed.declaredType}`);
            }

            const validationResult = validateTypeAssignment(
              extractValueType(parsed.valueExpr, declarationTypes),
              resolvedType,
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
            const resolvedType = resolveTypeAlias(parsed.declaredType);
            declarationTypes[parsed.varName] = resolvedType;
          } else if (
            parsed.valueExpr === "true" ||
            parsed.valueExpr === "false"
          ) {
            // Infer Bool type for boolean literals
            declarationTypes[parsed.varName] = "Bool";
          } else if (parsed.valueExpr.startsWith("&")) {
            // Handle reference operator: infer pointer type
            const refVarName = parsed.valueExpr.startsWith("&mut ")
              ? parsed.valueExpr.substring(5).trim()
              : parsed.valueExpr.substring(1).trim();
            if (refVarName in declarationTypes) {
              declarationTypes[parsed.varName] =
                (parsed.valueExpr.startsWith("&mut ") ? "*mut " : "*") +
                declarationTypes[refVarName];
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
            } else {
              // Check for plain numeric literals
              const isPlainNumber =
                parsed.valueExpr.length > 0 &&
                [...parsed.valueExpr].every((c) => c >= "0" && c <= "9");
              if (isPlainNumber) {
                declarationTypes[parsed.varName] = "I32";
              }
            }
          }

          return ok(undefined);
        } else if (stmt.startsWith("{") && stmt.endsWith("}")) {
          // Handle block statements as standalone statements with proper scoping
          const blockContent = stmt.substring(1, stmt.length - 1).trim();
          if (blockContent.length > 0) {
            // Track which variables existed before the block (for scope isolation)
            const outerDeclarations = new Set(Object.keys(declarations));
            const outerMutableVars = new Set(mutableVars);

            // Process the block body
            const { body: blockBody, result: blockProcessResult } =
              processScopedBodyStatements(blockContent, outerDeclarations);

            if (!blockProcessResult.ok) {
              return blockProcessResult;
            }

            // Add the block body statements to the main statements
            if (blockBody.length > 0) {
              statements.push(blockBody);
            }

            // Clean up block-scoped variables
            cleanupScopedVariables(outerDeclarations, outerMutableVars);
          }

          return ok(undefined);
        } else if (stmt.startsWith("while (")) {
          // Handle while loops
          const whileParsed = parseWhile(stmt);
          if (!whileParsed) {
            return err("Invalid while loop syntax");
          }

          const { condition, body } = whileParsed;

          // The while condition will be used as-is, since JavaScript evaluates the expression
          // Variables used in the condition must already be declared

          // Process the body (which is a block { ... })
          const bodyContent = body.substring(1, body.length - 1).trim();
          if (bodyContent.length === 0) {
            // Empty while loop - just skip
            return ok(undefined);
          }

          // Create a new scope for the while loop body
          const outerDeclarations = new Set(Object.keys(declarations));
          const outerMutableVars = new Set(mutableVars);

          // Process the while loop body
          const { body: whileBody, result: bodyProcessResult } =
            processScopedBodyStatements(bodyContent, outerDeclarations);

          if (!bodyProcessResult.ok) {
            return bodyProcessResult;
          }

          // Restore variable scope
          cleanupScopedVariables(outerDeclarations, outerMutableVars);

          // Add the while loop to statements - the condition is used directly
          statements.push(`while (${condition}) { ${whileBody.trim()} }`);

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

          // Validate that simple identifier references exist in declarations
          // A simple identifier doesn't contain operators, parentheses, or brackets
          const specialChars = [
            "+",
            "-",
            "*",
            "/",
            "(",
            ")",
            "[",
            "]",
            "{",
            "}",
            ".",
            ",",
            ";",
            ":",
            "?",
            "&",
            "|",
            "!",
            "=",
            "<",
            ">",
            "'",
            '"',
          ];
          const isSimpleIdentifier = !specialChars.some((char) =>
            stmt.includes(char),
          );
          if (isSimpleIdentifier && !(stmt in declarations)) {
            return err(`Variable '${stmt}' is not declared`);
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

    // Process return expression to inline function calls and handle Tuff-specific syntax
    let finalReturnExpr = returnExpr;

    // Helper to remove type annotations (e.g., <I32> -> empty)
    const removeTypeAnnotations = (expr: string): string => {
      let result = expr;
      [...expr].reduce(
        (acc, char, i) => {
          if (acc.depth === 0 && char === "<") {
            acc.start = i;
            acc.depth = 1;
          } else if (char === "<") {
            acc.depth++;
          } else if (char === ">") {
            acc.depth--;
            if (acc.depth === 0 && acc.start !== -1) {
              result = result.substring(0, acc.start) + result.substring(i + 1);
              acc.start = -1;
            }
          }
          return acc;
        },
        { depth: 0, start: -1 },
      );
      return result;
    };

    // Try to detect and inline function calls in return expression
    // Match pattern: functionName(...)
    const parenIdx = finalReturnExpr.indexOf("(");
    if (parenIdx > 0) {
      const potentialFnName = finalReturnExpr.substring(0, parenIdx).trim();
      if (
        finalReturnExpr.endsWith(")") &&
        potentialFnName in definedFunctions
      ) {
        const fnDef = definedFunctions[potentialFnName];
        const argsStr = finalReturnExpr
          .substring(parenIdx + 1, finalReturnExpr.length - 1)
          .trim();

        // Parse arguments (simple split by comma)
        const args: string[] =
          argsStr.length > 0
            ? argsStr
                .split(",")
                .map((arg) => arg.trim())
                .filter((arg) => arg.length > 0)
            : [];

        if (args.length === fnDef.params.length) {
          // Process arguments by removing type annotations
          const compiledArgs = args.map((arg) => removeTypeAnnotations(arg));

          // Extract return expression from function body
          let returnStmt: string;

          if (fnDef.body.startsWith("{") && fnDef.body.endsWith("}")) {
            // Block body: extract content from { ... }
            const bodyContent = fnDef.body
              .substring(1, fnDef.body.length - 1)
              .trim();

            if (bodyContent.startsWith("return ")) {
              // Explicit return statement
              returnStmt = bodyContent.substring(7);
              if (returnStmt.endsWith(";")) {
                returnStmt = returnStmt
                  .substring(0, returnStmt.length - 1)
                  .trim();
              }
            } else {
              // Implicit return (last expression in block)
              returnStmt = bodyContent;
            }
          } else {
            // Expression body: use directly
            returnStmt = fnDef.body;
          }

          // Substitute parameters into the return statement
          finalReturnExpr = fnDef.params.reduce((stmt, param, idx) => {
            const compiledArg = compiledArgs[idx];
            // Simple string replacement for parameter substitution
            // This works for simple cases; doesn't handle word boundaries perfectly
            // but good enough for basic function inlining
            let result = stmt;
            let searchPos = 0;
            while (true) {
              const idx = result.indexOf(param.name, searchPos);
              if (idx === -1) break;
              // Check boundaries
              const before = idx > 0 ? result[idx - 1] : " ";
              const after =
                idx + param.name.length < result.length
                  ? result[idx + param.name.length]
                  : " ";
              const isWordChar = (c: string) =>
                (c >= "a" && c <= "z") ||
                (c >= "A" && c <= "Z") ||
                (c >= "0" && c <= "9") ||
                c === "_";
              if (!isWordChar(before) && !isWordChar(after)) {
                result =
                  result.substring(0, idx) +
                  `(${compiledArg})` +
                  result.substring(idx + param.name.length);
                searchPos = idx + compiledArg.length + 2;
              } else {
                searchPos = idx + 1;
              }
            }
            return result;
          }, returnStmt);
        }
      }
    }

    // Clean up any remaining type annotations in the return expression
    finalReturnExpr = removeTypeAnnotations(finalReturnExpr);

    return ok(statements.join("\n") + "\nreturn " + finalReturnExpr + ";");
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
    // Allow alphanumeric, underscores (for variables), and operators
    const validChars =
      "0123456789+-*/ ()read_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const invalidCharIndex = [...result].findIndex(
      (c) => !validChars.includes(c),
    );
    if (invalidCharIndex !== -1) {
      return err("Invalid character in expression");
    }

    // Reject patterns like -100U8 (unary minus with typed numeric literal)
    // These are not valid JavaScript and shouldn't be allowed
    // Check for minus followed by digits followed by type suffix (U/I/F + digits)
    const resultChars = [...result];
    const hasInvalidNegativeTypedLiteral = resultChars.some((char, i) => {
      if (char !== "-" || i + 1 >= resultChars.length) {
        return false;
      }
      // Check if next char is a digit
      if (!(resultChars[i + 1] >= "0" && resultChars[i + 1] <= "9")) {
        return false;
      }
      // Found minus followed by digit, check if it's a typed literal
      let digitEnd = i + 1;
      while (
        digitEnd < resultChars.length &&
        resultChars[digitEnd] >= "0" &&
        resultChars[digitEnd] <= "9"
      ) {
        digitEnd++;
      }
      // Check if digits are followed by type suffix (U/I/F)
      if (
        digitEnd >= resultChars.length ||
        !(
          resultChars[digitEnd] === "U" ||
          resultChars[digitEnd] === "I" ||
          resultChars[digitEnd] === "F"
        )
      ) {
        return false;
      }
      const afterTypeLetter = digitEnd + 1;
      return (
        afterTypeLetter < resultChars.length &&
        resultChars[afterTypeLetter] >= "0" &&
        resultChars[afterTypeLetter] <= "9"
      );
    });

    if (hasInvalidNegativeTypedLiteral) {
      return err(
        "Negative numeric literals with type suffixes are not allowed",
      );
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
