/*
When working with this error, ensure that the content of the error actually applies to the situation
and is not just a fall-through.
*/
export interface CompileError {
  invalidSource: string;
  message: string;
  reason: string;
  fix: string;
}

export interface Ok<T> {
  type: "ok";
  value: T;
}

export interface Err<X> {
  type: "err";
  error: X;
}
export type Result<T, X> = Ok<T> | Err<X>;

type TypedExpr = { expr: string; suffix: string; value: bigint | null };

function errResult<T>(error: CompileError): Result<T, CompileError> {
  return {
    type: "err",
    error,
  };
}

function buildCompileError(
  invalidSource: string,
  message: string,
  reason: string,
  fix: string,
): CompileError {
  return {
    invalidSource,
    message,
    reason,
    fix,
  };
}

function buildSyntaxError(
  invalidSource: string,
  reason: string,
  fix: string,
  message = "Invalid Tuff syntax.",
): CompileError {
  return buildCompileError(invalidSource, message, reason, fix);
}

function buildTypeError(
  invalidSource: string,
  reason: string,
  fix: string,
  message = "Type mismatch in Tuff program.",
): CompileError {
  return buildCompileError(invalidSource, message, reason, fix);
}

function buildSemanticError(
  invalidSource: string,
  reason: string,
  fix: string,
  message = "Invalid program semantics.",
): CompileError {
  return buildCompileError(invalidSource, message, reason, fix);
}

function buildRangeError(
  invalidSource: string,
  reason: string,
  fix: string,
  message = "Integer literal is out of range.",
): CompileError {
  return buildCompileError(invalidSource, message, reason, fix);
}

function checkIntegerRange(
  value: bigint,
  suffix: string,
  source: string,
): Result<null, CompileError> {
  const bitSize = Number(suffix.slice(1));
  const isUnsigned = suffix.startsWith("U");
  const min = isUnsigned ? 0n : -(2n ** BigInt(bitSize - 1));
  const max = isUnsigned
    ? 2n ** BigInt(bitSize) - 1n
    : 2n ** BigInt(bitSize - 1) - 1n;

  if (value < min || value > max) {
    const signedness = isUnsigned ? "Unsigned" : "Signed";
    return errResult(
      buildRangeError(
        source,
        `${value} does not fit in ${suffix}. ${signedness} ${suffix} values must be between ${min} and ${max}.`,
        `Use a value between ${min} and ${max} for ${suffix} literals.`,
      ),
    );
  }

  return { type: "ok", value: null };
}

function normalizeTypeName(typeName: string): string {
  return typeName.replace(/\s+/g, "");
}

function parseIntegerType(suffix: string): { signed: boolean; bits: number } {
  const signed = suffix.startsWith("I");
  const bits = Number(suffix.slice(1));
  return { signed, bits };
}

function isPointerType(typeName: string): boolean {
  return typeName.startsWith("*mut") || typeName.startsWith("*");
}

function getPointeeType(pointerType: string): string {
  if (pointerType.startsWith("*mut")) {
    return pointerType.slice("*mut".length);
  }
  if (pointerType.startsWith("*")) {
    return pointerType.slice(1);
  }
  return "";
}

function isAssignable(sourceSuffix: string, targetSuffix: string): boolean {
  sourceSuffix = normalizeTypeName(sourceSuffix);
  targetSuffix = normalizeTypeName(targetSuffix);

  if (sourceSuffix === targetSuffix) {
    return true;
  }

  const sourceIsPointer = isPointerType(sourceSuffix);
  const targetIsPointer = isPointerType(targetSuffix);

  if (sourceIsPointer || targetIsPointer) {
    if (!sourceIsPointer || !targetIsPointer) {
      return false;
    }

    // Pointer assignment requires exact pointer type match (including mutability).
    return sourceSuffix === targetSuffix;
  }

  const sourceType = parseIntegerType(sourceSuffix);
  const targetType = parseIntegerType(targetSuffix);

  if (sourceType.signed === targetType.signed) {
    return sourceType.bits <= targetType.bits;
  }

  if (!sourceType.signed && targetType.signed) {
    return sourceType.bits < targetType.bits;
  }

  return false;
}

