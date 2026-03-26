type IntSuffix = "U8" | "I8" | "U16" | "I16" | "U32" | "I32" | "U64" | "I64";
type TuffType = IntSuffix | "Bool";

const INT_RANGES: Record<IntSuffix, [number, number]> = {
  U8: [0, 255],
  I8: [-128, 127],
  U16: [0, 65535],
  I16: [-32768, 32767],
  U32: [0, 2 ** 32 - 1],
  I32: [-(2 ** 31), 2 ** 31 - 1],
  U64: [0, 2 ** 64 - 1],
  I64: [-(2 ** 63), 2 ** 63 - 1],
};

const VALID_SUFFIXES: Set<string> = new Set([
  "U8",
  "I8",
  "U16",
  "I16",
  "U32",
  "I32",
  "U64",
  "I64",
]);

const VALID_TYPES: Set<string> = new Set([...VALID_SUFFIXES, "Bool"]);

const SUFFIX_ORDER: IntSuffix[] = [
  "U8",
  "I8",
  "U16",
  "I16",
  "U32",
  "I32",
  "U64",
  "I64",
];

type TK =
  | "NUM"
  | "NAME"
  | "LT"
  | "GT"
  | "LPAREN"
  | "RPAREN"
  | "PLUS"
  | "MINUS"
  | "STAR"
  | "SLASH"
  | "SEMI"
  | "COLON"
  | "EQ"
  | "PIPE_PIPE"
  | "AMP_AMP"
  | "BANG"
  | "LT_EQ"
  | "GT_EQ"
  | "EQ_EQ"
  | "BANG_EQ"
  | "LBRACE"
  | "RBRACE"
  | "PLUS_EQ"
  | "MINUS_EQ"
  | "STAR_EQ"
  | "SLASH_EQ"
  | "AMP_EQ"
  | "PIPE_EQ";

interface Tok {
  kind: TK;
  val: string;
}

const CH_TO_TK: Readonly<Record<string, TK>> = {
  "<": "LT",
  ">": "GT",
  "(": "LPAREN",
  ")": "RPAREN",
  "+": "PLUS",
  "-": "MINUS",
  "*": "STAR",
  "/": "SLASH",
  ";": "SEMI",
  ":": "COLON",
  "=": "EQ",
  "!": "BANG",
  "{": "LBRACE",
  "}": "RBRACE",
};

function tokenize(src: string): Tok[] {
  const tokens: Tok[] = [];
  let i: number = 0;
  while (i < src.length) {
    const ch: string = src[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/\d/.test(ch)) {
      let j: number = i;
      while (j < src.length && /\d/.test(src[j]!)) j++;
      tokens.push({ kind: "NUM", val: src.slice(i, j) });
      i = j;
    } else if (/[a-zA-Z_]/.test(ch)) {
      let j: number = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j]!)) j++;
      tokens.push({ kind: "NAME", val: src.slice(i, j) });
      i = j;
    } else {
      if (ch === "|" && src[i + 1] === "|") {
        tokens.push({ kind: "PIPE_PIPE", val: "||" });
        i += 2;
      } else if (ch === "&" && src[i + 1] === "&") {
        tokens.push({ kind: "AMP_AMP", val: "&&" });
        i += 2;
      } else if (ch === "<" && src[i + 1] === "=") {
        tokens.push({ kind: "LT_EQ", val: "<=" });
        i += 2;
      } else if (ch === ">" && src[i + 1] === "=") {
        tokens.push({ kind: "GT_EQ", val: ">=" });
        i += 2;
      } else if (ch === "=" && src[i + 1] === "=") {
        tokens.push({ kind: "EQ_EQ", val: "===" });
        i += 2;
      } else if (ch === "!" && src[i + 1] === "=") {
        tokens.push({ kind: "BANG_EQ", val: "!==" });
        i += 2;
      } else if (ch === "+" && src[i + 1] === "=") {
        tokens.push({ kind: "PLUS_EQ", val: "+=" });
        i += 2;
      } else if (ch === "-" && src[i + 1] === "=") {
        tokens.push({ kind: "MINUS_EQ", val: "-=" });
        i += 2;
      } else if (ch === "*" && src[i + 1] === "=") {
        tokens.push({ kind: "STAR_EQ", val: "*=" });
        i += 2;
      } else if (ch === "/" && src[i + 1] === "=") {
        tokens.push({ kind: "SLASH_EQ", val: "/=" });
        i += 2;
      } else if (ch === "&" && src[i + 1] === "=") {
        tokens.push({ kind: "AMP_EQ", val: "&=" });
        i += 2;
      } else if (ch === "|" && src[i + 1] === "=") {
        tokens.push({ kind: "PIPE_EQ", val: "|=" });
        i += 2;
      } else {
        const kind: TK | undefined = CH_TO_TK[ch];
        if (!kind)
          throw new Error(`Syntax error: unexpected character "${ch}"`);
        tokens.push({ kind, val: ch });
        i++;
      }
    }
  }
  return tokens;
}

