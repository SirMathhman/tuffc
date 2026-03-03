import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => {
  return { ok: true, value };
};

export const err = <E>(error: E): Result<never, E> => {
  return { ok: false, error };
};

type FunctionDefinition = {
  params: Array<{ name: string; type: string }>;
  returnType: string;
  body: string;
};

const replaceThisPattern = (
  source: string,
  localDeclarations?: Record<string, string>,
): string => {
  let result = "";
  let i = 0;
  const chars = [...source];

  chars.forEach((_, idx) => {
    if (idx < i) return;

    const atThisDot = source.slice(idx, idx + 5) === "this.";
    const atThis =
      localDeclarations &&
      source.slice(idx, idx + 4) === "this" &&
      (idx + 4 === source.length || !isWordChar(source[idx + 4]));

    if (atThisDot || atThis) {
      const prevChar = idx > 0 ? source[idx - 1] : "";
      const isWordBoundary = !prevChar || !isWordChar(prevChar);

      if (isWordBoundary) {
        if (atThisDot) {
          i = idx + 5;
          let identifier = "";
          while (i < source.length && isWordChar(source[i])) {
            identifier += source[i];
            i++;
          }
          if (identifier.length > 0) {
            result += identifier;
          } else {
            result += "this.";
            i = idx + 5;
          }
        } else {
          i = idx + 4;
          if (localDeclarations && Object.keys(localDeclarations).length > 0) {
            const entriesList = Object.keys(localDeclarations)
              .map((name) => `${name}: ${name}`)
              .join(", ");
            result += `({ ${entriesList} })`;
          } else {
            result += "this";
          }
        }
      } else {
        result += source[idx];
        i = idx + 1;
      }
    } else {
      result += source[idx];
      i = idx + 1;
    }
  });
  return result;
};

const isWordChar = (char: string): boolean => {
  return (
    (char >= "a" && char <= "z") ||
    (char >= "A" && char <= "Z") ||
    (char >= "0" && char <= "9") ||
    char === "_"
  );
};

const parseFunctionTypeSignature = (
  typeStr: string,
): { paramTypes: string[]; returnType: string } | undefined => {
  const trimmed = typeStr.trim();
  if (!trimmed.startsWith("(")) {
    return undefined;
  }

  const closeParenIdx = trimmed.indexOf(")");
  if (closeParenIdx === -1) {
    return undefined;
  }

  const arrowIdx = trimmed.indexOf("=>", closeParenIdx + 1);
  if (arrowIdx === -1) {
    return undefined;
  }

  const paramsPart = trimmed.substring(1, closeParenIdx).trim();
  const returnType = trimmed.substring(arrowIdx + 2).trim();
  if (!returnType) {
    return undefined;
  }

  const paramTypes =
    paramsPart.length === 0
      ? []
      : paramsPart
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p.length > 0);

  return { paramTypes, returnType };
};

const getFunctionSignatureType = (
  fnName: string,
  definedFunctions: Record<string, FunctionDefinition>,
): string => {
  const fnDef = definedFunctions[fnName];
  const params = fnDef.params.map((p) => p.type || "I32").join(", ");
  const returnType = fnDef.returnType || "I32";
  return `(${params}) => ${returnType}`;
};

const normalizeFunctionCompatibleType = (
  typeStr: string,
  definedFunctions?: Record<string, FunctionDefinition>,
): string => {
  const trimmed = typeStr.trim();
  if (definedFunctions && trimmed in definedFunctions) {
    return getFunctionSignatureType(trimmed, definedFunctions);
  }
  return trimmed;
};

