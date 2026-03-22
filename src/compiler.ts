import { ESLint } from "eslint";
import ts from "typescript";
import { resolve } from "path";

interface NumericRange {
  min: bigint;
  max: bigint;
}

interface OkResult<T> {
  isOk: true;
  value: T;
}

interface ErrResult<X> {
  isOk: false;
  error: X;
}

export type Result<T, X> = OkResult<T> | ErrResult<X>;

function ok<T>(value: T): Result<T, never> {
  return { isOk: true, value };
}

function err<X>(error: X): Result<never, X> {
  return { isOk: false, error };
}

const TYPE_RANGES = new Map<string, NumericRange>([
  ["U8", { min: 0n, max: 255n }],
  ["U16", { min: 0n, max: 65535n }],
  ["U32", { min: 0n, max: 4294967295n }],
  ["U64", { min: 0n, max: 18446744073709551615n }],
  ["I8", { min: -128n, max: 127n }],
  ["I16", { min: -32768n, max: 32767n }],
  ["I32", { min: -2147483648n, max: 2147483647n }],
  ["I64", { min: -9223372036854775808n, max: 9223372036854775807n }],
]);

const TYPE_SUFFIXES = ["U64", "U32", "U16", "U8", "I64", "I32", "I16", "I8"];
const READ_U8_CALL = "read<U8>()";
const OPERATOR_CHARS = ["+", "-", "*", "/"];

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function consumeWhitespace(source: string, start: number): number {
  let i = start;
  while (i < source.length && isWhitespace(source[i]!)) {
    i++;
  }
  return i;
}

function startsWithAt(source: string, start: number, value: string): boolean {
  return source.slice(start, start + value.length) === value;
}

function isOperatorChar(ch: string): boolean {
  return OPERATOR_CHARS.includes(ch);
}

function operatorPrecedence(op: string): number {
  if (op === "+" || op === "-") return 1;
  if (op === "*" || op === "/") return 2;
  return 0;
}

interface ParseTermResult {
  termJs: string;
  nextIndex: number;
  usesRead: boolean;
}

interface CompileExpressionResult {
  expressionJs: string;
  usesRead: boolean;
}

function parseTermAt(
  source: string,
  start: number,
): Result<ParseTermResult | undefined, string> {
  const i = consumeWhitespace(source, start);
  if (i >= source.length) return ok(undefined);

  if (startsWithAt(source, i, READ_U8_CALL)) {
    return ok({
      termJs: "__readU8()",
      nextIndex: i + READ_U8_CALL.length,
      usesRead: true,
    });
  }

  let j = i;
  if (source[j] === "-" && j + 1 < source.length && isDigit(source[j + 1]!)) {
    j++;
  }
  while (
    j < source.length &&
    !isWhitespace(source[j]!) &&
    !isOperatorChar(source[j]!)
  ) {
    j++;
  }
  if (j === i) {
    return ok(undefined);
  }

  const token = source.slice(i, j);
  const parsedLiteral = parseIntegerLiteral(token);
  if (!parsedLiteral.isOk) {
    return parsedLiteral;
  }
  if (parsedLiteral.value === undefined) {
    return err(`Invalid term: ${token}`);
  }

  return ok({
    termJs: parsedLiteral.value,
    nextIndex: j,
    usesRead: false,
  });
}

function toPostfix(
  terms: string[],
  operators: string[],
): Result<string[], string> {
  const output: string[] = [];
  const opStack: string[] = [];

  for (let i = 0; i < terms.length; i++) {
    output.push(terms[i]!);
    if (i >= operators.length) continue;

    const op = operators[i]!;
    while (opStack.length > 0) {
      const top = opStack[opStack.length - 1]!;
      if (operatorPrecedence(top) < operatorPrecedence(op)) break;
      output.push(opStack.pop()!);
    }
    opStack.push(op);
  }

  while (opStack.length > 0) {
    output.push(opStack.pop()!);
  }

  return ok(output);
}

function postfixToJs(postfix: string[]): Result<string, string> {
  const stack: string[] = [];

  for (let i = 0; i < postfix.length; i++) {
    const token = postfix[i]!;
    if (!isOperatorChar(token)) {
      stack.push(token);
      continue;
    }

    if (stack.length < 2) {
      return err("Invalid expression structure");
    }

    const right = stack.pop()!;
    const left = stack.pop()!;
    if (token === "/") {
      stack.push(`Math.trunc(${left} / ${right})`);
    } else {
      stack.push(`(${left} ${token} ${right})`);
    }
  }

  if (stack.length !== 1) {
    return err("Invalid expression structure");
  }

  return ok(stack[0]!);
}

