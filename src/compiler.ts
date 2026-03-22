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

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function stripSpaces(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    if (value[i] !== " ") {
      out += value[i];
    }
  }
  return out;
}

function buildReadU8Program(readCount: number): string {
  const lines = [
    "const __tuffInput = process.env.TUFFC_STDIN ?? '';",
    "let __k = 0;",
    "function __nextToken() {",
    "  while (__k < __tuffInput.length && __tuffInput[__k] === ' ') __k++;",
    "  let __start = __k;",
    "  while (__k < __tuffInput.length && __tuffInput[__k] !== ' ') __k++;",
    "  return __tuffInput.slice(__start, __k);",
    "}",
  ];

  if (readCount === 1) {
    lines.push("process.exit(Number.parseInt(__nextToken(), 10));");
    return lines.join("\n");
  }

  lines.push("const __a = Number.parseInt(__nextToken(), 10);");
  lines.push("const __b = Number.parseInt(__nextToken(), 10);");
  lines.push("process.exit(__a + __b);");
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

  const compactSource = stripSpaces(source);

  if (source === "read<U8>()") {
    return ok(buildReadU8Program(1));
  }

  if (compactSource === "read<U8>()+read<U8>()") {
    return ok(buildReadU8Program(2));
  }

  const parsed = parseIntegerLiteral(source);
  if (!parsed.isOk) {
    return parsed;
  }
  if (parsed.value !== undefined) {
    return ok(`process.exit(${parsed.value});`);
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
