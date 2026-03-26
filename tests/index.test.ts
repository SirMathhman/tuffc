/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test";
import { compileTuffToTS, evaluateTuff, greet } from "../src/index.ts";

const supportedIntegerCases = [
  { source: "100U8", ts: "export default 100;", value: 100 },
  { source: "+100U8", ts: "export default 100;", value: 100 },
  { source: " 100U16 ", ts: "export default 100;", value: 100 },
  { source: "+100U32", ts: "export default 100;", value: 100 },
  { source: "100U64", ts: "export default 100n;", value: 100n },
  { source: "-1I8", ts: "export default -1;", value: -1 },
  { source: "+1I16", ts: "export default 1;", value: 1 },
  {
    source: "-2147483648I32",
    ts: "export default -2147483648;",
    value: -2147483648,
  },
  {
    source: "9223372036854775807I64",
    ts: "export default 9223372036854775807n;",
    value: 9223372036854775807n,
  },
] as const;

const readCases = [
  {
    source: "read<U8>()",
    stdIn: "100",
    ts: 'export default __tuffRead("U8");',
    value: 100,
  },
  {
    source: "read<U16>()",
    stdIn: "65535",
    ts: 'export default __tuffRead("U16");',
    value: 65535,
  },
  {
    source: "read<U32>()",
    stdIn: "4294967295",
    ts: 'export default __tuffRead("U32");',
    value: 4294967295,
  },
  {
    source: "read<U64>()",
    stdIn: "18446744073709551615",
    ts: 'export default __tuffRead("U64");',
    value: 18446744073709551615n,
  },
  {
    source: "read<I8>()",
    stdIn: "-1",
    ts: 'export default __tuffRead("I8");',
    value: -1,
  },
  {
    source: "read<I16>()",
    stdIn: "-32768",
    ts: 'export default __tuffRead("I16");',
    value: -32768,
  },
  {
    source: "read<I32>()",
    stdIn: "2147483647",
    ts: 'export default __tuffRead("I32");',
    value: 2147483647,
  },
  {
    source: "read<I64>()",
    stdIn: "-9223372036854775808",
    ts: 'export default __tuffRead("I64");',
    value: -9223372036854775808n,
  },
] as const;

const arithmeticCases = [
  {
    source: "1U8 + 2U8 * 3U8",
    ts: "export default (1 + (2 * 3));",
    stdIn: "",
    value: 7,
  },
  {
    source: "(1U8 + 2U8) * 3U8",
    ts: "export default ((1 + 2) * 3);",
    stdIn: "",
    value: 9,
  },
  {
    source: "10U8 - 3U8 - 2U8",
    ts: "export default ((10 - 3) - 2);",
    stdIn: "",
    value: 5,
  },
  {
    source: "8U8 / 2U8",
    ts: "export default __tuffDiv(8, 2);",
    stdIn: "",
    value: 4,
  },
  {
    source: "9U8 % 4U8",
    ts: "export default __tuffMod(9, 4);",
    stdIn: "",
    value: 1,
  },
  {
    source: "read<U8>() + read<U8>() + 3U8",
    stdIn: "1 2",
    ts: 'export default ((__tuffRead("U8") + __tuffRead("U8")) + 3);',
    value: 6,
  },
  {
    source: "read<U64>() + 2U8",
    stdIn: "100",
    ts: 'export default (__tuffRead("U64") + BigInt(2));',
    value: 102n,
  },
] as const;

const letCases = [
  {
    source: "let x = 100U8; x",
    ts: "const x = 100;\nexport default x;",
    stdIn: "",
    value: 100,
  },
  {
    source: "let x: I32 = 100; x",
    ts: "const x = 100;\nexport default x;",
    stdIn: "",
    value: 100,
  },
  {
    source: "let x = read<U8>(); x + 1U8",
    ts: 'const x = __tuffRead("U8");\nexport default (x + 1);',
    stdIn: "41",
    value: 42,
  },
  {
    source: "let x = 2U8; let y: U16 = x + 3U8; y * 4U8",
    ts: "const x = 2;\nconst y = (x + 3);\nexport default (y * 4);",
    stdIn: "",
    value: 20,
  },
  {
    source: "let x: U8 = 100U8;",
    ts: "const x = 100;\nexport default 0;",
    stdIn: "",
    value: 0,
  },
  {
    source: "let x = 100U8;",
    ts: "const x = 100;\nexport default 0;",
    stdIn: "",
    value: 0,
  },
] as const;