interface TypedExpr {
  code: string;
  type: TuffType;
}

function promoteTypes(a: TuffType, b: TuffType): IntSuffix {
  if (a === "Bool" || b === "Bool") {
    throw new Error(`Type error: Bool cannot be used in arithmetic`);
  }
  const [aMin, aMax]: [number, number] = INT_RANGES[a];
  const [bMin, bMax]: [number, number] = INT_RANGES[b];
  const combinedMin: number = Math.min(aMin, bMin);
  const combinedMax: number = Math.max(aMax, bMax);
  for (const suffix of SUFFIX_ORDER) {
    const [min, max]: [number, number] = INT_RANGES[suffix];
    if (min <= combinedMin && max >= combinedMax) return suffix;
  }
  throw new Error(`Type error: no integer type covers ${a} and ${b}`);
}

function isTypeCompatible(declared: TuffType, inferred: TuffType): boolean {
  if (declared === "Bool" || inferred === "Bool") {
    return declared === inferred;
  }
  const [dMin, dMax]: [number, number] = INT_RANGES[declared];
  const [iMin, iMax]: [number, number] = INT_RANGES[inferred];
  return dMin <= iMin && dMax >= iMax;
}

function throwNoCommonType(t1: TuffType, t2: TuffType): never {
  throw new Error(`Type error: no common type for ${t1} and ${t2}`);
}

function findCommonType(t1: TuffType, t2: TuffType): TuffType {
  if (t1 === t2) return t1;

  if (t1 === "Bool" || t2 === "Bool") {
    throwNoCommonType(t1, t2);
  }

  // Try each type in order from smallest to largest
  for (const candidate of SUFFIX_ORDER) {
    if (
      isTypeCompatible(candidate, t1 as IntSuffix) &&
      isTypeCompatible(candidate, t2 as IntSuffix)
    ) {
      return candidate;
    }
  }

  // No compatible integer type found
  throwNoCommonType(t1, t2);
}

function validateIntLiteral(rawNum: string, suffix: IntSuffix): void {
  const value: number = parseInt(rawNum, 10);
  const [min, max]: [number, number] = INT_RANGES[suffix];
  if (value < min || value > max) {
    throw new Error(
      `Range error: ${rawNum} is out of range for ${suffix} (${min}..${max})`,
    );
  }
}

interface Binding {
  type: TuffType;
  jsName: string;
  mutable: boolean;
}

class NotAStatementBlockError extends Error {}

