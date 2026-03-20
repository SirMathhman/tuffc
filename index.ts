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
    return parseNumber();
  }

  function sameSuffix(leftSuffix: string, rightSuffix: string): string {
    return leftSuffix && leftSuffix === rightSuffix ? leftSuffix : "";
  }

  function combineBinary(
    left: { expr: string; suffix: string; value: bigint } | any,
    right: { expr: string; suffix: string; value: bigint } | any,
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
