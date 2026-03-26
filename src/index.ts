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

interface BareIntegerNode {
  readonly kind: "bareInteger";
  readonly value: bigint;
  readonly emitBigInt: boolean;
}

interface ReadNode {
  readonly kind: "read";
  readonly suffix: IntegerSuffix;
  readonly emitBigInt: boolean;
}

interface IdentifierNode {
  readonly kind: "identifier";
  readonly name: string;
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

interface LetDeclarationNode {
  readonly kind: "let";
  readonly name: string;
  readonly annotation?: IntegerSuffix;
  readonly initializer: ExprNode;
}

interface ProgramNode {
  readonly declarations: readonly LetDeclarationNode[];
  readonly expression?: ExprNode;
}

type ExprNode =
  | IntegerNode
  | BareIntegerNode
  | ReadNode
  | IdentifierNode
  | UnaryNode
  | BinaryNode;

const INTEGER_LITERAL = /^\s*([+-])?(\d+)(U8|U16|U32|U64|I8|I16|I32|I64)/;
const BARE_INTEGER_LITERAL = /^\s*([+-])?(\d+)(?![A-Za-z0-9_])/;
const READ_LITERAL = /^\s*read<(U8|U16|U32|U64|I8|I16|I32|I64)>\(\)/;
const IDENTIFIER = /^\s*([A-Za-z_][A-Za-z0-9_]*)/;
const STDIN_TOKEN = /^([+-])?(\d+)$/;
const RESERVED_IDENTIFIERS = new Set(["let"]);

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

const NUMBER_RANGE_MIN = -2147483648n;
const NUMBER_RANGE_MAX = 4294967295n;
const BIGINT_RANGE_MIN = -9223372036854775808n;
const BIGINT_RANGE_MAX = 18446744073709551615n;

interface VariableInfo {
  readonly emitBigInt: boolean;
  readonly min: bigint;
  readonly max: bigint;
}

interface ExpressionAnalysis {
  readonly emitBigInt: boolean;
  readonly min: bigint;
  readonly max: bigint;
}

class Parser {
  private index = 0;

  public constructor(private readonly source: string) {}

  public parseProgram(): ProgramNode {
    const declarations: LetDeclarationNode[] = [];

    while (this.isAtLetKeyword()) {
      declarations.push(this.parseLetDeclaration());
    }

    let expression: ExprNode | undefined;

    if (!this.isAtEnd()) {
      expression = this.parseExpression(false);
    }

    this.skipWhitespace();

    if (!this.isAtEnd()) {
      throw new SyntaxError("Unsupported Tuff source.");
    }

    return expression === undefined
      ? { declarations }
      : { declarations, expression };
  }

  private parseLetDeclaration(): LetDeclarationNode {
    this.consumeKeyword("let");
    const name = this.parseIdentifier();
    let annotation: IntegerSuffix | undefined;

    this.skipWhitespace();

    if (this.peek() === ":") {
      this.index += 1;
      annotation = this.parseTypeAnnotation();
    }

    this.skipWhitespace();

    if (this.peek() !== "=") {
      throw new SyntaxError("Unsupported Tuff source.");
    }

    this.index += 1;

    const initializer = this.parseExpression(true);
    this.skipWhitespace();

    if (this.peek() !== ";") {
      throw new SyntaxError("Unsupported Tuff source.");
    }

    this.index += 1;

    return annotation === undefined
      ? { kind: "let", name, initializer }
      : { kind: "let", name, annotation, initializer };
  }

  private parseExpression(allowBareIntegers: boolean): ExprNode {
    let node = this.parseTerm(allowBareIntegers);

    while (true) {
      this.skipWhitespace();
      const operator = this.peek();

      if (operator !== "+" && operator !== "-") {
        break;
      }

      this.index += 1;
      const right = this.parseTerm(allowBareIntegers);
      node = { kind: "binary", operator, left: node, right };
    }

    return node;
  }

  private parseTerm(allowBareIntegers: boolean): ExprNode {
    let node = this.parseFactor(allowBareIntegers);

    while (true) {
      this.skipWhitespace();
      const operator = this.peek();

      if (operator !== "*" && operator !== "/" && operator !== "%") {
        break;
      }

      this.index += 1;
      const right = this.parseFactor(allowBareIntegers);
      node = { kind: "binary", operator, left: node, right };
    }

    return node;
  }

  private parseFactor(allowBareIntegers: boolean): ExprNode {
    this.skipWhitespace();

    const integer = this.tryParseIntegerLiteral();

    if (integer !== undefined) {
      return integer;
    }

    if (allowBareIntegers) {
      const bareInteger = this.tryParseBareIntegerLiteral();

      if (bareInteger !== undefined) {
        return bareInteger;
      }
    }

    const read = this.tryParseReadLiteral();

    if (read !== undefined) {
      return read;
    }

    const identifier = this.tryParseIdentifier();

    if (identifier !== undefined) {
      return identifier;
    }

    const current = this.peek();

    if (current === "+" || current === "-") {
      this.index += 1;
      const operand = this.parseFactor(allowBareIntegers);
      return { kind: "unary", operator: current, operand };
    }

    if (current === "(") {
      this.index += 1;
      const expression = this.parseExpression(allowBareIntegers);
      this.skipWhitespace();

      if (this.peek() !== ")") {
        throw new SyntaxError("Unsupported Tuff source.");
      }

      this.index += 1;
      return expression;
    }

    throw new SyntaxError("Unsupported Tuff source.");
  }