function parseProgram(tokens: Tok[]): string {
  let pos: number = 0;
  let env: Map<string, Binding> = new Map();
  let nameCounter: Map<string, number> = new Map();

  function peek(): Tok | undefined {
    return tokens[pos];
  }

  function consume(): Tok {
    return tokens[pos++]!;
  }

  function expect(kind: TK): Tok {
    const t: Tok | undefined = peek();
    if (!t || t.kind !== kind) {
      throw new Error(
        `Syntax error: expected "${kind}" but got "${t?.val ?? "end of input"}"`,
      );
    }
    return consume();
  }

  function expectType(context: string): TuffType {
    const t: Tok | undefined = peek();
    if (!t || t.kind !== "NAME" || !VALID_TYPES.has(t.val)) {
      throw new Error(
        `Syntax error: expected type ${context} but got "${t?.val ?? "end of input"}"`,
      );
    }
    return consume().val as TuffType;
  }

  function consumeSuffix(): IntSuffix {
    const maybeSuffix: Tok | undefined = peek();
    return maybeSuffix?.kind === "NAME" && VALID_SUFFIXES.has(maybeSuffix.val)
      ? (consume().val as IntSuffix)
      : "I32";
  }

  function requireBinding(name: string): Binding {
    const binding: Binding | undefined = env.get(name);
    if (binding === undefined) {
      throw new Error(`Type error: unknown variable "${name}"`);
    }
    return binding;
  }

  function requireMutableBinding(name: string): Binding {
    const binding: Binding = requireBinding(name);
    if (!binding.mutable) {
      throw new Error(
        `Type error: cannot assign to immutable variable "${name}"`,
      );
    }
    return binding;
  }

  function assertTypeCompatible(target: TuffType, source: TuffType): void {
    if (!isTypeCompatible(target, source)) {
      throw new Error(`Type error: cannot assign ${source} to ${target}`);
    }
  }

  function createArithmeticCompoundExpr(
    varType: TuffType,
    varCode: string,
    op: string,
    rhs: TypedExpr,
  ): TypedExpr {
    if (varType === "Bool") {
      throw new Error(
        "Type error: Bool not compatible with arithmetic operators",
      );
    }
    const resultType: TuffType = promoteTypes(varType, rhs.type);
    return { code: `${varCode} ${op} ${rhs.code}`, type: resultType };
  }

  function parseBinaryLevel(inner: () => TypedExpr, ops: Set<TK>): TypedExpr {
    let left: TypedExpr = inner();
    let op: Tok | undefined = peek();
    while (op !== undefined && ops.has(op.kind)) {
      consume();
      const right: TypedExpr = inner();
      left = {
        code: `${left.code} ${op.val} ${right.code}`,
        type: promoteTypes(left.type, right.type),
      };
      op = peek();
    }
    return left;
  }

  const MUL_OPS: Set<TK> = new Set<TK>(["STAR", "SLASH"]);
  const ADD_OPS: Set<TK> = new Set<TK>(["PLUS", "MINUS"]);

  function parseAtom(): TypedExpr {
    const t: Tok | undefined = peek();
    if (!t) throw new Error("Syntax error: unexpected end of expression");

    if (t.kind === "MINUS") {
      consume();
      const numTok: Tok = expect("NUM");
      const rawNum: string = `-${numTok.val}`;
      const suffix: IntSuffix = consumeSuffix();
      validateIntLiteral(rawNum, suffix);
      return { code: rawNum, type: suffix };
    }

    if (t.kind === "NUM") {
      consume();
      const suffix: IntSuffix = consumeSuffix();
      validateIntLiteral(t.val, suffix);
      return { code: t.val, type: suffix };
    }

    if (t.kind === "NAME" && (t.val === "true" || t.val === "false")) {
      consume();
      return { code: t.val, type: "Bool" };
    }

    if (t.kind === "NAME" && t.val === "read") {
      consume();
      expect("LT");
      const readType: TuffType = expectType('after "read<"');
      expect("GT");
      expect("LPAREN");
      expect("RPAREN");
      if (readType === "Bool") {
        return { code: "readBool()", type: "Bool" };
      }
      return { code: "read()", type: readType as IntSuffix };
    }

    if (t.kind === "NAME" && t.val === "if") {
      return parseIfExpression();
    }

    if (t.kind === "NAME") {
      const binding: Binding = requireBinding(t.val);
      consume();
      return { code: binding.jsName, type: binding.type };
    }

    if (t.kind === "LBRACE") {
      return parseBlockExpr();
    }

    if (t.kind === "LPAREN") {
      consume();
      const expr: TypedExpr = parseOr();
      expect("RPAREN");
      return expr;
    }

    throw new Error(`Syntax error: unexpected token "${t.val}"`);
  }

  function parseMul(): TypedExpr {
    return parseBinaryLevel(parseAtom, MUL_OPS);
  }

  function parseAdd(): TypedExpr {
    return parseBinaryLevel(parseMul, ADD_OPS);
  }

  function parseBoolBinary(
    inner: () => TypedExpr,
    opTk: TK,
    opStr: string,
  ): TypedExpr {
    let left: TypedExpr = inner();
    while (peek()?.kind === opTk) {
      consume();
      const right: TypedExpr = inner();
      if (left.type !== "Bool" || right.type !== "Bool") {
        throw new Error(`Type error: ${opStr} requires Bool operands`);
      }
      left = { code: `${left.code} ${opStr} ${right.code}`, type: "Bool" };
    }
    return left;
  }

  const CMP_OPS: Set<TK> = new Set<TK>([
    "LT",
    "LT_EQ",
    "GT",
    "GT_EQ",
    "EQ_EQ",
    "BANG_EQ",
  ]);
  const ORDERED_CMP_OPS: Set<TK> = new Set<TK>(["LT", "LT_EQ", "GT", "GT_EQ"]);

  function parseCmp(): TypedExpr {
    const left: TypedExpr = parseAdd();
    const op: Tok | undefined = peek();
    if (op === undefined || !CMP_OPS.has(op.kind)) return left;
    consume();
    const right: TypedExpr = parseAdd();
    if (ORDERED_CMP_OPS.has(op.kind)) {
      if (left.type === "Bool" || right.type === "Bool") {
        throw new Error(`Type error: ${op.val} requires integer operands`);
      }
    } else {
      if ((left.type === "Bool") !== (right.type === "Bool")) {
        throw new Error(`Type error: cannot compare Bool with integer`);
      }
    }
    return { code: `${left.code} ${op.val} ${right.code}`, type: "Bool" };
  }

  function parseNot(): TypedExpr {
    if (peek()?.kind === "BANG") {
      consume();
      const operand: TypedExpr = parseNot();
      if (operand.type !== "Bool") {
        throw new Error(`Type error: ! requires Bool operand`);
      }
      return { code: `!${operand.code}`, type: "Bool" };
    }
    return parseCmp();
  }

  function parseAnd(): TypedExpr {
    return parseBoolBinary(parseNot, "AMP_AMP", "&&");
  }

  function parseOr(): TypedExpr {
    return parseBoolBinary(parseAnd, "PIPE_PIPE", "||");
  }

  function failUnexpectedAfterExpression(actual: string): never {
    throw new Error(
      `Syntax error: unexpected token "${actual}" after expression`,
    );
  }

  function assertNoTrailing(stopAtRBrace: boolean): void {
    const next: Tok | undefined = peek();
    if (stopAtRBrace) {
      if (next?.kind === "RBRACE") {
        return;
      }
    } else if (next === undefined) {
      return;
    }
    failUnexpectedAfterExpression(next?.val ?? "end of input");
  }

  function parseLetStatement(stmts: string[]): void {
    consume();
    const isMut: boolean =
      peek()?.kind === "NAME" && peek()?.val === "mut"
        ? (consume(), true)
        : false;
    const nameTok: Tok = expect("NAME");
    const hasAnnotation: boolean = peek()?.kind === "COLON";
    let declaredType: TuffType;
    if (hasAnnotation) {
      consume();
      declaredType = expectType("for declared type");
    } else {
      declaredType = "I32"; // placeholder; overwritten after RHS parse
    }
    expect("EQ");
    const rhs: TypedExpr = parseOr();
    expect("SEMI");
    if (!hasAnnotation) {
      declaredType = rhs.type;
    } else {
      assertTypeCompatible(declaredType, rhs.type);
    }
    const n: number = (nameCounter.get(nameTok.val) ?? 0) + 1;
    nameCounter.set(nameTok.val, n);
    const jsName: string = n === 1 ? nameTok.val : `${nameTok.val}_${n}`;
    env.set(nameTok.val, { type: declaredType, jsName, mutable: isMut });
    const keyword: string = isMut ? "let" : "const";
    stmts.push(`${keyword} ${jsName} = ${rhs.code};`);
  }

  function parseAssignmentStatement(stmts: string[]): void {
    const nameTok: Tok = consume();
    consume(); // EQ
    const rhs: TypedExpr = parseOr();
    expect("SEMI");
    const binding: Binding = requireMutableBinding(nameTok.val);
    assertTypeCompatible(binding.type, rhs.type);
    stmts.push(`${binding.jsName} = ${rhs.code};`);
  }

  function parseCompoundAssignmentStatement(stmts: string[]): void {
    const nameTok: Tok = consume();
    const opTok: Tok = consume(); // compound operator
    const rhs: TypedExpr = parseOr();
    expect("SEMI");

    const binding: Binding = requireMutableBinding(nameTok.val);

    // Desugar: x op= rhs becomes x = x op rhs
    let desugaredExpr: TypedExpr;
    let useJsCompoundOp: boolean = false;

    if (
      opTok.kind === "PLUS_EQ" ||
      opTok.kind === "MINUS_EQ" ||
      opTok.kind === "STAR_EQ" ||
      opTok.kind === "SLASH_EQ"
    ) {
      const jsOp: string =
        opTok.kind === "PLUS_EQ"
          ? "+"
          : opTok.kind === "MINUS_EQ"
            ? "-"
            : opTok.kind === "STAR_EQ"
              ? "*"
              : "/";
      desugaredExpr = createArithmeticCompoundExpr(
        binding.type,
        binding.jsName,
        jsOp,
        rhs,
      );
      useJsCompoundOp = true;
    } else if (opTok.kind === "AMP_EQ" || opTok.kind === "PIPE_EQ") {
      if (binding.type !== "Bool") {
        throw new Error(
          "Type error: integer not compatible with bool operators",
        );
      }
      if (rhs.type !== "Bool") {
        throw new Error(
          "Type error: integer not compatible with bool operators",
        );
      }
      const jsOp: string = opTok.kind === "AMP_EQ" ? "&&" : "||";
      desugaredExpr = {
        code: `${binding.jsName} ${jsOp} ${rhs.code}`,
        type: "Bool",
      };
      useJsCompoundOp = false;
    } else {
      throw new Error(`Unexpected compound operator: ${opTok.kind}`);
    }

    assertTypeCompatible(binding.type, desugaredExpr.type);

    if (useJsCompoundOp) {
      stmts.push(`${binding.jsName} ${opTok.val} ${rhs.code};`);
    } else {
      stmts.push(`${binding.jsName} = ${desugaredExpr.code};`);
    }
  }

  function parseBoolCondition(contextName: string): TypedExpr {
    consume(); // keyword (if/while)
    expect("LPAREN");
    const cond: TypedExpr = parseOr();
    expect("RPAREN");
    if (cond.type !== "Bool") {
      throw new Error(
        `Type error: ${contextName} condition must be Bool, got ${cond.type}`,
      );
    }
    return cond;
  }

  function parseIfCondition(): TypedExpr {
    return parseBoolCondition("if");
  }

  function parseIfStatement(stmts: string[]): void {
    const cond: TypedExpr = parseIfCondition();

    const thenStmts: string[] = [];
    if (!tryParseStatement(thenStmts)) {
      throw new Error(
        "Syntax error: expected statement in if-then branch, got expression",
      );
    }

    if (peek()?.kind === "NAME" && peek()?.val === "else") {
      consume(); // "else"
      const elseStmts: string[] = [];

      if (peek()?.kind === "NAME" && peek()?.val === "if") {
        // else-if chain: recursively parse nested if-statement
        parseIfStatement(elseStmts);
      } else {
        if (!tryParseStatement(elseStmts)) {
          throw new Error(
            "Syntax error: expected statement in if-else branch, got expression",
          );
        }
      }

      stmts.push(
        `if (${cond.code}) {\n${thenStmts.join("\n")}\n} else {\n${elseStmts.join("\n")}\n}`,
      );
    } else {
      // no else clause
      stmts.push(`if (${cond.code}) {\n${thenStmts.join("\n")}\n}`);
    }
  }

  function parseWhileStatement(stmts: string[]): void {
    const cond: TypedExpr = parseBoolCondition("while");

    const bodyStmts: string[] = [];
    if (!tryParseStatement(bodyStmts)) {
      throw new Error(
        "Syntax error: expected statement in while body, got expression",
      );
    }

    stmts.push(`while (${cond.code}) {\n${bodyStmts.join("\n")}\n}`);
  }

  function withBlockScope<T>(parseBody: (innerStmts: string[]) => T): {
    innerStmts: string[];
    result: T;
  } {
    expect("LBRACE");
    const savedEnv: Map<string, Binding> = env;
    const savedNameCounter: Map<string, number> = nameCounter;
    env = new Map(env);
    nameCounter = new Map();
    const innerStmts: string[] = [];
    const result: T = parseBody(innerStmts);
    expect("RBRACE");
    env = savedEnv;
    nameCounter = savedNameCounter;
    return { innerStmts, result };
  }

  function parseStatementBlock(stmts: string[]): void {
    const { innerStmts } = withBlockScope((inner: string[]) => {
      while (peek()?.kind !== "RBRACE") {
        if (!tryParseStatement(inner)) {
          throw new NotAStatementBlockError();
        }
      }
    });
    stmts.push(`{\n${innerStmts.join("\n")}\n}`);
  }

  function tryParseStatement(stmts: string[]): boolean {
    if (peek()?.kind === "NAME" && peek()?.val === "let") {
      parseLetStatement(stmts);
      return true;
    }
    if (peek()?.kind === "NAME" && peek()?.val === "while") {
      parseWhileStatement(stmts);
      return true;
    }
    if (peek()?.kind === "NAME" && peek()?.val === "if") {
      const savedPos: number = pos;
      const savedEnv: Map<string, Binding> = env;
      const savedNameCounter: Map<string, number> = nameCounter;
      try {
        parseIfStatement(stmts);
        return true;
      } catch (error: unknown) {
        // Check if this was an "expected statement" error from if-statement parsing
        // If so, this is probably an if-expression, so backtrack and return false
        if (
          error instanceof Error &&
          error.message.includes("expected statement in if")
        ) {
          pos = savedPos;
          env = savedEnv;
          nameCounter = savedNameCounter;
          return false;
        }
        throw error;
      }
    }
    if (peek()?.kind === "NAME" && tokens[pos + 1]?.kind === "EQ") {
      parseAssignmentStatement(stmts);
      return true;
    }
    if (
      peek()?.kind === "NAME" &&
      (tokens[pos + 1]?.kind === "PLUS_EQ" ||
        tokens[pos + 1]?.kind === "MINUS_EQ" ||
        tokens[pos + 1]?.kind === "STAR_EQ" ||
        tokens[pos + 1]?.kind === "SLASH_EQ" ||
        tokens[pos + 1]?.kind === "AMP_EQ" ||
        tokens[pos + 1]?.kind === "PIPE_EQ")
    ) {
      parseCompoundAssignmentStatement(stmts);
      return true;
    }
    if (peek()?.kind === "LBRACE") {
      const savedPos: number = pos;
      const savedEnv: Map<string, Binding> = env;
      const savedNameCounter: Map<string, number> = nameCounter;
      try {
        parseStatementBlock(stmts);
        return true;
      } catch (error: unknown) {
        pos = savedPos;
        env = savedEnv;
        nameCounter = savedNameCounter;
        if (error instanceof NotAStatementBlockError) {
          return false;
        }
        throw error;
      }
    }
    return false;
  }

  function parseBlockExpr(): TypedExpr {
    const { innerStmts, result: blockFinal } = withBlockScope(
      (inner: string[]) => {
        while (tryParseStatement(inner)) {
          // keep consuming statements that appear before the final expression
        }
        if (peek()?.kind === "RBRACE") {
          throw new Error("Syntax error: block must end with an expression");
        }
        const finalExpr: TypedExpr = parseOr();
        assertNoTrailing(true);
        return finalExpr;
      },
    );
    innerStmts.push(`return ${blockFinal.code};`);
    return {
      code: `(() => {\n${innerStmts.join("\n")}\n})()`,
      type: blockFinal.type,
    };
  }

  function parseIfExpression(): TypedExpr {
    const cond: TypedExpr = parseIfCondition();

    const thenExpr: TypedExpr = parseOr();

    if (peek()?.kind !== "NAME" || peek()?.val !== "else") {
      throw new Error("Syntax error: if-expression requires else clause");
    }
    consume(); // "else"

    let elseExpr: TypedExpr;
    if (peek()?.kind === "NAME" && peek()?.val === "if") {
      // else-if chain: recursively parse nested if-expression
      elseExpr = parseIfExpression();
    } else {
      elseExpr = parseOr();
    }

    const resultType: TuffType = findCommonType(thenExpr.type, elseExpr.type);

    return {
      code: `(${cond.code} ? ${thenExpr.code} : ${elseExpr.code})`,
      type: resultType,
    };
  }

  const stmts: string[] = [];
  while (tryParseStatement(stmts)) {
    // consume all leading statements
  }
  if (pos >= tokens.length) {
    return stmts.join("\n");
  }
  const finalExpr: TypedExpr = parseOr();
  assertNoTrailing(false);
  stmts.push(
    `return ${finalExpr.type === "Bool" ? `${finalExpr.code} ? 1 : 0` : finalExpr.code};`,
  );
  return stmts.join("\n");
}

export function compileTuffToTS(tuffSourceCode: string): string {
  const trimmed: string = tuffSourceCode.trim();
  if (trimmed === "") return "";
  return parseProgram(tokenize(trimmed));
}
