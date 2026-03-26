import * as ts from "typescript";

type IntegerSuffix = "U8" | "U16" | "U32" | "U64" | "I8" | "I16" | "I32" | "I64";

interface IntegerSpec {
  readonly min: bigint;
  readonly max: bigint;
  readonly emitBigInt: boolean;
}

const INTEGER_LITERAL = /^\s*([+-])?(\d+)(U8|U16|U32|U64|I8|I16|I32|I64)\s*$/;

const INTEGER_SPECS: Record<IntegerSuffix, IntegerSpec> = {
  U8: { min: 0n, max: 255n, emitBigInt: false },
  U16: { min: 0n, max: 65535n, emitBigInt: false },
  U32: { min: 0n, max: 4294967295n, emitBigInt: false },
  U64: {
    min: 0n,
    max: 18446744073709551615n,
    emitBigInt: true,
  },
  I8: { min: -128n, max: 127n, emitBigInt: false },
  I16: { min: -32768n, max: 32767n, emitBigInt: false },
  I32: {
    min: -2147483648n,
    max: 2147483647n,
    emitBigInt: false,
  },
  I64: {
    min: -9223372036854775808n,
    max: 9223372036854775807n,
    emitBigInt: true,
  },
};

function parseIntegerLiteral(source: string): {
  readonly value: bigint;
  readonly spec: IntegerSpec;
} {
  const match = INTEGER_LITERAL.exec(source);

  if (!match) {
    throw new SyntaxError("Unsupported Tuff source.");
  }

  const sign = match[1] ?? "";
  const magnitudeText = match[2];

  if (magnitudeText === undefined) {
    throw new SyntaxError("Unsupported Tuff source.");
  }

  const magnitude = BigInt(magnitudeText);
  const suffix = match[3] as IntegerSuffix;
  const spec = INTEGER_SPECS[suffix];

  if (sign === "-" && suffix.startsWith("U")) {
    throw new RangeError("Unsigned integer literals cannot be signed.");
  }

  const value = sign === "-" ? -magnitude : magnitude;

  if (value < spec.min || value > spec.max) {
    throw new RangeError(`${suffix} literals must be within range.`);
  }

  return { value, spec };
}

function readExecutedValue(value: unknown): number | bigint | undefined {
  if (typeof value === "number" || typeof value === "bigint") {
    return value;
  }

  if (value !== null && typeof value === "object" && "default" in value) {
    const defaultValue = (value as { default: unknown }).default;

    if (typeof defaultValue === "number" || typeof defaultValue === "bigint") {
      return defaultValue;
    }
  }

  return undefined;
}

export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export function compileTuffToTS(source: string): string {
  const { value, spec } = parseIntegerLiteral(source);
  const emittedValue = spec.emitBigInt ? `${value}n` : `${value}`;

  return `export default ${emittedValue};`;
}

export function evaluateTuff(tuffSource: string): number | bigint {
  const tsSource = compileTuffToTS(tuffSource);
  const jsSource = ts.transpileModule(tsSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const module = { exports: {} as unknown };
  const executionResult = new Function(
    "module",
    "exports",
    `${jsSource}\nreturn module.exports;`,
  )(module, module.exports);

  const possibleValues = [executionResult, module.exports];

  for (const value of possibleValues) {
    const executedValue = readExecutedValue(value);

    if (executedValue !== undefined) {
      return executedValue;
    }
  }

  throw new TypeError(
    "evaluateTuff expected compiled code to produce a number or bigint.",
  );
}

if (import.meta.main) {
  const name = process.argv[2] ?? "world";
  console.log(greet(name));
}
