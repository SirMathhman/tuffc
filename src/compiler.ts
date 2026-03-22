import { resolve } from "path";
import vm from "node:vm";
import ts from "typescript";

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

interface ParsedLiteral {
  valueJs: string;
  typeName: string;
}

interface ReadCall {
  typeName: string;
  nextIndex: number;
}

interface ParsedExpr {
  js: string;
  nextIndex: number;
  usesRead: boolean;
}

interface ParsedInitializer {
  js: string;
  typeName: string;
  nextIndex: number;
  usesRead: boolean;
}

interface ParsedDeclaration {
  js: string;
  nextIndex: number;
  usesRead: boolean;
}

interface TokenReadResult {
  token: string;
  nextIndex: number;
}

interface ParsedReadRuntime {
  js: string;
  typeName: string;
  nextIndex: number;
  usesRead: boolean;
}

interface ReadRuntimeMapper<T> {
  (readRuntime: ParsedReadRuntime): T;
}

interface ProgramCompile {
  expressionJs: string;
  declarationJs: string[];
  usesRead: boolean;
}

interface ExprParser {
  (
    source: string,
    start: number,
    declaredTypes: Map<string, string>,
  ): Result<ParsedExpr, string>;
}

function isWhitespace(char: string): boolean {
  return char === " " || char === "\n" || char === "\r" || char === "\t";
}

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function isLetter(char: string): boolean {
  return (
    (char >= "a" && char <= "z") || (char >= "A" && char <= "Z") || char === "_"
  );
}

function isIdentifierPart(char: string): boolean {
  return isLetter(char) || isDigit(char);
}

function consumeWhitespace(source: string, start: number): number {
  let i = start;
  while (i < source.length && isWhitespace(source[i]!)) {
    i++;
  }
  return i;
}

function startsWithAt(source: string, start: number, text: string): boolean {
  if (start + text.length > source.length) return false;
  let i = 0;
  while (i < text.length) {
    if (source[start + i] !== text[i]) return false;
    i++;
  }
  return true;
}

function readIdentifierAt(source: string, start: number): string {
  if (start >= source.length || !isLetter(source[start]!)) return "";
  let i = start + 1;
  while (i < source.length && isIdentifierPart(source[i]!)) {
    i++;
  }
  return source.slice(start, i);
}

function parseTypedIntegerLiteral(
  token: string,
): Result<ParsedLiteral | undefined, string> {
  if (token.length === 0) return ok(undefined);

  let i = 0;
  if (token[i] === "-") {
    i++;
  }

  const digitStart = i;
  while (i < token.length && isDigit(token[i]!)) {
    i++;
  }

  if (i === digitStart) return ok(undefined);
  if (i === token.length) return ok(undefined);

  const suffix = token.slice(i);
  if (!TYPE_RANGES.has(suffix)) {
    return err(`Unknown integer type: ${suffix}`);
  }

  const numericPart = token.slice(0, i);
  const parsedValue = BigInt(numericPart);
  const range = TYPE_RANGES.get(suffix)!;
  if (parsedValue < range.min || parsedValue > range.max) {
    return err(`Value ${numericPart} out of range for ${suffix}`);
  }

  return ok({
    valueJs: numericPart,
    typeName: suffix,
  });
}

function parseReadCallAt(
  source: string,
  start: number,
): Result<ReadCall | undefined, string> {
  if (!startsWithAt(source, start, "read<")) return ok(undefined);

  let i = start + 5;
  const typeName = readIdentifierAt(source, i);
  if (typeName.length === 0) {
    return err("Expected type name in read<...>()");
  }

  if (!TYPE_RANGES.has(typeName)) {
    return err(`Unknown integer type: ${typeName}`);
  }

  i += typeName.length;
  if (i >= source.length || source[i] !== ">") {
    return err("Expected '>' in read<...>()");
  }
  i++;

  if (i + 1 >= source.length || source[i] !== "(" || source[i + 1] !== ")") {
    return err("Expected '()' in read<...>()");
  }
  i += 2;

  return ok({
    typeName,
    nextIndex: i,
  });
}