const isValidTypeStr = (
  typeStr: string,
  definedFunctions?: Record<string, FunctionDefinition>,
): boolean => {
  const functionTypeSignature = parseFunctionTypeSignature(typeStr);
  if (functionTypeSignature) {
    const paramsValid = functionTypeSignature.paramTypes.every((paramType) =>
      isValidTypeStr(paramType, definedFunctions),
    );
    if (!paramsValid) {
      return false;
    }
    return isValidTypeStr(functionTypeSignature.returnType, definedFunctions);
  }

  // Handle function types/references
  if (definedFunctions && typeStr in definedFunctions) {
    return true;
  }
  // Handle pointer types like *I32 or *U8
  if (typeStr.startsWith("*")) {
    return isValidTypeStr(typeStr.substring(1), definedFunctions);
  }
  // Handle mutable pointee marker in pointer types like *mut I32
  if (typeStr.startsWith("mut ")) {
    return isValidTypeStr(typeStr.substring(4).trim(), definedFunctions);
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
  if (!expr.startsWith("if (") && !expr.startsWith("if(")) {
    return undefined;
  }

  const startIdx = expr.startsWith("if (") ? 4 : 3;
  const result = extractConditionFromParens(expr, startIdx);
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
      (remaining[i] === " " || remaining[i] === "}") &&
      remaining.substring(i + 1, i + 6) === "else " &&
      depth === 0
    ) {
      elseIdx = i;
      break;
    }

    // Track nesting depth: if we see "if (", we go deeper
    if (
      remaining.substring(i, i + 3) === "if " ||
      remaining.substring(i, i + 3) === "if("
    ) {
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
  definedFunctions?: Record<string, FunctionDefinition>,
): string => {
  // Handle property access test.value
  if (valueExpr.includes(".") && !valueExpr.startsWith("{")) {
    const dotIdx = valueExpr.lastIndexOf(".");
    const objExpr = valueExpr.substring(0, dotIdx).trim();
    const propName = valueExpr.substring(dotIdx + 1).trim();
    const objType = extractValueType(
      objExpr,
      declarationTypes,
      definedFunctions,
    );

    if (objType && definedFunctions && objType in definedFunctions) {
      const fnDef = definedFunctions[objType];
      const param = fnDef.params.find((p) => p.name === propName);
      if (param) {
        return param.type || "I32";
      }
    }
  }

  // Handle function calls in type inference
  if (valueExpr.includes("(") && definedFunctions) {
    const openParenIdx = valueExpr.indexOf("(");
    const fnName = valueExpr.substring(0, openParenIdx).trim();
    if (fnName in definedFunctions) {
      const fnDef = definedFunctions[fnName];
      // If returnType is "this", the return type is the function name itself (the "class" type)
      if (fnDef.returnType === "this" || fnDef.body === "this") {
        return fnName;
      }
      return fnDef.returnType || "I32";
    }
  }

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
            definedFunctions,
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
      return extractValueType(
        lastStatement,
        blockDeclarationTypes,
        definedFunctions,
      );
    }

    // If it's a let statement, extract the type of its value
    const parsed = parseLetStatement(lastStatement);
    if (parsed.isTyped) {
      return parsed.declaredType;
    }
    const inferredType = extractValueType(
      parsed.valueExpr,
      blockDeclarationTypes,
      definedFunctions,
    );
    return inferredType;
  }

  // Handle if/else expressions
  const ifElseParts = parseIfElse(valueExpr);
  if (ifElseParts) {
    const consequentType = extractValueType(
      ifElseParts.consequent,
      declarationTypes,
      definedFunctions,
    );
    const alternateType = extractValueType(
      ifElseParts.alternate,
      declarationTypes,
      definedFunctions,
    );

    const normalizedConsequentType = normalizeFunctionCompatibleType(
      consequentType,
      definedFunctions,
    );
    const normalizedAlternateType = normalizeFunctionCompatibleType(
      alternateType,
      definedFunctions,
    );

    // Return the type if they match, otherwise return empty string
    if (normalizedConsequentType === normalizedAlternateType) {
      return normalizedAlternateType;
    }
    return "";
  }

  // Handle dereference operator
  if (valueExpr.startsWith("*")) {
    const innerType = extractValueType(
      valueExpr.substring(1),
      declarationTypes,
      definedFunctions,
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
      definedFunctions,
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
      definedFunctions,
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

  // Check for function references (valueExpr is the name of a function)
  if (definedFunctions && valueExpr in definedFunctions) {
    return valueExpr;
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
  definedFunctions?: Record<string, FunctionDefinition>,
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

  const normalizedValueType = normalizeFunctionCompatibleType(
    valueType,
    definedFunctions,
  );
  const normalizedDeclaredType = normalizeFunctionCompatibleType(
    declaredType,
    definedFunctions,
  );

  // Handle case where custom type is the same as declared type
  if (normalizedValueType === normalizedDeclaredType) {
    return ok(undefined);
  }

  // Handle Bool types
  if (normalizedValueType === "Bool" || normalizedDeclaredType === "Bool") {
    return normalizedValueType === normalizedDeclaredType
      ? ok(undefined)
      : err(`Cannot assign ${valueType} to ${declaredType}`);
  }

  // Handle pointer types
  const isValuePointer = normalizedValueType.startsWith("*");
  const isDeclaredPointer = normalizedDeclaredType.startsWith("*");

  if (isValuePointer !== isDeclaredPointer) {
    return err(`Cannot assign ${valueType} to ${declaredType}`);
  }

  // Remove pointer markers for comparison
  const innerValueType = isValuePointer
    ? stripMutabilityPrefix(normalizedValueType.substring(1))
    : normalizedValueType;
  const innerDeclaredType = isDeclaredPointer
    ? stripMutabilityPrefix(normalizedDeclaredType.substring(1))
    : normalizedDeclaredType;

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

  const findAssignmentIndex = (sourceText: string): number => {
    return [...sourceText].findIndex(
      (_char, idx) => sourceText[idx] === "=" && sourceText[idx + 1] !== ">",
    );
  };

  const colonIdx = afterLet.indexOf(":");
  const equalIdx = findAssignmentIndex(afterLet);

  const isTyped = colonIdx !== -1 && colonIdx < equalIdx;
  const declaredType = isTyped
    ? afterLet.substring(colonIdx + 1, equalIdx).trim()
    : "";
  const varName = afterLet.substring(0, isTyped ? colonIdx : equalIdx).trim();
  const valueExpr = afterLet.substring(equalIdx + 1).trim();

  return { isMutable, varName, declaredType, valueExpr, isTyped };
};

export const compile = (
  source: string,
  requiresFinalExpression = false,
): Result<string, string> => {
  if (source === "{}") {
    return ok("return 0;");
  }
  // allow using `this.<var>` inside the language as shorthand for a local
  // variable.  The runtime `this` in a new Function call is undefined or the
  // global object, so `this.x` would never resolve.  To keep the tests happy
  // we simply rewrite all `this.<ident>` occurrences to the bare identifier
  // before any parsing occurs.  This transformation happens early so that
  // subsequent analysis (splitting statements, type checking, etc.) works
  // normally.
  source = replaceThisPattern(source);

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
    definedFunctions?: Record<string, FunctionDefinition>,
  ): {
    leftType: string;
    rightType: string;
  } => {
    const leftType =
      leftOp in declarationTypes
        ? declarationTypes[leftOp]
        : extractValueType(leftOp, declarationTypes, definedFunctions);
    const rightType =
      rightOp in declarationTypes
        ? declarationTypes[rightOp]
        : extractValueType(rightOp, declarationTypes, definedFunctions);
    return { leftType, rightType };
  };

  const compileIfElse = (
    expr: string,
    declarationTypes?: Record<string, string>,
    definedFunctions?: Record<string, FunctionDefinition>,
  ): Result<string, string> => {
    const ifElseParts = parseIfElse(expr);

    if (!ifElseParts) {
      return err("Invalid if/else expression");
    }

    const { condition, consequent, alternate } = ifElseParts;

    // Validate that the condition is a boolean type
    if (declarationTypes) {
      const conditionType = extractValueType(
        condition,
        declarationTypes,
        definedFunctions,
      );
      if (conditionType !== "Bool") {
        return err("If/else condition must be of type Bool");
      }
    } else {
      const conditionType = extractValueType(condition, {}, definedFunctions);
      if (conditionType !== "Bool") {
        return err("If/else condition must be of type Bool");
      }
    }

    // Validate that consequent and alternate have the same type
    const consequentType = declarationTypes
      ? extractValueType(consequent, declarationTypes, definedFunctions)
      : extractValueType(consequent, {}, definedFunctions);
    const alternateType = declarationTypes
      ? extractValueType(alternate, declarationTypes, definedFunctions)
      : extractValueType(alternate, {}, definedFunctions);

    const normalizedConsequentType = normalizeFunctionCompatibleType(
      consequentType,
      definedFunctions,
    );
    const normalizedAlternateType = normalizeFunctionCompatibleType(
      alternateType,
      definedFunctions,
    );

    if (normalizedConsequentType !== normalizedAlternateType) {
      return err(
        `If/else branches have mismatched types: ${consequentType} vs ${alternateType}`,
      );
    }

    // If the alternate is itself an if-else expression, compile it to a ternary
    let compiledAlternate = alternate;
    if (alternate.trim().startsWith("if (")) {
      const alternateResult = compileIfElse(
        alternate.trim(),
        declarationTypes,
        definedFunctions,
      );
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
    source.includes("struct ") ||
    source.includes("let ") ||
    source.includes(";") ||
    (source.includes("}") &&
      source.lastIndexOf("}") < source.length - 1 &&
      source.substring(source.lastIndexOf("}") + 1).trim().length > 0);

  if (hasMultipleStatements) {
    const declarations: Record<string, string> = {};
    const declarationTypes: Record<string, string> = {};
    const typeAliases: Record<string, string> = {};
    const definedFunctions: Record<string, FunctionDefinition> = {};
    const mutableVars: Set<string> = new Set();
    const statements: string[] = [];
    let returnExpr = "";
    const structNames: Set<string> = new Set();

    // Helper function to resolve type aliases recursively
    const resolveTypeAlias = (typeStr: string): string => {
      if (typeStr in typeAliases) {
        return resolveTypeAlias(typeAliases[typeStr]);
      }
      return typeStr;
    };

    // Helper function to check if a type is valid, including aliases
    const isValidTypeStrWithAliases = (
      typeStr: string,
      definedFunctions?: Record<string, FunctionDefinition>,
    ): boolean => {
      const resolved = resolveTypeAlias(typeStr);
      return isValidTypeStr(resolved, definedFunctions);
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

      // Find the closing parenthesis that matches this opening parenthesis
      let closeParenIdx = -1;
      let depthCounterParen = 0;
      let charArray = [...expr];
      charArray.forEach((char, i) => {
        if (i < openParenIdx || closeParenIdx !== -1) return;
        if (char === "(") depthCounterParen++;
        else if (char === ")") {
          depthCounterParen--;
          if (depthCounterParen === 0) {
            closeParenIdx = i;
          }
        }
      });

      if (closeParenIdx === -1) {
        return undefined;
      }

      const potentialFnName = expr.substring(0, openParenIdx).trim();
      const argsStr = expr.substring(openParenIdx + 1, closeParenIdx).trim();
      const rest = expr.substring(closeParenIdx + 1);

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

      let expectedParamTypes: string[] = [];
      let functionKnown = false;

      if (potentialFnName in definedFunctions) {
        const fnDef = definedFunctions[potentialFnName];
        expectedParamTypes = fnDef.params.map((p) => p.type || "I32");
        functionKnown = true;
      } else if (potentialFnName in declarations) {
        const declaredType = declarationTypes[potentialFnName] || "";
        const parsedSignature = parseFunctionTypeSignature(declaredType);
        if (parsedSignature) {
          expectedParamTypes = parsedSignature.paramTypes;
          functionKnown = true;
        } else if (declaredType in definedFunctions) {
          const fnDef = definedFunctions[declaredType];
          expectedParamTypes = fnDef.params.map((p) => p.type || "I32");
          functionKnown = true;
        }
      }

      if (!functionKnown) {
        return undefined;
      }

      // Validate argument count
      if (args.length !== expectedParamTypes.length) {
        return err(
          `Function '${potentialFnName}' expects ${expectedParamTypes.length} arguments, got ${args.length}`,
        );
      }

      const isBooleanLiteral = (arg: string): boolean =>
        arg === "true" || arg === "false";

      const typeError = expectedParamTypes
        .map((paramType, i) => ({ paramType, arg: args[i].trim(), i }))
        .find(
          ({ paramType, arg }) => isBooleanLiteral(arg) && paramType !== "Bool",
        );

      if (typeError) {
        return err(
          `Argument type mismatch for parameter ${typeError.i + 1}: expected ${typeError.paramType}, got Bool`,
        );
      }

      const compiledArgsResult = args.reduce(
        (acc, arg) => {
          if (!acc.ok) {
            return acc;
          }

          const readReplacedArgResult = replaceReadCalls(arg);
          if (!readReplacedArgResult.ok) {
            return readReplacedArgResult;
          }

          const compiledArgRes = extractCompiledValue(
            readReplacedArgResult.value,
            true,
          );
          if (!compiledArgRes.ok) {
            return compiledArgRes;
          }

          acc.value.push(compiledArgRes.value);
          return acc;
        },
        ok([] as string[]) as Result<string[], string>,
      );

      if (!compiledArgsResult.ok) {
        return compiledArgsResult;
      }

      return ok(
        `${potentialFnName}(${compiledArgsResult.value.join(", ")})${rest}`,
      );
    };

    const extractCompiledValue = (
      expr: string,
      isAssignmentContext: boolean,
    ): Result<string, string> => {
      if (expr === "read()") {
        return ok("read()");
      }

      // Handle property access test.value
      if (expr.includes(".") && !expr.startsWith("{")) {
        const dotIdx = expr.lastIndexOf(".");
        const objExpr = expr.substring(0, dotIdx).trim();
        const propName = expr.substring(dotIdx + 1).trim();

        // Recursively compile the object expression
        const compiledObjResult = extractCompiledValue(
          objExpr,
          isAssignmentContext,
        );
        if (!compiledObjResult.ok) {
          return compiledObjResult;
        }

        // Validate the property exists if we can determine the type
        const objType = extractValueType(
          objExpr,
          declarationTypes,
          definedFunctions,
        );
        if (objType && definedFunctions && objType in definedFunctions) {
          const fnDef = definedFunctions[objType];
          if (!fnDef.params.find((p) => p.name === propName)) {
            return err(
              `Property '${propName}' does not exist on type '${objType}'`,
            );
          }
        }

        return ok(`${compiledObjResult.value}.${propName}`);
      }

      // Handle variable function calls: func()
      if (expr.endsWith("()")) {
        const potentialVarName = expr.substring(0, expr.length - 2).trim();
        if (potentialVarName in declarations) {
          const varType = declarationTypes[potentialVarName];
          if (varType && definedFunctions && varType in definedFunctions) {
            return ok(`${potentialVarName}()`);
          }
        }
      }

      // Handle if/else expressions
      if (expr.trim().startsWith("if (") || expr.trim().startsWith("if(")) {
        const ifElseResult = compileIfElse(
          expr.trim(),
          declarationTypes,
          definedFunctions,
        );
        if (ifElseResult.ok) {
          const readReplaced = replaceReadCalls(ifElseResult.value);
          if (!readReplaced.ok) {
            return readReplaced;
          }
          return ok(readReplaced.value);
        }
        return ifElseResult;
      }

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

      // NEW: Check if expr is a function name being used as a reference
      if (expr in definedFunctions) {
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
              extractValueType(valueExpr, declarationTypes, definedFunctions),
              pointedType,
              definedFunctions,
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
              extractValueType(valueExpr, declarationTypes, definedFunctions),
              declarationTypes[varName],
              definedFunctions,
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

            if (!isValidTypeStrWithAliases(returnType, definedFunctions)) {
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

          // If the body is just "{}", we need to handle it specially
          let normalizedBody;
          if (body === "{}") {
            normalizedBody = "{}";
          } else if (body.endsWith(";")) {
            normalizedBody = body.substring(0, body.length - 1).trim();
          } else {
            normalizedBody = body;
          }

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
          if (!isValidTypeStrWithAliases(aliasType, definedFunctions)) {
            return err(`Invalid type in alias: ${aliasType}`);
          }

          // Check for duplicate alias
          if (aliasName in typeAliases) {
            return err(`Type alias '${aliasName}' is already defined`);
          }

          typeAliases[aliasName] = aliasType;
          return ok(undefined);
        } else if (stmt.startsWith("struct ")) {
          // Handle struct declaration: just record name and reject duplicates
          // expected syntax: struct Name { }
          const structBody = stmt.substring(6).trim();
          const parts = structBody.split(" ").filter((p) => p.length > 0);
          const name = parts[0] || "";
          if (!name) {
            return err("Invalid struct syntax");
          }
          if (structNames.has(name)) {
            return err(`Struct '${name}' is already defined`);
          }
          structNames.add(name);
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
            if (!isValidTypeStr(resolvedType, definedFunctions)) {
              // Allow function names as types
              if (definedFunctions && !(resolvedType in definedFunctions)) {
                return err(`Invalid type: ${parsed.declaredType}`);
              }
            }

            const validationResult = validateTypeAssignment(
              extractValueType(
                parsed.valueExpr,
                declarationTypes,
                definedFunctions,
              ),
              resolvedType,
              definedFunctions,
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
          const isIfElseSource =
            stmt.startsWith("if (") || stmt.startsWith("if(");
          const isSimpleIdentifier =
            !specialChars.some((char) => stmt.includes(char)) &&
            !isIfElseSource;
          if (isSimpleIdentifier && !(stmt in declarations)) {
            return err(`Variable '${stmt}' is not declared`);
          }

          if (isIfElseSource || (isSimpleIdentifier && stmt in declarations)) {
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

    if (!returnExpr) {
      if (requiresFinalExpression) {
        return err("Block expression must have a final expression");
      }
      returnExpr = "0";
      if (
        (source === "{}" || source.includes("; {}")) &&
        !requiresFinalExpression
      ) {
        returnExpr = "";
      }
    } else {
      // If the source is just "{}" AND we have a returnExpr (which shouldn't happen but let's be safe)
      if (source === "{}" && !requiresFinalExpression) {
        returnExpr = "";
      }

      // Handle if/else expressions EARLY before read call replacement if possible,
      // but compileIfElse expects the expression.
      if (returnExpr.trim().startsWith("if(")) {
        returnExpr = returnExpr.trim().replace("if(", "if (");
      }
      if (returnExpr.trim().startsWith("if (")) {
        const ifElseCompiled = compileIfElse(
          returnExpr.trim(),
          declarationTypes,
          definedFunctions,
        );
        if (ifElseCompiled.ok) {
          // Wrap in an IIFE to ensure it returns correctly as an expression
          returnExpr = `(() => { ${ifElseCompiled.value} })()`;
        } else {
          return ifElseCompiled;
        }
      }

      // Replace read<Type>() calls early to avoid operator misdetection
      const earlyReadReplaced = replaceReadCalls(returnExpr);
      if (!earlyReadReplaced.ok) {
        return earlyReadReplaced;
      }
      returnExpr = earlyReadReplaced.value;

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
            definedFunctions,
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
            definedFunctions,
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

    // Process return expression function calls with defined function context
    let finalReturnExpr = returnExpr;
    const compiledReturnCall = compileFunctionCall(finalReturnExpr);
    if (compiledReturnCall !== undefined) {
      if (!compiledReturnCall.ok) {
        return compiledReturnCall;
      }
      finalReturnExpr = compiledReturnCall.value;
    }

    const compileFunctionDefinition = (
      functionName: string,
      fnDef: FunctionDefinition,
    ): Result<string, string> => {
      const paramsList = fnDef.params.map((param) => param.name).join(", ");
      let functionBody = fnDef.body;

      const localDeclarations: Record<string, string> = {};
      fnDef.params.forEach((p) => {
        localDeclarations[p.name] = p.name;
      });

      functionBody = replaceThisPattern(functionBody, localDeclarations);

      if (functionBody.startsWith("{") && functionBody.endsWith("}")) {
        functionBody = functionBody
          .substring(1, functionBody.length - 1)
          .trim();
      } else {
        functionBody = `return ${functionBody};`;
      }

      const bodyWithReadCalls = replaceReadCalls(functionBody);
      if (!bodyWithReadCalls.ok) {
        return bodyWithReadCalls;
      }

      return ok(
        `function ${functionName}(${paramsList}) { ${bodyWithReadCalls.value} }`,
      );
    };

    const compiledFunctionDefinitionsResult = Object.entries(
      definedFunctions,
    ).reduce(
      (acc, [functionName, fnDef]) => {
        if (!acc.ok) {
          return acc;
        }

        const compiledFunctionDefinition = compileFunctionDefinition(
          functionName,
          fnDef,
        );
        if (!compiledFunctionDefinition.ok) {
          return compiledFunctionDefinition;
        }

        acc.value.push(compiledFunctionDefinition.value);
        return acc;
      },
      ok([] as string[]) as Result<string[], string>,
    );

    if (!compiledFunctionDefinitionsResult.ok) {
      return compiledFunctionDefinitionsResult;
    }

    const outputLines = [
      ...compiledFunctionDefinitionsResult.value,
      ...statements,
      `return ${finalReturnExpr};`,
    ].filter((line) => line.trim().length > 0);

    return ok(outputLines.join("\n"));
  }

  // If/else expressions: if (condition) consequent else alternate
  if (source.startsWith("if (") || source.startsWith("if(")) {
    const ifElseCompiled = compileIfElse(source);
    if (ifElseCompiled.ok) {
      // Recursively compile the ternary expression
      return compile(ifElseCompiled.value);
    } else {
      return ifElseCompiled;
    }
  }

  // Boolean literals (true/false)
  if (source === "true") {
    return ok("return 1");
  }
  if (source === "false") {
    return ok("return 0");
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
          typeSuffix.length <= 4 &&
          (typeSuffix[0] === "U" || typeSuffix[0] === "I") &&
          typeSuffix
            .split("")
            .slice(1)
            .every((c) => c >= "0" && c <= "9")) ||
        typeSuffix === "I32" ||
        typeSuffix === "U32"
      )
    ) {
      return err("Invalid type suffix");
    }

    if (typeSuffix === "U8" && parseInt(numValue) > 255) {
      return err("Value out of range for U8");
    }

    return ok(`return ${numValue}`);
  }

  // Variable references (plain identifiers)
  if (isValidIdentifier(source)) {
    return err(`Variable '${source}' is not declared`);
  }

  return err("Invalid input");
};

const isValidIdentifier = (str: string): boolean => {
  if (str.length === 0) return false;
  if (str[0] >= "0" && str[0] <= "9") return false;
  return [...str].every((c) => isWordChar(c));
};

if (import.meta.main) {
  try {
    const tuffPath = join(process.cwd(), "main.tuff");
    const jsPath = join(process.cwd(), "main.js");
    const source = readFileSync(tuffPath, "utf8");
    const result = compile(source);

    if (result.ok) {
      const wrappedCode = `process.exit((() => {\n${result.value}\n})());`;
      writeFileSync(jsPath, wrappedCode);
      console.log(`Successfully compiled ${tuffPath} -> ${jsPath}`);
    } else {
      console.error("Compilation failed:", result.error);
      process.exit(1);
    }
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "ENOENT"
    ) {
      console.error("Error: main.tuff not found in current directory.");
    } else {
      console.error("Unexpected error during compilation:", err);
    }
    process.exit(1);
  }
}
