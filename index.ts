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

// Detects any read<T>() call notation, e.g. read<I32>(), read<U8>(), read().
const isReadExpr = (s: string): boolean => {
  if (s === "read()") return true;
  if (s.startsWith("read<") && s.endsWith(">()")) {
    const inner = s.slice(5, s.length - 3); // strip "read<" and ">()"
    if (Array.from(inner).every((ch) => (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9"))) return true;
  }
  return false;
};

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

  // support a trivial let-binding pattern used by tests. this is not a
  // full statement parser; we only handle the specific form:
  //   let <name> : <type> = <expr>; <name>
  // where the trailing expression is the same identifier. we accept any
  // initializer that the compiler already recognises (constants, reads, etc.)
  // by recursively invoking `compile` and then stripping the leading
  // `return`/`;` from the generated body.
  if (trimmed.startsWith("let ")) {
    const semi = trimmed.indexOf(";");
    if (semi !== -1) {
      const decl = trimmed.slice(0, semi).trim();
      const rest = trimmed.slice(semi + 1).trim();
      const afterLet = decl.slice(4).trim(); // drop "let "
      const eq = afterLet.indexOf("=");
      if (eq !== -1) {
        const left = afterLet.slice(0, eq).trim();
        const initExpr = afterLet.slice(eq + 1).trim();
        const colon = left.indexOf(":");
        if (colon !== -1) {
          const name = left.slice(0, colon).trim();
          // we don't enforce the type here; the test cares only about U8
          if (rest === name) {
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
                name +
                ";})()",
            };
          }
        }
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