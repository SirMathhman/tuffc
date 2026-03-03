// The current tests only need a simple compile function that returns a
// Javascript program body. Helpers such as `ok`/`err` are inlined below and
// unused imports have been removed to keep linting happy.

// Success variant of the Result type
export interface ResultOk<T> {
  ok: true;
  value: T;
}

// Error variant of the Result type
export interface ResultErr<E> {
  ok: false;
  error: E;
}

// Combined Result type using named variants
export type Result<T, E> = ResultOk<T> | ResultErr<E>;

// Different categories of compile errors. Tests use this enum to verify that
// a particular case produces the expected kind of failure.
// enum values are exported for external use but lint sees them as unused
// within this module; disable the rule for the block
/* eslint-disable no-unused-vars */
export enum CompileErrorType {
  NotImplemented = "NotImplemented",
  NegativeUnsigned = "NegativeUnsigned",
  UnsignedOverflow = "UnsignedOverflow",
  DuplicateDeclaration = "DuplicateDeclaration",
}
/* eslint-enable no-unused-vars */

// Custom error information produced by the compiler. Consumers can use the
// `source` field to highlight the offending code, `message` for a user-facing
// explanation, `reason` for an internal summary, and `fix` to suggest a way to
// correct the problem.  The `type` property allows callers to distinguish
// classes of errors programmatically.
export interface CompileError {
  source: string;
  message: string;
  reason: string;
  fix: string;
  type: CompileErrorType;
}

// helper factory for unsigned overflow errors; lives at the top level so
// it can be reused across multiple call sites inside compile() without
// triggering the inner-function hook.
const makeU8Overflow = (src: string): CompileError => ({
  source: src,
  message: "Unsigned addition overflow",
  reason: "u8 addition out of range",
  fix: "use smaller values or a larger integer type",
  type: CompileErrorType.UnsignedOverflow,
});

// extract variable name from a `let` declaration string (e.g. "let x : I32 = 0").
// defined at top level to avoid inner-function violations.
function extractLetName(str: string): string | undefined {
  if (!str.startsWith("let ")) return undefined;
  const afterLet = str.slice(4).trim();
  const eq = afterLet.indexOf("=");
  if (eq === -1) return undefined;
  let left = afterLet.slice(0, eq).trim();
  const colon = left.indexOf(":");
  if (colon !== -1) {
    // strip off type annotation
    left = left.slice(0, colon).trim();
  }
  return left.length > 0 ? left : undefined;
}