function normalizeNumericToken(
  token: string,
  source: string,
): Result<{ text: string; suffix: string }, CompileError> {
  const normalized = token.trim();
  const typedIntegerSyntaxError = (
    reason: string,
    fix: string,
    message: string,
  ): Result<{ text: string; suffix: string }, CompileError> =>
    errResult(buildSyntaxError(source, reason, fix, message));

  const numericSuffixMatch = normalized.match(
    /^([-+]?[0-9]+(?:\.[0-9]+)?)(U8|U16|U32|U64|I8|I16|I32|I64)?$/,
  );

  if (!numericSuffixMatch) {
    return typedIntegerSyntaxError(
      `Could not parse ${JSON.stringify(normalized)} as a numeric literal or typed integer literal.`,
      "Use an integer like 42 or a suffixed integer like 42U8.",
      "Invalid numeric literal.",
    );
  }

  const numericText = numericSuffixMatch[1] ?? "";
  const suffix = numericSuffixMatch[2] ?? "";

  if (suffix) {
    if (numericText.includes(".")) {
      return typedIntegerSyntaxError(
        `The literal ${JSON.stringify(normalized)} uses an integer width suffix with a decimal value.`,
        "Integer width suffixes require integer literals without decimal points.",
        "Typed integer literal must be an integer.",
      );
    }

    let value: bigint;
    try {
      value = BigInt(numericText);
    } catch {
      return typedIntegerSyntaxError(
        `The literal ${JSON.stringify(normalized)} is not a valid base-10 integer.`,
        "Use a valid integer literal.",
        "Invalid integer literal.",
      );
    }

    const rangeCheck = checkIntegerRange(value, suffix, source);
    if (rangeCheck.type === "err") {
      return rangeCheck;
    }
  }

  return {
    type: "ok",
    value: { text: numericText, suffix },
  };
}