function parseReadRuntimeAt(
  source: string,
  start: number,
): Result<ParsedReadRuntime | undefined, string> {
  const i = consumeWhitespace(source, start);
  const readCall = parseReadCallAt(source, i);
  if (!readCall.isOk) return readCall;
  if (readCall.value === undefined) return ok(undefined);

  return ok({
    js: "__readInt()",
    typeName: readCall.value.typeName,
    nextIndex: readCall.value.nextIndex,
    usesRead: true,
  });
}

function parseMappedReadRuntimeAt<T>(
  source: string,
  start: number,
  mapper: ReadRuntimeMapper<T>,
): Result<T | undefined, string> {
  const i = consumeWhitespace(source, start);
  const readRuntime = parseReadRuntimeAt(source, i);
  if (!readRuntime.isOk) return readRuntime;
  if (readRuntime.value === undefined) return ok(undefined);

  return ok(mapper(readRuntime.value));
}

function readTokenUntil(
  source: string,
  start: number,
  stopChars: string,
): TokenReadResult {
  let i = start;
  if (source[i] === "-" && i + 1 < source.length && isDigit(source[i + 1]!)) {
    i++;
  }

  while (
    i < source.length &&
    !isWhitespace(source[i]!) &&
    stopChars.indexOf(source[i]!) < 0
  ) {
    i++;
  }

  return {
    token: source.slice(start, i),
    nextIndex: i,
  };
}

function parseLiteralOrError(
  token: string,
  contextName: string,
): Result<ParsedLiteral, string> {
  const literal = parseTypedIntegerLiteral(token);
  if (!literal.isOk) return literal;
  if (literal.value === undefined) {
    return err(`Invalid ${contextName}: ${token}`);
  }
  return ok(literal.value);
}

function parseBinaryExpressionAt(
  source: string,
  start: number,
  declaredTypes: Map<string, string>,
  parseOperand: ExprParser,
  operators: string,
): Result<ParsedExpr, string> {
  const first = parseOperand(source, start, declaredTypes);
  if (!first.isOk) return first;

  let expressionJs = first.value.js;
  let usesRead = first.value.usesRead;
  let i = first.value.nextIndex;

  while (true) {
    const opIndex = consumeWhitespace(source, i);
    if (opIndex >= source.length) break;

    const op = source[opIndex]!;
    if (operators.indexOf(op) < 0) break;

    const right = parseOperand(source, opIndex + 1, declaredTypes);
    if (!right.isOk) return right;

    const rhs = op === "/" ? `Math.trunc(${right.value.js})` : right.value.js;
    expressionJs = `(${expressionJs} ${op} ${rhs})`;
    usesRead = usesRead || right.value.usesRead;
    i = right.value.nextIndex;
  }

  return ok({
    js: expressionJs,
    nextIndex: i,
    usesRead,
  });
}

function parsePrimaryAt(
  source: string,
  start: number,
  declaredTypes: Map<string, string>,
): Result<ParsedExpr, string> {
  const i = consumeWhitespace(source, start);
  if (i >= source.length) {
    return err("Expected expression term");
  }

  const readExpression = parseMappedReadRuntimeAt(source, i, (readRuntime) => ({
    js: readRuntime.js,
    nextIndex: readRuntime.nextIndex,
    usesRead: readRuntime.usesRead,
  }));
  if (!readExpression.isOk) return readExpression;
  if (readExpression.value !== undefined) {
    return ok({
      js: readExpression.value.js,
      nextIndex: readExpression.value.nextIndex,
      usesRead: readExpression.value.usesRead,
    });
  }

  const identifier = readIdentifierAt(source, i);
  if (identifier.length > 0) {
    if (!declaredTypes.has(identifier)) {
      return err(`Undeclared identifier: ${identifier}`);
    }
    return ok({
      js: identifier,
      nextIndex: i + identifier.length,
      usesRead: false,
    });
  }

  const tokenRead = readTokenUntil(source, i, "+-*/;");
  if (tokenRead.token.length === 0) {
    return err("Expected expression term");
  }

  const literal = parseLiteralOrError(tokenRead.token, "term");
  if (!literal.isOk) return literal;

  return ok({
    js: literal.value.valueJs,
    nextIndex: tokenRead.nextIndex,
    usesRead: false,
  });
}

