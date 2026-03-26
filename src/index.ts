type IntSuffix = "U8" | "I8" | "U16" | "I16" | "U32" | "I32" | "U64" | "I64";

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
  | "EQ";

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
      const kind: TK | undefined = CH_TO_TK[ch];
      if (!kind) throw new Error(`Syntax error: unexpected character "${ch}"`);
      tokens.push({ kind, val: ch });
      i++;
    }
  }
  return tokens;
}

interface TypedExpr {
  code: string;
  type: IntSuffix;
}

function promoteTypes(a: IntSuffix, b: IntSuffix): IntSuffix {
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

function isTypeCompatible(declared: IntSuffix, inferred: IntSuffix): boolean {
  const [dMin, dMax]: [number, number] = INT_RANGES[declared];
  const [iMin, iMax]: [number, number] = INT_RANGES[inferred];
  return dMin <= iMin && dMax >= iMax;
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
  type: IntSuffix;
  jsName: string;
  mutable: boolean;
}

function parseProgram(tokens: Tok[]): string {
  let pos: number = 0;
  const env: Map<string, Binding> = new Map();
  const nameCounter: Map<string, number> = new Map();

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

  function expectSuffix(context: string): IntSuffix {
    const t: Tok | undefined = peek();
    if (!t || t.kind !== "NAME" || !VALID_SUFFIXES.has(t.val)) {
      throw new Error(
        `Syntax error: expected type suffix ${context} but got "${t?.val ?? "end of input"}"`,
      );
    }
    return consume().val as IntSuffix;
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

  function assertTypeCompatible(target: IntSuffix, source: IntSuffix): void {
    if (!isTypeCompatible(target, source)) {
      throw new Error(`Type error: cannot assign ${source} to ${target}`);
    }
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

    if (t.kind === "NAME" && t.val === "read") {
      consume();
      expect("LT");
      const readType: IntSuffix = expectSuffix('after "read<"');
      expect("GT");
      expect("LPAREN");
      expect("RPAREN");
      return { code: "read()", type: readType };
    }

    if (t.kind === "NAME") {
      const binding: Binding = requireBinding(t.val);
      consume();
      return { code: binding.jsName, type: binding.type };
    }

    throw new Error(`Syntax error: unexpected token "${t.val}"`);
  }

  function parseMul(): TypedExpr {
    return parseBinaryLevel(parseAtom, MUL_OPS);
  }

  function parseAdd(): TypedExpr {
    return parseBinaryLevel(parseMul, ADD_OPS);
  }

  const stmts: string[] = [];

  while (pos < tokens.length) {
    if (peek()?.kind === "NAME" && peek()?.val === "let") {
      consume();
      const isMut: boolean =
        peek()?.kind === "NAME" && peek()?.val === "mut"
          ? (consume(), true)
          : false;
      const nameTok: Tok = expect("NAME");
      const hasAnnotation: boolean = peek()?.kind === "COLON";
      let declaredType: IntSuffix;
      if (hasAnnotation) {
        consume();
        declaredType = expectSuffix("for declared type");
      } else if (!isMut) {
        throw new Error(
          `Syntax error: immutable let requires a type annotation`,
        );
      } else {
        declaredType = "I32"; // placeholder; overwritten after RHS parse
      }
      expect("EQ");
      const rhs: TypedExpr = parseAdd();
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
    } else if (peek()?.kind === "NAME" && tokens[pos + 1]?.kind === "EQ") {
      const nameTok: Tok = consume();
      consume(); // EQ
      const rhs: TypedExpr = parseAdd();
      expect("SEMI");
      const binding: Binding = requireBinding(nameTok.val);
      if (!binding.mutable) {
        throw new Error(
          `Type error: cannot assign to immutable variable "${nameTok.val}"`,
        );
      }
      assertTypeCompatible(binding.type, rhs.type);
      stmts.push(`${binding.jsName} = ${rhs.code};`);
    } else {
      const expr: TypedExpr = parseAdd();
      if (pos < tokens.length) {
        throw new Error(
          `Syntax error: unexpected token "${tokens[pos]!.val}" after expression`,
        );
      }
      stmts.push(`return ${expr.code};`);
      return stmts.join("\n");
    }
  }

  throw new Error("Syntax error: program must end with an expression");
}

export function compileTuffToTS(tuffSourceCode: string): string {
  const trimmed: string = tuffSourceCode.trim();
  if (trimmed === "") return "";
  return parseProgram(tokenize(trimmed));
}