export function compileTuffToTS(
  tuffSource: string,
): Result<string, CompileError> {
  const trimmedSource = tuffSource.trim();
  const firstStatement = trimmedSource.split(";")[0]?.trim() ?? "";
  const looksLikeStatementProgram =
    trimmedSource.includes(";") ||
    firstStatement.startsWith("let ") ||
    /^[A-Za-z_]\w*\s*=/.test(firstStatement) ||
    /^\*[A-Za-z_]\w*\s*=/.test(firstStatement);

  if (trimmedSource === "") {
    return {
      type: "ok",
      value: "return 0;",
    };
  }

  const statements: string[] = trimmedSource
    .split(";")
    .map((s) => s.trim())
    .filter((s): s is string => s.length > 0);

  const declaredVars = new Set<string>();
  const varTypes = new Map<string, string>();
  const varMutability = new Map<string, boolean>();

  function resolveVarRef(
    name: string,
  ): Result<{ expr: string; suffix: string }, CompileError> {
    if (!/^[A-Za-z_]\w*$/.test(name) || !declaredVars.has(name)) {
      return {
        type: "err",
        error: buildSemanticError(
          tuffSource,
          `The variable ${name} is used before it is declared. Tuff requires variables to be declared with let before use.`,
          `Declare ${name} with let before using it, or correct the variable name.`,
          "Use of undeclared variable.",
        ),
      };
    }

    return {
      type: "ok",
      value: {
        expr: name,
        suffix: varTypes.get(name) ?? "I32",
      },
    };
  }

  function withResolvedVar(
    name: string,
    cb: (
      varType: string,
    ) => Result<{ expr: string; suffix: string }, CompileError>,
  ): Result<{ expr: string; suffix: string }, CompileError> {
    const variable = resolveVarRef(name);
    if (variable.type === "err") return variable;
    return cb(variable.value.suffix);
  }

  function resolveAddressOf(
    name: string,
    mutable = false,
  ): Result<{ expr: string; suffix: string }, CompileError> {
    if (mutable && !varMutability.get(name)) {
      return {
        type: "err",
        error: buildTypeError(
          tuffSource,
          `Cannot take a mutable reference to ${name} because it was not declared with mut.`,
          `Declare ${name} as let mut ${name} = ... before taking &mut ${name}.`,
          "Mutable reference requires a mutable variable.",
        ),
      };
    }

    return withResolvedVar(name, (innerType) => {
      const pointerType = mutable ? `*mut${innerType}` : `*${innerType}`;
      return {
        type: "ok",
        value: {
          expr: `(function(){return {get:()=>${name}, set:(v)=>{${name}=v}}})()`,
          suffix: pointerType,
        },
      };
    });
  }

  function toTypedResult(
    res: Result<{ expr: string; suffix: string }, CompileError>,
  ): Result<TypedExpr, CompileError> {
    if (res.type === "err") return res;
    return {
      type: "ok",
      value: {
        expr: res.value.expr,
        suffix: res.value.suffix,
        value: null,
      },
    };
  }

  function parseVariableNameInFactor(): Result<string, CompileError> {
    const variableMatch = sourceNoSpaces.slice(pos).match(/^([A-Za-z_]\w*)/);
    if (!variableMatch) {
      return {
        type: "err",
        error: buildSyntaxError(
          tuffSource,
          "A variable name was expected after & or * but none was found.",
          "Add a valid identifier after the operator, such as &x or *ptr.",
          "Expected a variable name.",
        ),
      };
    }
    const name = variableMatch[1]!;
    pos += name.length;
    return { type: "ok", value: name };
  }

  function resolveDereference(
    name: string,
  ): Result<{ expr: string; suffix: string }, CompileError> {
    return withResolvedVar(name, (sourceType) => {
      if (!isPointerType(sourceType)) {
        return {
          type: "err",
          error: buildTypeError(
            tuffSource,
            `Cannot dereference ${name} because its type is ${sourceType}, not a pointer type.`,
            `Take the address of a variable first, or dereference only values of type *T or *mut T.`,
            "Dereference requires a pointer.",
          ),
        };
      }

      const derefType = getPointeeType(sourceType);

      return {
        type: "ok",
        value: {
          expr: `${name}.get()`,
          suffix: derefType,
        },
      };
    });
  }

  if (statements.length > 0 && looksLikeStatementProgram) {
    const statementRegex =
      /^let\s+(mut\s+)?([A-Za-z_]\w*)\s*(?::\s*([*]?(?:mut\s+)?(?:U8|U16|U32|U64|I8|I16|I32|I64)))?\s*=\s*(.+)$/;
    const assignmentRegex = /^([A-Za-z_]\w*)\s*=\s*(.+)$/;
    const derefAssignmentRegex = /^\*([A-Za-z_]\w*)\s*=\s*(.+)$/;
    let compiledStatements = "";

    function resolveRhsExpression(
      rhsSource: string,
    ): Result<{ expr: string; suffix: string }, CompileError> {
      const trimmedRhs = rhsSource.trim();

      if (trimmedRhs.startsWith("&mut ")) {
        const inner = trimmedRhs.slice("&mut ".length).trim();
        return resolveAddressOf(inner, true);
      }

      if (trimmedRhs.startsWith("&")) {
        const inner = trimmedRhs.slice(1).trim();
        return resolveAddressOf(inner, false);
      }

      if (trimmedRhs.startsWith("*")) {
        const inner = trimmedRhs.slice(1).trim();
        return resolveDereference(inner);
      }

      if (/^[A-Za-z_]\w*$/.test(trimmedRhs)) {
        return resolveVarRef(trimmedRhs);
      }

      const rhsCompile = compileTuffToTS(trimmedRhs);
      if (rhsCompile.type === "err") {
        return rhsCompile;
      }

      const rhsExpr = rhsCompile.value
        .replace(/^return\s+/, "")
        .replace(/;$/, "");

      let rhsSuffix = "";
      const readMatch = trimmedRhs.match(
        /^read<(U8|U16|U32|U64|I8|I16|I32|I64)>\(\)$/,
      );
      if (readMatch) {
        rhsSuffix = readMatch[1] ?? "";
      } else {
        const normalizedRhs = normalizeNumericToken(trimmedRhs, tuffSource);
        rhsSuffix =
          normalizedRhs.type === "ok" ? normalizedRhs.value.suffix : "";
      }

      return {
        type: "ok",
        value: {
          expr: rhsExpr,
          suffix: rhsSuffix,
        },
      };
    }

    function resolveAndCheckRhs(
      rhsSource: string,
      targetType: string,
    ): Result<{ expr: string; suffix: string }, CompileError> {
      const rhsResolve = resolveRhsExpression(rhsSource);
      if (rhsResolve.type === "err") {
        return rhsResolve;
      }

      const rhsExpr = rhsResolve.value.expr;
      const rhsSuffix = rhsResolve.value.suffix;

      if (targetType && rhsSuffix && !isAssignable(rhsSuffix, targetType)) {
        return {
          type: "err",
          error: buildTypeError(
            tuffSource,
            `The right-hand side has type ${rhsSuffix}, which is not assignable to ${targetType}. Tuff only allows compatible integer widening or exactly matching pointer types.`,
            `Change the expression type to ${targetType}, or change the target declaration to a compatible type.`,
            "Assignment type mismatch.",
          ),
        };
      }

      return {
        type: "ok",
        value: {
          expr: rhsExpr,
          suffix: rhsSuffix,
        },
      };
    }

    for (let i = 0; i < statements.length; i++) {
      const isLast = i === statements.length - 1;
      const statement = statements[i]!;

      if (statement.startsWith("let ")) {
        const statementMatch = statement.match(statementRegex);
        if (!statementMatch) {
          return {
            type: "err",
            error: buildSyntaxError(
              tuffSource,
              "The let statement does not match the supported form `let [mut] name [: Type] = value`.",
              "Rewrite the declaration using `let`, an identifier, an optional type, and an initializer.",
              "Invalid let statement.",
            ),
          };
        }

        const isMutable = !!statementMatch[1];
        const varName = statementMatch[2] ?? "";
        const typeName = normalizeTypeName(statementMatch[3] ?? "");
        const rhsSource = (statementMatch[4] ?? "").trim();

        if (!varName) {
          return {
            type: "err",
            error: buildSyntaxError(
              tuffSource,
              "The let statement is missing a valid variable name.",
              "Use an identifier that starts with a letter or underscore.",
              "Invalid variable name.",
            ),
          };
        }

        if (declaredVars.has(varName)) {
          return {
            type: "err",
            error: buildSemanticError(
              tuffSource,
              `${varName} is declared more than once in the same scope. Tuff does not allow duplicate let bindings.`,
              `Rename one of the variables or reuse the existing ${varName} binding.`,
              "Duplicate variable declaration.",
            ),
          };
        }

        const rhsResolve = resolveAndCheckRhs(rhsSource, typeName);
        if (rhsResolve.type === "err") {
          return rhsResolve;
        }

        const rhsExpr = rhsResolve.value.expr;
        const rhsType = rhsResolve.value.suffix || "I32";

        if (typeName === "") {
          varTypes.set(varName, rhsType);
        } else if (typeName) {
          varTypes.set(varName, typeName);
        }

        declaredVars.add(varName);
        varMutability.set(varName, isMutable);

        compiledStatements += `let ${varName} = ${rhsExpr};`;

        if (isLast) {
          // If this is the only statement and no expression after let, return 0.
          if (statements.length === 1) {
            compiledStatements += "return 0;";
          }
        }
      } else if (derefAssignmentRegex.test(statement)) {
        const derefAssignmentMatch =
          statement.match(derefAssignmentRegex) ?? [];
        const targetVar = derefAssignmentMatch[1] ?? "";
        const rhsSource = (derefAssignmentMatch[2] ?? "").trim();

        const targetResolve = resolveVarRef(targetVar);
        if (targetResolve.type === "err") {
          return targetResolve;
        }

        const pointerType = varTypes.get(targetVar) ?? "";
        if (!pointerType.startsWith("*mut")) {
          return {
            type: "err",
            error: buildTypeError(
              tuffSource,
              `Cannot assign through ${targetVar} because its type ${pointerType || "<unknown>"} is not a mutable pointer.`,
              `Declare ${targetVar} as a *mut pointer or take a mutable reference with &mut before writing through it.`,
              "Assignment through pointer requires *mut.",
            ),
          };
        }

        const pointeeType = getPointeeType(pointerType);
        const rhsResolve = resolveAndCheckRhs(rhsSource, pointeeType);
        if (rhsResolve.type === "err") {
          return rhsResolve;
        }

        compiledStatements += `${targetVar}.set(${rhsResolve.value.expr});`;

        if (isLast) {
          compiledStatements += `return ${targetVar}.get();`;
        }
      } else if (assignmentRegex.test(statement)) {
        const assignmentMatch = statement.match(assignmentRegex) ?? [];
        const targetVar = assignmentMatch[1] ?? "";
        const rhsSource = (assignmentMatch[2] ?? "").trim();

        const targetResolve = resolveVarRef(targetVar);
        if (targetResolve.type === "err") {
          return targetResolve;
        }

        if (!varMutability.get(targetVar)) {
          return {
            type: "err",
            error: buildSemanticError(
              tuffSource,
              `${targetVar} was declared without mut, so it cannot be reassigned.`,
              `Change the declaration to let mut ${targetVar} = ... if reassignment is intended.`,
              "Cannot assign to immutable variable.",
            ),
          };
        }

        const targetType = varTypes.get(targetVar) ?? "";
        const rhsResolve = resolveAndCheckRhs(rhsSource, targetType);
        if (rhsResolve.type === "err") {
          return rhsResolve;
        }

        const rhsExpr = rhsResolve.value.expr;

        compiledStatements += `${targetVar} = ${rhsExpr};`;

        if (isLast) {
          compiledStatements += `return ${targetVar};`;
        }
      } else {
        if (!isLast) {
          return {
            type: "err",
            error: buildSyntaxError(
              tuffSource,
              "A bare value expression appeared before the end of the program. Only the final statement may produce the program result.",
              "Move the expression to the end, or bind it to a variable with let.",
              "Non-final value expression is not allowed.",
            ),
          };
        }

        const exprResolve = resolveRhsExpression(statement);
        if (exprResolve.type === "err") {
          return exprResolve;
        }

        compiledStatements += `return ${exprResolve.value.expr};`;
      }
    }

    return {
      type: "ok",
      value: compiledStatements,
    };
  }

  // Arithmetic support: +, -, * with precedence.
  const sourceNoSpaces = trimmedSource.replace(/\s+/g, "");

  let pos = 0;
  function parseNumber(): Result<
    { expr: string; suffix: string; value: bigint },
    CompileError
  > {
    const match = sourceNoSpaces
      .slice(pos)
      .match(/^([+-]?[0-9]+(?:\.[0-9]+)?(?:U8|U16|U32|U64|I8|I16|I32|I64)?)/);
    if (!match || !match[1]) {
      return {
        type: "err",
        error: buildSyntaxError(
          tuffSource,
          "The parser expected a numeric literal, parenthesized expression, variable, pointer operation, or read<T>() call.",
          "Check the expression syntax near the failing token.",
          "Unexpected token in expression.",
        ),
      };
    }

    const token = match[1];
    pos += token.length;

    const normalized = normalizeNumericToken(token, tuffSource);
    if (normalized.type === "err") return normalized;

    return {
      type: "ok",
      value: {
        expr: normalized.value.text,
        suffix: normalized.value.suffix,
        value: BigInt(normalized.value.text),
      },
    };
  }

  function parseFactor(): Result<TypedExpr, CompileError> {
    if (sourceNoSpaces.slice(pos).startsWith("&mut")) {
      pos += 4;
      const nameResult = parseVariableNameInFactor();
      if (nameResult.type === "err") return nameResult;
      const result = resolveAddressOf(nameResult.value, true);
      if (result.type === "err") return result;
      return toTypedResult(result);
    }

    if (sourceNoSpaces.slice(pos).startsWith("&")) {
      pos += 1;
      const nameResult = parseVariableNameInFactor();
      if (nameResult.type === "err") return nameResult;
      const result = resolveAddressOf(nameResult.value);
      if (result.type === "err") return result;
      return toTypedResult(result);
    }

    if (sourceNoSpaces.slice(pos).startsWith("*")) {
      pos += 1;
      const nameResult = parseVariableNameInFactor();
      if (nameResult.type === "err") return nameResult;
      const result = resolveDereference(nameResult.value);
      if (result.type === "err") return result;
      return toTypedResult(result);
    }

    const readMatch = sourceNoSpaces
      .slice(pos)
      .match(/^read<(U8|U16|U32|U64|I8|I16|I32|I64)>\(\)/);
    if (readMatch) {
      const readType = readMatch[1]!;
      pos += readMatch[0].length;
      return {
        type: "ok",
        value: {
          expr: `read("${readType}")`,
          suffix: readType,
          value: null,
        },
      };
    }

    if (pos < sourceNoSpaces.length && sourceNoSpaces[pos] === "(") {
      pos += 1;
      const inner = parseExpression();
      if (inner.type === "err") return inner;

      if (pos >= sourceNoSpaces.length || sourceNoSpaces[pos] !== ")") {
        return {
          type: "err",
          error: buildSyntaxError(
            tuffSource,
            "An opening parenthesis does not have a matching closing parenthesis.",
            "Add the missing closing parenthesis to complete the expression.",
            "Unmatched parenthesis.",
          ),
        };
      }

      pos += 1;
      return {
        type: "ok",
        value: {
          expr: `(${inner.value.expr})`,
          suffix: inner.value.suffix,
          value: inner.value.value,
        },
      };
    }

    const variableMatch = sourceNoSpaces.slice(pos).match(/^([A-Za-z_]\w*)/);
    if (variableMatch) {
      const name = variableMatch[1]!;
      pos += name.length;
      return {
        type: "ok",
        value: {
          expr: name,
          suffix: varTypes.get(name) ?? "",
          value: 0n,
        },
      };
    }

    return parseNumber();
  }

  function sameSuffix(leftSuffix: string, rightSuffix: string): string {
    return leftSuffix && leftSuffix === rightSuffix ? leftSuffix : "";
  }

  function combineBinary(
    left: TypedExpr,
    right: TypedExpr,
    op: string,
  ): TypedExpr {
    const suffix = sameSuffix(left.suffix, right.suffix);
    let value: bigint | null = null;

    if (left.value !== null && right.value !== null) {
      value =
        op === "+"
          ? left.value + right.value
          : op === "-"
            ? left.value - right.value
            : op === "*"
              ? left.value * right.value
              : op === "%"
                ? left.value % right.value
                : left.value / right.value;
    }

    return {
      expr: `${left.expr}${op}${right.expr}`,
      suffix,
      value,
    };
  }

  function parseBinaryExpression(
    parseOperand: () => Result<TypedExpr, CompileError>,
    validOps: Set<string>,
  ): Result<TypedExpr, CompileError> {
    let left = parseOperand();
    if (left.type === "err") return left;

    while (pos < sourceNoSpaces.length) {
      const currentOp = sourceNoSpaces[pos];
      if (!currentOp || !validOps.has(currentOp)) break;
      const op = currentOp;
      pos += 1;
      const right = parseOperand();
      if (right.type === "err") return right;

      const leftVal = left.value as {
        expr: string;
        suffix: string;
        value: bigint;
      };
      const rightVal = right.value as {
        expr: string;
        suffix: string;
        value: bigint;
      };

      left = {
        type: "ok",
        value: combineBinary(leftVal, rightVal, op),
      };
    }

    return left;
  }

  function parseTerm(): Result<TypedExpr, CompileError> {
    return parseBinaryExpression(parseFactor, new Set(["*", "/", "%"]));
  }

  function parseExpression(): Result<TypedExpr, CompileError> {
    return parseBinaryExpression(parseTerm, new Set(["+", "-"]));
  }

  const parsed = parseExpression();
  if (parsed.type === "ok" && pos === sourceNoSpaces.length) {
    if (parsed.value.suffix.startsWith("*")) {
      return { type: "ok", value: `return ${parsed.value.expr};` };
    }

    if (parsed.value.suffix && parsed.value.value !== null) {
      const rangeCheck = checkIntegerRange(
        parsed.value.value,
        parsed.value.suffix,
        tuffSource,
      );
      if (rangeCheck.type === "err") {
        return rangeCheck;
      }
      return { type: "ok", value: `return ${parsed.value.value.toString()};` };
    }

    return { type: "ok", value: `return ${parsed.value.expr};` };
  }

  if (parsed.type === "err") {
    return parsed;
  }

  // Literal numeric expressions are currently supported by normalizer.
  const normalized = normalizeNumericToken(trimmedSource, tuffSource);
  if (normalized.type === "ok") {
    return {
      type: "ok",
      value: `return ${normalized.value.text};`,
    };
  }

  return normalized;
}