function parseExpressionAt(
  source: string,
  start: number,
  declaredTypes: Map<string, string>,
): Result<ParsedExpr, string> {
  const parseMultiplicative: ExprParser = (
    s: string,
    i: number,
    types: Map<string, string>,
  ) => parseBinaryExpressionAt(s, i, types, parsePrimaryAt, "*/");

  return parseBinaryExpressionAt(
    source,
    start,
    declaredTypes,
    parseMultiplicative,
    "+-",
  );
}

function parseInitializerAt(
  source: string,
  start: number,
): Result<ParsedInitializer, string> {
  const i = consumeWhitespace(source, start);

  const readInitializer = parseMappedReadRuntimeAt(
    source,
    i,
    (readRuntime) => ({
      js: readRuntime.js,
      typeName: readRuntime.typeName,
      nextIndex: readRuntime.nextIndex,
      usesRead: readRuntime.usesRead,
    }),
  );
  if (!readInitializer.isOk) return readInitializer;
  if (readInitializer.value !== undefined) {
    return ok({
      js: readInitializer.value.js,
      typeName: readInitializer.value.typeName,
      nextIndex: readInitializer.value.nextIndex,
      usesRead: readInitializer.value.usesRead,
    });
  }

  const tokenRead = readTokenUntil(source, i, ";");
  if (tokenRead.token.length === 0) {
    return err("Expected initializer");
  }

  const literal = parseLiteralOrError(tokenRead.token, "initializer");
  if (!literal.isOk) return literal;

  return ok({
    js: literal.value.valueJs,
    typeName: literal.value.typeName,
    nextIndex: tokenRead.nextIndex,
    usesRead: false,
  });
}

function parseDeclarationAt(
  source: string,
  start: number,
  declaredTypes: Map<string, string>,
): Result<ParsedDeclaration | undefined, string> {
  let i = consumeWhitespace(source, start);
  if (!startsWithAt(source, i, "let")) {
    return ok(undefined);
  }

  const keywordEnd = i + 3;
  if (keywordEnd < source.length && isIdentifierPart(source[keywordEnd]!)) {
    return ok(undefined);
  }
  i = keywordEnd;

  i = consumeWhitespace(source, i);
  const name = readIdentifierAt(source, i);
  if (name.length === 0) {
    return err("Expected identifier after let");
  }
  if (declaredTypes.has(name)) {
    return err(`Duplicate declaration: ${name}`);
  }
  i += name.length;

  i = consumeWhitespace(source, i);
  if (i >= source.length || source[i] !== ":") {
    return err("Expected ':' after identifier in declaration");
  }
  i++;

  i = consumeWhitespace(source, i);
  const declaredType = readIdentifierAt(source, i);
  if (declaredType.length === 0) {
    return err("Expected type name in declaration");
  }
  if (!TYPE_RANGES.has(declaredType)) {
    return err(`Unknown integer type: ${declaredType}`);
  }
  i += declaredType.length;

  i = consumeWhitespace(source, i);
  if (i >= source.length || source[i] !== "=") {
    return err("Expected '=' in declaration");
  }
  i++;

  const initializer = parseInitializerAt(source, i);
  if (!initializer.isOk) return initializer;

  i = consumeWhitespace(source, initializer.value.nextIndex);
  if (i >= source.length || source[i] !== ";") {
    return err("Expected ';' after declaration");
  }
  i++;

  declaredTypes.set(name, declaredType);

  return ok({
    js: `const ${name} = ${initializer.value.js};`,
    nextIndex: i,
    usesRead: initializer.value.usesRead,
  });
}