  private consumeMatchedSignedInteger(match: RegExpMatchArray): bigint {
    this.index += match[0].length;
    const sign = match[1] ?? "";
    const magnitudeText = match[2];

    if (magnitudeText === undefined) {
      throw new SyntaxError("Unsupported Tuff source.");
    }

    const magnitude = BigInt(magnitudeText);
    return sign === "-" ? -magnitude : magnitude;
  }

  private tryParseIntegerLiteral(): IntegerNode | undefined {
    const match = INTEGER_LITERAL.exec(this.remaining());

    if (!match) {
      return undefined;
    }

    const sign = match[1] ?? "";
    const suffix = match[3] as IntegerSuffix;

    if (sign === "-" && suffix.startsWith("U")) {
      throw new RangeError("Unsigned integer literals cannot be signed.");
    }

    const value = this.consumeMatchedSignedInteger(match);
    assertIntegerInRange(value, suffix);

    return {
      kind: "integer",
      value,
      suffix,
      emitBigInt: INTEGER_SPECS[suffix].emitBigInt,
    };
  }

  private tryParseBareIntegerLiteral(): BareIntegerNode | undefined {
    const match = BARE_INTEGER_LITERAL.exec(this.remaining());

    if (!match) {
      return undefined;
    }

    const value = this.consumeMatchedSignedInteger(match);
    const suffix = inferBareIntegerSuffix(value);

    return {
      kind: "bareInteger",
      value,
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

  private tryParseIdentifier(): IdentifierNode | undefined {
    const match = IDENTIFIER.exec(this.remaining());

    if (!match) {
      return undefined;
    }

    const name = match[1];

    if (name === undefined || RESERVED_IDENTIFIERS.has(name)) {
      return undefined;
    }

    this.index += match[0].length;

    return { kind: "identifier", name };
  }

  private parseIdentifier(): string {
    const match = IDENTIFIER.exec(this.remaining());

    if (!match) {
      throw new SyntaxError("Unsupported Tuff source.");
    }

    const name = match[1];

    if (name === undefined || RESERVED_IDENTIFIERS.has(name)) {
      throw new SyntaxError("Unsupported Tuff source.");
    }

    this.index += match[0].length;
    return name;
  }

  private parseTypeAnnotation(): IntegerSuffix {
    this.skipWhitespace();

    for (const suffix of Object.keys(INTEGER_SPECS) as IntegerSuffix[]) {
      if (this.remaining().startsWith(suffix)) {
        this.index += suffix.length;
        return suffix;
      }
    }

    throw new SyntaxError("Unsupported Tuff source.");
  }

  private isAtLetKeyword(): boolean {
    this.skipWhitespace();
    return /^let(?![A-Za-z0-9_])/.test(this.remaining());
  }

  private consumeKeyword(keyword: string): void {
    this.skipWhitespace();

    if (!this.remaining().startsWith(keyword)) {
      throw new SyntaxError("Unsupported Tuff source.");
    }

    const next = this.source[this.index + keyword.length] ?? "";

    if (/[A-Za-z0-9_]/.test(next)) {
      throw new SyntaxError("Unsupported Tuff source.");
    }

    this.index += keyword.length;
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

function inferBareIntegerSuffix(value: bigint): IntegerSuffix {
  const suffixes =
    value < 0n
      ? (["I8", "I16", "I32", "I64"] as const)
      : (["U8", "U16", "U32", "U64"] as const);

  for (const suffix of suffixes) {
    const spec = INTEGER_SPECS[suffix];

    if (value >= spec.min && value <= spec.max) {
      return suffix;
    }
  }

  throw new RangeError("Integer literals must be within range.");
}

function expressionUsesBigInt(
  node: ExprNode,
  variables: ReadonlyMap<string, VariableInfo>,
): boolean {
  switch (node.kind) {
    case "integer":
    case "bareInteger":
    case "read":
      return node.emitBigInt;
    case "identifier": {
      const variable = variables.get(node.name);

      if (!variable) {
        throw new SyntaxError("Unsupported Tuff source.");
      }

      return variable.emitBigInt;
    }
    case "unary":
      return expressionUsesBigInt(node.operand, variables);
    case "binary":
      return (
        expressionUsesBigInt(node.left, variables) ||
        expressionUsesBigInt(node.right, variables)
      );
  }
}

function compileExpression(
  node: ExprNode,
  variables: ReadonlyMap<string, VariableInfo>,
  needsBigInt: boolean,
): string {
  switch (node.kind) {
    case "integer":
    case "bareInteger":
      if (needsBigInt && !node.emitBigInt) {
        return `BigInt(${node.value})`;
      }

      return node.emitBigInt ? `${node.value}n` : `${node.value}`;
    case "read":
      if (needsBigInt && !node.emitBigInt) {
        return `BigInt(__tuffRead("${node.suffix}"))`;
      }

      return `__tuffRead("${node.suffix}")`;
    case "identifier": {
      const variable = variables.get(node.name);

      if (!variable) {
        throw new SyntaxError("Unsupported Tuff source.");
      }

      if (needsBigInt && !variable.emitBigInt) {
        return `BigInt(${node.name})`;
      }

      return node.name;
    }
    case "unary":
      if (node.operator === "+") {
        return compileExpression(node.operand, variables, needsBigInt);
      }

      return `-(${compileExpression(node.operand, variables, needsBigInt)})`;
    case "binary": {
      const left = compileExpression(node.left, variables, needsBigInt);
      const right = compileExpression(node.right, variables, needsBigInt);

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

function analyzeExpression(
  node: ExprNode,
  variables: ReadonlyMap<string, VariableInfo>,
): ExpressionAnalysis {
  switch (node.kind) {
    case "integer":
    case "bareInteger":
      return { emitBigInt: node.emitBigInt, min: node.value, max: node.value };
    case "read": {
      const spec = INTEGER_SPECS[node.suffix];
      return { emitBigInt: node.emitBigInt, min: spec.min, max: spec.max };
    }
    case "identifier": {
      const variable = variables.get(node.name);

      if (!variable) {
        throw new SyntaxError("Unsupported Tuff source.");
      }

      return variable;
    }
    case "unary": {
      const operand = analyzeExpression(node.operand, variables);

      if (node.operator === "+") {
        return operand;
      }

      return {
        emitBigInt: operand.emitBigInt,
        min: -operand.max,
        max: -operand.min,
      };
    }
    case "binary": {
      const left = analyzeExpression(node.left, variables);
      const right = analyzeExpression(node.right, variables);
      const emitBigInt = left.emitBigInt || right.emitBigInt;

      if (node.operator === "+") {
        return {
          emitBigInt,
          min: left.min + right.min,
          max: left.max + right.max,
        };
      }

      if (node.operator === "-") {
        return {
          emitBigInt,
          min: left.min - right.max,
          max: left.max - right.min,
        };
      }

      if (node.operator === "*") {
        const products = [
          left.min * right.min,
          left.min * right.max,
          left.max * right.min,
          left.max * right.max,
        ];

        return {
          emitBigInt,
          min: minBigInt(products),
          max: maxBigInt(products),
        };
      }

      return {
        emitBigInt,
        min: emitBigInt ? BIGINT_RANGE_MIN : NUMBER_RANGE_MIN,
        max: emitBigInt ? BIGINT_RANGE_MAX : NUMBER_RANGE_MAX,
      };
    }
  }
}

function reduceBigInt(
  values: readonly bigint[],
  isBetter: (candidate: bigint, current: bigint) => boolean,
): bigint {
  let current = values[0];

  if (current === undefined) {
    throw new RangeError("Expected at least one bigint value.");
  }

  for (const value of values.slice(1)) {
    if (isBetter(value, current)) {
      current = value;
    }
  }

  return current;
}

function minBigInt(values: readonly bigint[]): bigint {
  return reduceBigInt(values, (a, b) => a < b);
}

function maxBigInt(values: readonly bigint[]): bigint {
  return reduceBigInt(values, (a, b) => a > b);
}

function assertAssignableToSuffix(
  analysis: ExpressionAnalysis,
  suffix: IntegerSuffix,
): void {
  assertIntegerInRange(analysis.min, suffix);
  assertIntegerInRange(analysis.max, suffix);
}

function compileProgram(program: ProgramNode): string {
  const variables = new Map<string, VariableInfo>();
  const statements: string[] = [];

  for (const declaration of program.declarations) {
    if (variables.has(declaration.name)) {
      throw new SyntaxError("Unsupported Tuff source.");
    }

    const analysis = analyzeExpression(declaration.initializer, variables);
    let emitBigInt = analysis.emitBigInt;

    if (declaration.annotation !== undefined) {
      assertAssignableToSuffix(analysis, declaration.annotation);
      emitBigInt = INTEGER_SPECS[declaration.annotation].emitBigInt;
    }

    const initializer = compileExpression(
      declaration.initializer,
      variables,
      emitBigInt,
    );

    statements.push(`const ${declaration.name} = ${initializer};`);
    variables.set(declaration.name, {
      emitBigInt,
      min: analysis.min,
      max: analysis.max,
    });
  }

  if (program.expression === undefined) {
    statements.push("export default 0;");
    return statements.join("\n");
  }

  const needsBigInt = expressionUsesBigInt(program.expression, variables);
  const expression = compileExpression(
    program.expression,
    variables,
    needsBigInt,
  );
  statements.push(`export default ${expression};`);

  return statements.join("\n");
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
  const program = new Parser(source).parseProgram();
  return compileProgram(program);
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
