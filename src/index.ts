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
  | "SLASH";

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

function validateIntLiteral(rawNum: string, suffix: IntSuffix): void {
  const value: number = parseInt(rawNum, 10);
  const [min, max]: [number, number] = INT_RANGES[suffix];
  if (value < min || value > max) {
    throw new Error(
      `Range error: ${rawNum} is out of range for ${suffix} (${min}..${max})`,
    );
  }
}

function parseExpr(tokens: Tok[]): string {
  let pos: number = 0;

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

  function consumeSuffix(): IntSuffix {
    const maybeSuffix: Tok | undefined = peek();
    return maybeSuffix?.kind === "NAME" && VALID_SUFFIXES.has(maybeSuffix.val)
      ? (consume().val as IntSuffix)
      : "I32";
  }

  function parseAtom(): string {
    const t: Tok | undefined = peek();
    if (!t) throw new Error("Syntax error: unexpected end of expression");

    if (t.kind === "MINUS") {
      consume();
      const numTok: Tok = expect("NUM");
      const rawNum: string = `-${numTok.val}`;
      validateIntLiteral(rawNum, consumeSuffix());
      return rawNum;
    }

    if (t.kind === "NUM") {
      consume();
      const suffix: IntSuffix = consumeSuffix();
      validateIntLiteral(t.val, suffix);
      return t.val;
    }

    if (t.kind === "NAME" && t.val === "read") {
      consume();
      expect("LT");
      const suffixTok: Tok | undefined = peek();
      if (
        !suffixTok ||
        suffixTok.kind !== "NAME" ||
        !VALID_SUFFIXES.has(suffixTok.val)
      ) {
        throw new Error(
          `Syntax error: expected valid type suffix after "read<" but got "${suffixTok?.val ?? "end of input"}"`,
        );
      }
      consume();
      expect("GT");
      expect("LPAREN");
      expect("RPAREN");
      return "read()";
    }

    throw new Error(`Syntax error: unexpected token "${t.val}"`);
  }

  function parseMul(): string {
    let left: string = parseAtom();
    while (peek()?.kind === "STAR" || peek()?.kind === "SLASH") {
      const op: string = consume().val;
      const right: string = parseAtom();
      left = `${left} ${op} ${right}`;
    }
    return left;
  }

  function parseAdd(): string {
    let left: string = parseMul();
    while (peek()?.kind === "PLUS" || peek()?.kind === "MINUS") {
      const op: string = consume().val;
      const right: string = parseMul();
      left = `${left} ${op} ${right}`;
    }
    return left;
  }

  const expr: string = parseAdd();
  if (pos < tokens.length) {
    throw new Error(
      `Syntax error: unexpected token "${tokens[pos]!.val}" after expression`,
    );
  }
  return `return ${expr};`;
}

export function compileTuffToTS(tuffSourceCode: string): string {
  const trimmed: string = tuffSourceCode.trim();
  if (trimmed === "") return "";
  return parseExpr(tokenize(trimmed));
}