function compileProgram(source: string): Result<ProgramCompile, string> {
  const declaredTypes = new Map<string, string>();
  const declarations: string[] = [];
  let usesRead = false;
  let i = 0;

  while (true) {
    const declaration = parseDeclarationAt(source, i, declaredTypes);
    if (!declaration.isOk) return declaration;
    if (declaration.value === undefined) break;

    declarations.push(declaration.value.js);
    usesRead = usesRead || declaration.value.usesRead;
    i = declaration.value.nextIndex;
  }

  const exprStart = consumeWhitespace(source, i);
  if (exprStart >= source.length) {
    return ok({
      expressionJs: "0",
      declarationJs: declarations,
      usesRead,
    });
  }

  const expression = parseExpressionAt(source, exprStart, declaredTypes);
  if (!expression.isOk) return expression;

  const end = consumeWhitespace(source, expression.value.nextIndex);
  if (end < source.length) {
    return err(`Unexpected token near: ${source.slice(end)}`);
  }

  return ok({
    expressionJs: expression.value.js,
    declarationJs: declarations,
    usesRead: usesRead || expression.value.usesRead,
  });
}

function buildProgramTs(compiled: ProgramCompile): string {
  const lines: string[] = [];

  if (compiled.usesRead) {
    lines.push('const __stdin = process.env["TUFFC_STDIN"] ?? "";');
    lines.push(
      "const __tokens = __stdin.trim().length === 0 ? [] : __stdin.trim().split(' ');",
    );
    lines.push("let __tokenIndex = 0;");
    lines.push("const __readInt = (): number => {");
    lines.push(
      "  while (__tokenIndex < __tokens.length && __tokens[__tokenIndex]?.length === 0) {",
    );
    lines.push("    __tokenIndex++; ");
    lines.push("  }");
    lines.push("  if (__tokenIndex >= __tokens.length) return 0;");
    lines.push("  const raw = __tokens[__tokenIndex++] ?? '0';");
    lines.push("  const n = Number.parseInt(raw, 10);");
    lines.push("  return Number.isFinite(n) ? n : 0;");
    lines.push("};");
  }

  for (const declaration of compiled.declarationJs) {
    lines.push(declaration);
  }
  lines.push(`process.exit(${compiled.expressionJs});`);

  return lines.join("\n");
}

function unableToCompile(result: Result<string, string>): string {
  if (result.isOk) return "";
  return `Unable to compile Tuff source: ${result.error}`;
}

export function compileTuffToTS(source: string): Result<string, string> {
  const compiled = compileProgram(source);
  if (!compiled.isOk) return compiled;

  return ok(buildProgramTs(compiled.value));
}

export async function executeTuff(source: string, stdIn = ""): Promise<number> {
  const compiled = compileTuffToTS(source);
  if (!compiled.isOk) {
    console.error(unableToCompile(compiled));
    return 1;
  }

  const transpiled = ts.transpileModule(compiled.value, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
    fileName: resolve(process.cwd(), "generated.tuff.ts"),
    reportDiagnostics: true,
  });

  const hasTranspileError =
    transpiled.diagnostics !== undefined &&
    transpiled.diagnostics.some(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    );
  if (hasTranspileError) return 1;

  let exitCode = 0;
  const shimProcess = {
    env: {
      ...process.env,
      TUFFC_STDIN: stdIn,
    },
    exit(code: number): void {
      exitCode = Number.isFinite(code) ? Math.trunc(code) : 0;
    },
  };

  const context = vm.createContext({
    process: shimProcess,
  });
  const script = new vm.Script(transpiled.outputText);
  script.runInContext(context);

  return exitCode;
}
