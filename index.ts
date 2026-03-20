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

function buildCompileError(
  invalidSource: string,
  reason: string,
  fix: string,
): CompileError {
  return {
    invalidSource,
    message: "Compilation failed",
    reason,
    fix,
  };
}

function checkIntegerRange(
  value: bigint,
  suffix: string,
  source: string,
): Result<null, CompileError> {
  const bitSize = Number(suffix.slice(1));
  if (suffix.startsWith("U")) {
    const max = 2n ** BigInt(bitSize) - 1n;
    if (value < 0n || value > max) {
      return {
        type: "err",
        error: buildCompileError(
          source,
          "Value out of range for unsigned integer",
          `Use a value between 0 and ${max} for ${suffix} literals.`,
        ),
      };
    }
  } else {
    const min = -(2n ** BigInt(bitSize - 1));
    const max = 2n ** BigInt(bitSize - 1) - 1n;
    if (value < min || value > max) {
      return {
        type: "err",
        error: buildCompileError(
          source,
          "Value out of range for signed integer",
          `Use a value between ${min} and ${max} for ${suffix} literals.`,
        ),
      };
    }
  }

  return { type: "ok", value: null };
}

function parseIntegerType(suffix: string): { signed: boolean; bits: number } {
  const signed = suffix.startsWith("I");
  const bits = Number(suffix.slice(1));
  return { signed, bits };
}