// Detects any read<T>() call notation, e.g. read<I32>(), read<U8>(), read().
function isReadExpr(s: string): boolean {
  if (s === "read()") return true;
  if (s.startsWith("read<") && s.endsWith(">()")) {
    const inner = s.slice(5, s.length - 3); // strip "read<" and ">()"
    if (Array.from(inner).every((ch) => (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9"))) return true;
  }
  return false;
}
// strip `return` and trailing semicolon from generated body
function strip(js: string): string {
  if (js.startsWith("return ")) js = js.slice(7);
  if (js.endsWith(";")) js = js.slice(0, -1);
  return js;
}

// returns the annotated type of a let declaration (without spaces), or
// undefined if none present. simpler implementation avoids repeating logic
// used by `extractLetName`.
function extractLetType(str: string): string | undefined {
  const colon = str.indexOf(":");
  const eq = str.indexOf("=");
  if (colon === -1 || eq === -1) return undefined;
  // ensure colon comes before equals
  if (colon > eq) return undefined;
  return str.slice(colon + 1, eq).trim();
}


// create a standard overflow error result
function overflowResult(src: string): Result<string, CompileError> {
  return {
    ok: false,
    error: {
      source: src,
      message: "Unsigned addition overflow",
      reason: "u8 assignment from u16",
      fix: "use compatible types or cast",
      type: CompileErrorType.UnsignedOverflow,
    },
  };
}
// Named type for a parsed term descriptor
export interface TermInfo {
  js: string;
  uval?: number;
  width?: number;
}

// Accumulator type for reduce operation during term analysis
export interface TermAccumulator {
  u8sum: number;
  plainSum: number;
  hasU8: boolean;
  hasU16: boolean;
}

// Parses a single term in an addition expression into a TermInfo descriptor.
// Returns undefined for any term that cannot be recognised.
function parseTerm(t: string): TermInfo | undefined {
  if (isReadExpr(t)) return { js: "read()" };
  let idx2 = 0;
  if (t[idx2] === "+" || t[idx2] === "-") idx2++;
  let rest2 = t.slice(idx2);
  let suffix = "";
  let uval: number | undefined;
  let width: number | undefined;
  if (rest2.endsWith("U8") || rest2.endsWith("U16")) {
    if (t.startsWith("-")) return undefined;
    if (rest2.endsWith("U8")) {
      suffix = "U8";
      width = 8;
    } else {
      suffix = "U16";
      width = 16;
    }
    rest2 = rest2.slice(0, -suffix.length);
    const num = parseInt(rest2, 10);
    if (isNaN(num) || num < 0 || num > (width === 8 ? 255 : 65535))
      return undefined;
    uval = num;
  }
  if (
    rest2.length > 0 &&
    Array.from(rest2).every((ch) => ch >= "0" && ch <= "9")
  ) {
    return { js: t.slice(0, t.length - suffix.length), uval, width };
  }
  return undefined;
}

export function compile(source: string): Result<string, CompileError> {
  // A minimal implementation to make the existing tests pass. The tests
  // currently validate an empty program evaluates to 0 and that a numeric
  // literal returns its value. Anything else still returns an error so that
  // we can extend this function later without changing behaviour for now.

  const trimmed = source.trim();
  // track width information for let-bound names (8,16 or undefined)
  const letTypes = new Map<string, number | undefined>();
  // shared parts array used in several checks
  const parts = trimmed.split(";").map((s) => s.trim()).filter((s) => s.length > 0);

  // detect duplicate `let` bindings by name before parsing further. we simply
  // inspect each declaration head. this is crude but sufficient for the
  // current tests.
  {
    const seen = new Set<string>();
    for (const part of parts) {
      const name = extractLetName(part);
      if (name) {
        if (seen.has(name)) {
          return {
            ok: false,
            error: {
              source,
              message: "Duplicate variable declaration",
              reason: "duplicate let binding",
              fix: "use distinct names",
              type: CompileErrorType.DuplicateDeclaration,
            },
          };
        }
        seen.add(name);
      }
    }
  }

  // support multiple semicolon-separated statements. we process each
  // segment and emit a single JS function body where `let` bindings and
  // expressions share the same scope. this avoids the previous recursion
  // design which isolated each part in its own IIFE (breaking variable use).
  if (trimmed.includes(";")) {
    const stmts: string[] = [];
    let finalExpr: string | undefined;
    for (const [i, part] of parts.entries()) {
      if (part.startsWith("let ")) {
        const name = extractLetName(part)!; // name exists because startsWith let
        const initExpr = part.slice(part.indexOf("=") + 1).trim();
        const declaredType = extractLetType(part);
        // determine initializer width (literal or previous variable)
        let initWidth: number | undefined;
        if (initExpr.endsWith("U8")) initWidth = 8;
        else if (initExpr.endsWith("U16")) initWidth = 16;
        else if (letTypes.has(initExpr)) initWidth = letTypes.get(initExpr);
        // overflow check for U8
        if (declaredType === "U8" && initWidth === 16) {
          return overflowResult(source);
        }
        const initRes = compile(initExpr);
        if (!initRes.ok) return initRes;
        const initJs = strip(initRes.value);
        stmts.push(`let ${name} = ${initJs};`);
        // record type info
        if (declaredType === "U8") letTypes.set(name, 8);
        else if (declaredType === "U16") letTypes.set(name, 16);
        else letTypes.set(name, initWidth);
        continue;
      }
      const exprRes = compile(part);
      if (!exprRes.ok) return exprRes;
      const exprJs = strip(exprRes.value);
      if (i === parts.length - 1) {
        finalExpr = exprJs;
      } else {
        stmts.push(exprJs + ";");
      }
    }
    if (finalExpr !== undefined) {
      return { ok: true, value: "return (()=>{" + (stmts.join(" ") + (stmts.length ? " " : "") + "return " + finalExpr + ";") + "})()" };
    }
    // no final expression – default to returning 0
    return { ok: true, value: "return (()=>{" + (stmts.join(" ") + "return 0;") + "})()" };
  }



  // support a trivial let-binding pattern used by tests. this is not a
  // full statement parser; we only handle the specific form:
  //   let <name> : <type> = <expr>; [<name>]?
  // where the optional trailing expression is the same identifier. if omitted,
  // the binding executes but nothing is returned (equivalent to returning 0).
  if (trimmed.startsWith("let ")) {
    // handle both `let x = ...` and `let x = ...; rest`
    const semi = trimmed.indexOf(";");
    const decl = semi !== -1 ? trimmed.slice(0, semi).trim() : trimmed;
    const rest = semi !== -1 ? trimmed.slice(semi + 1).trim() : "";
    const name = extractLetName(decl);
    if (name) {
      const initExpr = decl.slice(decl.indexOf("=") + 1).trim();
      // before compiling, check for type mismatch when annotation present
      const declaredType = extractLetType(decl);
      if (declaredType && initExpr.endsWith("U16") && declaredType === "U8") {
        return overflowResult(source);
      }
      // accept either rest === name OR rest is empty (no trailing expr)
      if (rest === name || rest === "") {
        const initRes = compile(initExpr);
        if (!initRes.ok) return initRes;
        let initJs = initRes.value;
        if (initJs.startsWith("return ")) {
          initJs = initJs.slice(7);
          if (initJs.endsWith(";")) initJs = initJs.slice(0, -1);
        }
        return {
          ok: true,
          value:
            "return (()=>{let " +
            name +
            " = " +
            initJs +
            "; return " +
            (rest === name ? name : "0") +
            ";})()",
        };
      }
    }
  }
  // quickly handle a couple of explicit error cases so we can return specific
  // error types rather than falling through to the generic stub at the end.
  // negative unsigned check without regex
  if (
    trimmed.startsWith("-") &&
    trimmed.endsWith("U8") &&
    Array.from(trimmed.slice(1, -2)).every((ch) => ch >= "0" && ch <= "9")
  ) {
    return {
      ok: false,
      error: {
        source,
        message: "Negative value not allowed for unsigned type",
        reason: "negative unsigned literal",
        fix: "remove the '-' or the 'U8' suffix",
        type: CompileErrorType.NegativeUnsigned,
      },
    };
  }
  // unsigned overflow check without regex (literal exceeding 255)
  if (
    trimmed.endsWith("U8") &&
    Array.from(trimmed.slice(0, -2)).every((ch) => ch >= "0" && ch <= "9")
  ) {
    const num = parseInt(trimmed.slice(0, -2), 10);
    if (isNaN(num) || num > 255) {
      return { ok: false, error: {
          source,
          message: "Value out of range for U8",
          reason: "unsigned literal overflow",
          fix: "use a smaller value (0..255)",
          type: CompileErrorType.UnsignedOverflow,
      }};
    }
  }

  if (trimmed === "") {
    return { ok: true, value: "return 0;" };
  }

  // Handle a simple read expression used by tests. Support both the generic
  // syntax `read<I32>()` and plain `read()` to make parsing trivial.
  if (isReadExpr(trimmed)) {
    return { ok: true, value: "return read();" };
  }

  // Support a binary addition of two simple terms, e.g. "read<I32>() + 5" or
  // "read<I32>() + read<I32>()". We avoid full parsing by splitting on the
  // first `+` and ensuring both sides are themselves recognised by the small
  // term matcher we already have below.
  // handle expressions containing '+' with any number of terms
  if (trimmed.includes("+")) {
    const parts = trimmed.split("+").map((s) => s.trim());
    // check for literal U8 out-of-range inside multi-term expression
    for (const p of parts) {
      if (p.endsWith("U8")) {
        const num = parseInt(p.slice(0, -2), 10);
        if (!isNaN(num) && num > 255) {
          return { ok: false, error: makeU8Overflow(source) };
        }
      }
    }

    const infos = parts.map(parseTerm);
    if (infos.every((x) => x !== undefined)) {
      const { u8sum, plainSum, hasU8, hasU16 } = infos.reduce(
        (acc: TermAccumulator, x: TermInfo | undefined) => ({
          hasU8: acc.hasU8 || x!.width === 8,
          hasU16: acc.hasU16 || x!.width === 16,
          u8sum: acc.u8sum + (x!.width === 8 ? (x!.uval ?? 0) : 0),
          plainSum: acc.plainSum + (x!.width === undefined ? (isNaN(parseInt(x!.js, 10)) ? 0 : parseInt(x!.js, 10)) : 0),
        }),
        { u8sum: 0, plainSum: 0, hasU8: false, hasU16: false },
      );
      if (hasU8 && !hasU16 && u8sum + plainSum > 255) {
        return { ok: false, error: makeU8Overflow(source) };
      }
      // build sanitized JS expression from infos.js to strip suffixes
      const sanitized = infos.map((x) => x!.js).join(" + ");
      return { ok: true, value: "return " + sanitized + ";" };
    }
    // invalid term -> fall through
  }

  // Recognise a simple integer literal (optional leading +/-, digits only),
  // with optional `U8` suffix. We simply strip the suffix when emitting JS.
  {
    let idx = 0;
    if (trimmed[idx] === "+" || trimmed[idx] === "-") {
      idx++;
    }
    let rest = trimmed.slice(idx);
    const hasU8 = rest.endsWith("U8");
    if (hasU8) {
      // reject negative unsigned literals
      if (trimmed.startsWith("-")) {
        // fall through to error case below
      } else {
        rest = rest.slice(0, -2);
        const num = parseInt(rest, 10);
        if (isNaN(num) || num < 0 || num > 255) {
          // invalid range, fall through to failure
          rest = "";
        }
      }
    }
    if (
      rest.length > 0 &&
      Array.from(rest).every((ch) => ch >= "0" && ch <= "9")
    ) {
      // drop the `U8` suffix if present; compute inline.
      return {
        ok: true,
        value: "return " +
          (hasU8 ? trimmed.slice(0, -2) : trimmed) +
          ";",
      };
    }
  }

  // allow bare identifiers as expressions (variables introduced by previous
  // let statements or builtins such as `x`).
  {
    // allow bare identifiers as expressions (variables introduced by previous
    // let statements or builtins such as `x`).
    const s = trimmed;
    let isIdVal = false;
    if (s.length > 0) {
      const first = s[0];
      if (
        first === "_" ||
        first === "$" ||
        (first >= "a" && first <= "z") ||
        (first >= "A" && first <= "Z")
      ) {
        isIdVal = Array.from(s).every((ch) =>
          ch === "_" ||
          ch === "$" ||
          (ch >= "a" && ch <= "z") ||
          (ch >= "A" && ch <= "Z") ||
          (ch >= "0" && ch <= "9"),
        );
      }
    }
    if (isIdVal) {
      return { ok: true, value: "return " + trimmed + ";" };
    }
  }

  return {
    ok: false,
    error: {
      source,
      message: "Compilation is not implemented yet",
      reason: "stub",
      fix: "implement the compiler",
      type: CompileErrorType.NotImplemented,
    },
  };
}