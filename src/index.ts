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

type BinaryOperator = "+" | "-" | "*" | "/" | "%";
type UnaryOperator = "+" | "-";

interface IntegerSpec {
  readonly min: bigint;
  readonly max: bigint;
  readonly emitBigInt: boolean;
}

interface IntegerNode {
  readonly kind: "integer";
  readonly value: bigint;
  readonly suffix: IntegerSuffix;
  readonly emitBigInt: boolean;
}

interface ReadNode {
  readonly kind: "read";
  readonly suffix: IntegerSuffix;
  readonly emitBigInt: boolean;
}

interface UnaryNode {
  readonly kind: "unary";
  readonly operator: UnaryOperator;
  readonly operand: ExprNode;
}

interface BinaryNode {
  readonly kind: "binary";
  readonly operator: BinaryOperator;
  readonly left: ExprNode;
  readonly right: ExprNode;
}

type ExprNode = IntegerNode | ReadNode | UnaryNode | BinaryNode;

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

class Parser {
  private index = 0;

  public constructor(private readonly source: string) {}

  public parseProgram(): ExprNode {
    const expression = this.parseExpression();
    this.skipWhitespace();

    if (!this.isAtEnd()) {
      throw new SyntaxError("Unsupported Tuff source.");
    }

    return expression;
  }

  private parseExpression(): ExprNode {
    let node = this.parseTerm();

    while (true) {
      this.skipWhitespace();
      const operator = this.peek();

      if (operator !== "+" && operator !== "-") {
        break;
      }

      this.index += 1;
      const right = this.parseTerm();
      node = { kind: "binary", operator, left: node, right };
    }

    return node;
  }

  private parseTerm(): ExprNode {
    let node = this.parseFactor();

    while (true) {
      this.skipWhitespace();
      const operator = this.peek();

      if (operator !== "*" && operator !== "/" && operator !== "%") {
        break;
      }

      this.index += 1;
      const right = this.parseFactor();
      node = { kind: "binary", operator, left: node, right };
    }

    return node;
  }

  private parseFactor(): ExprNode {
    this.skipWhitespace();

    const integer = this.tryParseIntegerLiteral();

    if (integer !== undefined) {
      return integer;
    }

    const read = this.tryParseReadLiteral();

    if (read !== undefined) {
      return read;
    }

    const current = this.peek();

    if (current === "+" || current === "-") {
      this.index += 1;
      const operand = this.parseFactor();
      return { kind: "unary", operator: current, operand };
    }

    if (current === "(") {
      this.index += 1;
      const expression = this.parseExpression();
      this.skipWhitespace();

      if (this.peek() !== ")") {
        throw new SyntaxError("Unsupported Tuff source.");
      }

      this.index += 1;
      return expression;
    }

    throw new SyntaxError("Unsupported Tuff source.");
  }

  private tryParseIntegerLiteral(): IntegerNode | undefined {
    const match = INTEGER_LITERAL.exec(this.remaining());

    if (!match) {
      return undefined;
    }

    this.index += match[0].length;

    const sign = match[1] ?? "";
    const magnitudeText = match[2];

    if (magnitudeText === undefined) {
      throw new SyntaxError("Unsupported Tuff source.");
    }

    const magnitude = BigInt(magnitudeText);
    const suffix = match[3] as IntegerSuffix;

    if (sign === "-" && suffix.startsWith("U")) {
      throw new RangeError("Unsigned integer literals cannot be signed.");
    }

    const value = sign === "-" ? -magnitude : magnitude;
    assertIntegerInRange(value, suffix);

    return {
      kind: "integer",
      value,
      suffix,
      emitBigInt: INTEGER_SPECS[suffix].emitBigInt,
    };
  }

  private tryParseReadLiteral(): ReadNode | undefined {
    const match = READ_LITERAL.exec(this.remaining());

    if (!match) {
      return undefined;
    }

    this.index += match[0].length;

    const suffix = match[1] as IntegerSuffix;

    return {
      kind: "read",
      suffix,
      emitBigInt: INTEGER_SPECS[suffix].emitBigInt,
    };
  }

  private skipWhitespace(): void {
    while (
      this.index < this.source.length &&
      /\s/.test(this.source[this.index] ?? "")
    ) {
      this.index += 1;
    }
  }

  private isAtEnd(): boolean {
    return this.index >= this.source.length;
  }

  private peek(): string {
    return this.source[this.index] ?? "";
  }

  private remaining(): string {
    return this.source.slice(this.index);
  }
}

function assertIntegerInRange(value: bigint, suffix: IntegerSuffix): void {
  const spec = INTEGER_SPECS[suffix];

  if (value < spec.min || value > spec.max) {
    throw new RangeError(`${suffix} literals must be within range.`);
  }
}

function expressionUsesBigInt(node: ExprNode): boolean {
  switch (node.kind) {
    case "integer":
    case "read":
      return node.emitBigInt;
    case "unary":
      return expressionUsesBigInt(node.operand);
    case "binary":
      return (
        expressionUsesBigInt(node.left) || expressionUsesBigInt(node.right)
      );
  }
}

function compileExpression(node: ExprNode, needsBigInt: boolean): string {
  switch (node.kind) {
    case "integer":
      if (needsBigInt && !node.emitBigInt) {
        return `BigInt(${node.value})`;
      }

      return node.emitBigInt ? `${node.value}n` : `${node.value}`;
    case "read":
      if (needsBigInt && !node.emitBigInt) {
        return `BigInt(__tuffRead("${node.suffix}"))`;
      }

      return `__tuffRead("${node.suffix}")`;
    case "unary":
      if (node.operator === "+") {
        return compileExpression(node.operand, needsBigInt);
      }

      return `-(${compileExpression(node.operand, needsBigInt)})`;
    case "binary": {
      const left = compileExpression(node.left, needsBigInt);
      const right = compileExpression(node.right, needsBigInt);

      if (node.operator === "/") {
        return `__tuffDiv(${left}, ${right})`;
      }

      if (node.operator === "%") {
        return `__tuffMod(${left}, ${right})`;
      }

      return `(${left} ${node.operator} ${right})`;
    }
  }
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

function createDivisionHelper(operator: "/" | "%") {
  return (left: number | bigint, right: number | bigint): number | bigint => {
    const isZero =
      (typeof right === "number" && right === 0) ||
      (typeof right === "bigint" && right === 0n);

    if (isZero) {
      throw new RangeError(
        operator === "/" ? "Division by zero." : "Modulo by zero.",
      );
    }

    if (typeof left === "bigint" || typeof right === "bigint") {
      const bigLeft = typeof left === "bigint" ? left : BigInt(left);
      const bigRight = typeof right === "bigint" ? right : BigInt(right);

      return operator === "/" ? bigLeft / bigRight : bigLeft % bigRight;
    }

    return operator === "/" ? left / right : left % right;
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
  const ast = new Parser(source).parseProgram();
  const needsBigInt = expressionUsesBigInt(ast);
  const expression = compileExpression(ast, needsBigInt);

  return `export default ${expression};`;
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
  const __tuffDiv = createDivisionHelper("/");
  const __tuffMod = createDivisionHelper("%");
  const executionResult = new Function(
    "module",
    "exports",
    "__tuffRead",
    "__tuffDiv",
    "__tuffMod",
    `${jsSource}\nreturn module.exports;`,
  )(module, module.exports, __tuffRead, __tuffDiv, __tuffMod);

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