function isAssignable(sourceSuffix: string, targetSuffix: string): boolean {
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
  const numericSuffixMatch = normalized.match(
    /^([-+]?[0-9]+(?:\.[0-9]+)?)(U8|U16|U32|U64|I8|I16|I32|I64)?$/,
  );

  if (!numericSuffixMatch) {
    return {
      type: "err",
      error: buildCompileError(
        source,
        "Syntax error",
        "Check the syntax of your Tuff code and try again.",
      ),
    };
  }

  const numericText = numericSuffixMatch[1] ?? "";
  const suffix = numericSuffixMatch[2] ?? "";

  if (suffix) {
    if (numericText.includes(".")) {
      return {
        type: "err",
        error: buildCompileError(
          source,
          "Syntax error",
          "Integer width suffixes require integer literals without decimal points.",
        ),
      };
    }

    let value: bigint;
    try {
      value = BigInt(numericText);
    } catch {
      return {
        type: "err",
        error: buildCompileError(
          source,
          "Syntax error",
          "Use a valid integer literal.",
        ),
      };
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

  if (statements.length > 0 && statements[0]?.startsWith("let ")) {
    const statementRegex =
      /^let\s+(mut\s+)?([A-Za-z_]\w*)\s*(?::\s*(U8|U16|U32|U64|I8|I16|I32|I64))?\s*=\s*(.+)$/;
    const assignmentRegex = /^([A-Za-z_]\w*)\s*=\s*(.+)$/;
    let compiledStatements = "";
    const declaredVars = new Set<string>();
    const varTypes = new Map<string, string>();
    const varMutability = new Map<string, boolean>();

    function resolveRhsExpression(
      rhsSource: string,
    ): Result<{ expr: string; suffix: string }, CompileError> {
      if (/^[A-Za-z_]\w*$/.test(rhsSource)) {
        return {
          type: "ok",
          value: {
            expr: rhsSource,
            suffix: varTypes.get(rhsSource) ?? "",
          },
        };
      }

      const rhsCompile = compileTuffToTS(rhsSource);
      if (rhsCompile.type === "err") {
        return rhsCompile;
      }

      const rhsExpr = rhsCompile.value
        .replace(/^return\s+/, "")
        .replace(/;$/, "");

      let rhsSuffix = "";
      const readMatch = rhsSource.match(
        /^read<(U8|U16|U32|U64|I8|I16|I32|I64)>\(\)$/,
      );
      if (readMatch) {
        rhsSuffix = readMatch[1] ?? "";
      } else {
        const normalizedRhs = normalizeNumericToken(rhsSource, tuffSource);
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
          error: buildCompileError(
            tuffSource,
            "Type error",
            `Cannot assign ${rhsSuffix} to ${targetType}.`,
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
            error: buildCompileError(
              tuffSource,
              "Syntax error",
              "Invalid let statement syntax.",
            ),
          };
        }

        const isMutable = !!statementMatch[1];
        const varName = statementMatch[2] ?? "";
        const typeName = statementMatch[3] ?? "";
        const rhsSource = (statementMatch[4] ?? "").trim();

        if (!varName) {
          return {
            type: "err",
            error: buildCompileError(
              tuffSource,
              "Syntax error",
              "Invalid variable name in let statement.",
            ),
          };
        }

        if (declaredVars.has(varName)) {
          return {
            type: "err",
            error: buildCompileError(
              tuffSource,
              "Semantic error",
              `Duplicate variable declaration: ${varName}`,
            ),
          };
        }

        const rhsResolve = resolveAndCheckRhs(rhsSource, typeName);
        if (rhsResolve.type === "err") {
          return rhsResolve;
        }

        const rhsExpr = rhsResolve.value.expr;
        const rhsType = rhsResolve.value.suffix;

        if (typeName === "" && rhsType) {
          // infer type from RHS when not explicitly provided
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
      } else if (assignmentRegex.test(statement)) {
        const assignmentMatch = statement.match(assignmentRegex) ?? [];
        const targetVar = assignmentMatch[1] ?? "";
        const rhsSource = (assignmentMatch[2] ?? "").trim();

        if (!declaredVars.has(targetVar)) {
          return {
            type: "err",
            error: buildCompileError(
              tuffSource,
              "Semantic error",
              `Undeclared variable: ${targetVar}`,
            ),
          };
        }

        if (!varMutability.get(targetVar)) {
          return {
            type: "err",
            error: buildCompileError(
              tuffSource,
              "Semantic error",
              `Cannot assign to immutable variable: ${targetVar}`,
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
            error: buildCompileError(
              tuffSource,
              "Syntax error",
              "Only the last statement may be a value expression.",
            ),
          };
        }

        if (/^[A-Za-z_]\w*$/.test(statement)) {
          compiledStatements += `return ${statement};`;
        } else {
          const exprCompile = compileTuffToTS(statement);
          if (exprCompile.type === "err") {
            return exprCompile;
          }

          const expr = exprCompile.value
            .replace(/^return\s+/, "")
            .replace(/;$/, "");
          compiledStatements += `return ${expr};`;
        }
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
        error: buildCompileError(
          tuffSource,
          "Syntax error",
          "Check the syntax of your Tuff code and try again.",
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

  function parseFactor(): Result<
    { expr: string; suffix: string; value: bigint },
    CompileError
  > {
    const readMatch = sourceNoSpaces
      .slice(pos)
      .match(/^read<(U8|U16|U32|U64|I8|I16|I32|I64)>\(\)/);
    if (readMatch) {
      const readType = readMatch[1];
      pos += readMatch[0].length;
      return {
        type: "ok",
        value: {
          expr: `read("${readType}")`,
          suffix: "",
          value: 0n,
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
          error: buildCompileError(
            tuffSource,
            "Syntax error",
            "Unmatched parenthesis in expression.",
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
          suffix: "",
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
    left: { expr: string; suffix: string; value: bigint },
    right: { expr: string; suffix: string; value: bigint },
    op: string,
  ): { expr: string; suffix: string; value: bigint } {
    const suffix = sameSuffix(left.suffix, right.suffix);
    const value: bigint =
      op === "+"
        ? left.value + right.value
        : op === "-"
          ? left.value - right.value
          : op === "*"
            ? left.value * right.value
            : op === "%"
              ? left.value % right.value
              : left.value / right.value;

    return {
      expr: `${left.expr}${op}${right.expr}`,
      suffix,
      value,
    };
  }

  function parseBinaryExpression(
    parseOperand: () => Result<
      { expr: string; suffix: string; value: bigint },
      CompileError
    >,
    validOps: Set<string>,
  ): Result<{ expr: string; suffix: string; value: bigint }, CompileError> {
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

  function parseTerm(): Result<
    { expr: string; suffix: string; value: bigint },
    CompileError
  > {
    return parseBinaryExpression(parseFactor, new Set(["*", "/", "%"]));
  }

  function parseExpression(): Result<
    { expr: string; suffix: string; value: bigint },
    CompileError
  > {
    return parseBinaryExpression(parseTerm, new Set(["+", "-"]));
  }

  const parsed = parseExpression();
  if (parsed.type === "ok" && pos === sourceNoSpaces.length) {
    if (parsed.value.suffix) {
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