function compileArithmeticExpression(
  source: string,
): Result<CompileExpressionResult | undefined, string> {
  let i = 0;
  let expectingTerm = true;
  const terms: string[] = [];
  const operators: string[] = [];
  let usesRead = false;

  while (i < source.length) {
    if (expectingTerm) {
      const parsedTerm = parseTermAt(source, i);
      if (!parsedTerm.isOk) {
        return parsedTerm;
      }
      if (parsedTerm.value === undefined) {
        if (terms.length === 0) return ok(undefined);
        return err("Expected a term");
      }

      terms.push(parsedTerm.value.termJs);
      if (parsedTerm.value.usesRead) {
        usesRead = true;
      }
      i = parsedTerm.value.nextIndex;
      expectingTerm = false;
      continue;
    }

    i = consumeWhitespace(source, i);
    if (i >= source.length) break;

    const op = source[i]!;
    if (!isOperatorChar(op)) {
      return err(`Expected operator at position ${i}`);
    }
    operators.push(op);
    i++;
    expectingTerm = true;
  }

  if (terms.length === 0) return ok(undefined);
  if (expectingTerm) return err("Expression cannot end with an operator");
  if (terms.length !== operators.length + 1) {
    return err("Invalid expression layout");
  }

  const postfix = toPostfix(terms, operators);
  if (!postfix.isOk) return postfix;

  const expressionJs = postfixToJs(postfix.value);
  if (!expressionJs.isOk) return expressionJs;

  return ok({ expressionJs: expressionJs.value, usesRead });
}

function buildExpressionProgram(
  expressionJs: string,
  usesRead: boolean,
): string {
  const lines: string[] = [];

  if (usesRead) {
    lines.push("const __tuffInput = process.env.TUFFC_STDIN ?? '';");
    lines.push("let __k = 0;");
    lines.push("function __nextToken() {");
    lines.push(
      "  while (__k < __tuffInput.length && __tuffInput[__k] === ' ') __k++;",
    );
    lines.push("  let __start = __k;");
    lines.push(
      "  while (__k < __tuffInput.length && __tuffInput[__k] !== ' ') __k++;",
    );
    lines.push("  return __tuffInput.slice(__start, __k);");
    lines.push("}");
    lines.push("function __readU8() {");
    lines.push("  return Number.parseInt(__nextToken(), 10);");
    lines.push("}");
  }

  lines.push(`process.exit(${expressionJs});`);
  return lines.join("\n");
}

// Returns Ok(digits) if source is a valid in-range integer literal,
// Ok(undefined) if source does not match the pattern,
// and Err(message) if pattern matches but value is out of range.
function parseIntegerLiteral(
  source: string,
): Result<string | undefined, string> {
  let i = 0;
  if (source[i] === "-") i++;
  const digitStart = i;
  while (i < source.length && isDigit(source[i]!)) {
    i++;
  }
  if (i === digitStart) return ok(undefined); // no digits

  const digits = source.slice(0, i);
  const suffix = source.slice(i);
  if (!TYPE_SUFFIXES.includes(suffix)) return ok(undefined);

  const range = TYPE_RANGES.get(suffix);
  if (!range) return ok(undefined);
  const value = BigInt(digits);
  if (value < range.min || value > range.max) {
    return err(
      `Value ${digits} is out of range for type ${suffix} (${range.min}–${range.max})`,
    );
  }
  return ok(digits);
}

export function compileTuffToTS(source: string): Result<string, string> {
  if (source === "") return ok("");

  const parsedExpression = compileArithmeticExpression(source);
  if (!parsedExpression.isOk) return parsedExpression;
  if (parsedExpression.value !== undefined) {
    return ok(
      buildExpressionProgram(
        parsedExpression.value.expressionJs,
        parsedExpression.value.usesRead,
      ),
    );
  }

  return err(`Unable to compile Tuff source: ${source}`);
}

function formatLintErrors(messages: string[]): string {
  return `ESLint validation failed:\n${messages.join("\n")}`;
}

export async function executeTuff(source: string, stdIn = ""): Promise<number> {
  const compileResult = compileTuffToTS(source);
  if (!compileResult.isOk) {
    return 1;
  }
  const tsCode = compileResult.value;

  // Validate generated TypeScript with ESLint
  const eslint = new ESLint({
    overrideConfigFile: resolve(import.meta.dir, "..", "eslint.config.js"),
    overrideConfig: [
      {
        languageOptions: {
          parserOptions: { project: false },
        },
      },
    ],
  });
  const results = await eslint.lintText(tsCode, {
    filePath: "src/generated.ts",
  });
  const errors = results.flatMap((r) =>
    r.messages.filter((m) => m.severity === 2),
  );
  if (errors.length > 0) {
    const errorMessages = errors.map(
      (e) => `  ${e.line}:${e.column}  ${e.message}  (${e.ruleId})`,
    );
    void formatLintErrors(errorMessages);
    return 1;
  }

  // Compile TypeScript to JavaScript
  const { outputText } = ts.transpileModule(tsCode, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
    },
  });

  // Execute the compiled JavaScript and return its exit code
  const proc = Bun.spawnSync(["bun", "--eval", outputText], {
    env: {
      ...process.env,
      TUFFC_STDIN: stdIn,
    },
  });
  return proc.exitCode ?? 1;
}