const invalidLetCases = [
  "let x = 100U8",
  "let x: U8 = 100U8",
  "let x = 1U8; x = 2U8; x",
] as const;

const invalidTypedLetCases = [
  "let x: U8 = 256U16; x",
  "let x: U8 = -1I8; x",
] as const;

const overflowCases = [
  "256U8",
  "65536U16",
  "4294967296U32",
  "18446744073709551616U64",
  "128I8",
  "32768I16",
  "2147483648I32",
  "9223372036854775808I64",
] as const;

const unsignedNegativeCases = ["-1U8", "-1U16", "-1U32", "-1U64"] as const;

function expectRangeError(fn: () => unknown): void {
  try {
    fn();
    throw new Error("Expected function to throw.");
  } catch (error) {
    expect(error).toBeInstanceOf(RangeError);
  }
}

describe("greet", () => {
  test("greets the provided name", () => {
    expect(greet("Copilot")).toBe("Hello, Copilot!");
  });

  test("falls back cleanly when given a plain string", () => {
    expect(greet("world")).toBe("Hello, world!");
  });
});

describe("compileTuffToTS", () => {
  test("compiles supported integer literals to TypeScript", () => {
    for (const { source, ts: expectedTs } of supportedIntegerCases) {
      expect(compileTuffToTS(source)).toBe(expectedTs);
    }
  });

  test("throws on invalid input", () => {
    expect(() => compileTuffToTS("print hello")).toThrow(SyntaxError);
  });

  test("rejects signed unsigned integer literals", () => {
    for (const source of unsignedNegativeCases) {
      expectRangeError(() => compileTuffToTS(source));
    }
  });

  test("rejects values outside supported ranges", () => {
    for (const source of overflowCases) {
      expectRangeError(() => compileTuffToTS(source));
    }
  });

  test("compiles let statements to TypeScript", () => {
    for (const { source, ts: expectedTs } of letCases) {
      expect(compileTuffToTS(source)).toBe(expectedTs);
    }
  });

  test("rejects invalid let syntax", () => {
    for (const source of invalidLetCases) {
      expect(() => compileTuffToTS(source)).toThrow(SyntaxError);
    }
  });

  test("rejects invalid typed let initializers", () => {
    for (const source of invalidTypedLetCases) {
      expectRangeError(() => compileTuffToTS(source));
    }
  });
});

describe("evaluateTuff", () => {
  test("evaluates supported integer literals to their numeric value", () => {
    for (const { source, value } of supportedIntegerCases) {
      expect(evaluateTuff(source) as any).toBe(value as any);
    }
  });

  test("compiles read expressions to TypeScript", () => {
    for (const { source, ts: expectedTs } of readCases) {
      expect(compileTuffToTS(source)).toBe(expectedTs);
    }
  });

  test("compiles arithmetic expressions to TypeScript", () => {
    for (const { source, ts: expectedTs } of arithmeticCases) {
      expect(compileTuffToTS(source)).toBe(expectedTs);
    }
  });

  test("evaluates read expressions using stdin", () => {
    for (const { source, stdIn, value } of readCases) {
      expect(evaluateTuff(source, stdIn) as any).toBe(value as any);
    }
  });

  test("evaluates arithmetic expressions", () => {
    for (const { source, stdIn, value } of arithmeticCases) {
      expect(evaluateTuff(source, stdIn) as any).toBe(value as any);
    }
  });

  test("evaluates let statements", () => {
    for (const { source, stdIn, value } of letCases) {
      expect(evaluateTuff(source, stdIn) as any).toBe(value as any);
    }
  });

  test("rejects division by zero", () => {
    for (const source of ["1U8 / 0U8", "1U64 % 0U64"]) {
      expectRangeError(() => evaluateTuff(source));
    }
  });

  test("throws on invalid input", () => {
    expect(() => evaluateTuff("print hello")).toThrow(SyntaxError);
  });

  test("rejects signed unsigned integer literals", () => {
    for (const source of unsignedNegativeCases) {
      expectRangeError(() => evaluateTuff(source));
    }
  });

  test("rejects values outside supported ranges", () => {
    for (const source of overflowCases) {
      expectRangeError(() => evaluateTuff(source));
    }
  });

  test("rejects invalid let syntax", () => {
    for (const source of invalidLetCases) {
      expect(() => evaluateTuff(source)).toThrow(SyntaxError);
    }
  });

  test("rejects invalid typed let initializers", () => {
    for (const source of invalidTypedLetCases) {
      expectRangeError(() => evaluateTuff(source));
    }
  });
});
