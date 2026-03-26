import * as ts from "typescript";

type IntegerSuffix =
  | "U8"
  | "U16"
  | "U32"
  | "U64"
  | "I8"
  | "I16"
  | "I32"
  | "I64";

interface IntegerSpec {
  readonly min: bigint;
  readonly max: bigint;
  readonly emitBigInt: boolean;
}

interface ParsedIntegerTerm {
  readonly kind: "integer";
  readonly value: bigint;
  readonly suffix: IntegerSuffix;
  readonly emitBigInt: boolean;
}

interface ParsedReadTerm {
  readonly kind: "read";
  readonly suffix: IntegerSuffix;
  readonly emitBigInt: boolean;
}

type ParsedTerm = ParsedIntegerTerm | ParsedReadTerm;

interface ParsedProgram {
  readonly terms: ParsedTerm[];
  readonly needsBigInt: boolean;
}

const INTEGER_LITERAL = /^\s*([+-])?(\d+)(U8|U16|U32|U64|I8|I16|I32|I64)/;
const READ_LITERAL = /^\s*read<(U8|U16|U32|U64|I8|I16|I32|I64)>\(\)/;
const STDIN_TOKEN = /^([+-])?(\d+)$/;

const INTEGER_SPECS: Record<IntegerSuffix, IntegerSpec> = {
  U8: { min: 0n, max: 255n, emitBigInt: false },
  U16: { min: 0n, max: 65535n, emitBigInt: false },
  U32: { min: 0n, max: 4294967295n, emitBigInt: false },
  U64: { min: 0n, max: 18446744073709551615n, emitBigInt: true },
  I8: { min: -128n, max: 127n, emitBigInt: false },
  I16: { min: -32768n, max: 32767n, emitBigInt: false },
  I32: { min: -2147483648n, max: 2147483647n, emitBigInt: false },
  I64: {
    min: -9223372036854775808n,
    max: 9223372036854775807n,
    emitBigInt: true,
  },
};

function parseIntegerLiteral(source: string): ParsedIntegerTerm {
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

  assertIntegerInRange(value, suffix);

  return {
    kind: "integer",
    value,
    suffix,
    emitBigInt: spec.emitBigInt,
  };
}

function parseReadLiteral(source: string): ParsedReadTerm {
  const match = READ_LITERAL.exec(source);

  if (!match) {
    throw new SyntaxError("Unsupported Tuff source.");
  }

  const suffix = match[1] as IntegerSuffix;

  return {
    kind: "read",
    suffix,
    emitBigInt: INTEGER_SPECS[suffix].emitBigInt,
  };
}

function parseTermFrom(source: string): {
  readonly term: ParsedTerm;
  readonly length: number;
} {
  const readMatch = READ_LITERAL.exec(source);

  if (readMatch) {
    return {
      term: parseReadLiteral(source),
      length: readMatch[0].length,
    };
  }

  const integerMatch = INTEGER_LITERAL.exec(source);

  if (integerMatch) {
    return {
      term: parseIntegerLiteral(source),
      length: integerMatch[0].length,
    };
  }

  throw new SyntaxError("Unsupported Tuff source.");
}

function parseProgram(source: string): ParsedProgram {
  const terms: ParsedTerm[] = [];
  let index = 0;

  while (index < source.length) {
    index = skipWhitespace(source, index);

    if (index >= source.length) {
      break;
    }

    const { term, length } = parseTermFrom(source.slice(index));
    terms.push(term);
    index += length;
    index = skipWhitespace(source, index);

    if (index >= source.length) {
      break;
    }

    if (source[index] !== "+") {
      throw new SyntaxError("Unsupported Tuff source.");
    }

    index += 1;
  }

  if (terms.length === 0) {
    throw new SyntaxError("Unsupported Tuff source.");
  }

  return {
    terms,
    needsBigInt: terms.some((term) => term.emitBigInt),
  };
}

function compileTermToTs(term: ParsedTerm, needsBigInt: boolean): string {
  if (term.kind === "read") {
    if (needsBigInt && !term.emitBigInt) {
      return `BigInt(__tuffRead("${term.suffix}"))`;
    }

    return `__tuffRead("${term.suffix}")`;
  }

  if (needsBigInt && !term.emitBigInt) {
    return `BigInt(${term.value})`;
  }

  return term.emitBigInt ? `${term.value}n` : `${term.value}`;
}

function skipWhitespace(source: string, index: number): number {
  let nextIndex = index;

  while (nextIndex < source.length && /\s/.test(source[nextIndex] ?? "")) {
    nextIndex += 1;
  }

  return nextIndex;
}

function parseStdInToken(token: string): bigint {
  const match = STDIN_TOKEN.exec(token);

  if (!match) {
    throw new RangeError("Invalid stdin literal.");
  }

  const sign = match[1] ?? "";
  const magnitudeText = match[2];

  if (magnitudeText === undefined) {
    throw new RangeError("Invalid stdin literal.");
  }

  const magnitude = BigInt(magnitudeText);
  return sign === "-" ? -magnitude : magnitude;
}

function assertIntegerInRange(value: bigint, suffix: IntegerSuffix): void {
  const spec = INTEGER_SPECS[suffix];

  if (value < spec.min || value > spec.max) {
    throw new RangeError(`${suffix} literals must be within range.`);
  }
}

function createStdInReader(stdIn: string) {
  const tokens = stdIn.trim() === "" ? [] : stdIn.trim().split(/\s+/);
  let index = 0;

  return (suffix: IntegerSuffix): number | bigint => {
    if (index >= tokens.length) {
      throw new RangeError("Missing stdin value.");
    }

    const token = tokens[index++];

    if (token === undefined) {
      throw new RangeError("Missing stdin value.");
    }

    const value = parseStdInToken(token);

    if (value < 0n && suffix.startsWith("U")) {
      throw new RangeError("Unsigned integer literals cannot be signed.");
    }

    assertIntegerInRange(value, suffix);

    const spec = INTEGER_SPECS[suffix];

    return spec.emitBigInt ? value : Number(value);
  };
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
  const program = parseProgram(source);
  const tsExpression = program.terms
    .map((term) => compileTermToTs(term, program.needsBigInt))
    .join(" + ");

  return `export default ${tsExpression};`;
}

export function evaluateTuff(tuffSource: string, stdIn = ""): number | bigint {
  const tsSource = compileTuffToTS(tuffSource);
  const jsSource = ts.transpileModule(tsSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const module = { exports: {} as unknown };
  const __tuffRead = createStdInReader(stdIn);
  const executionResult = new Function(
    "module",
    "exports",
    "__tuffRead",
    `${jsSource}\nreturn module.exports;`,
  )(module, module.exports, __tuffRead);

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
