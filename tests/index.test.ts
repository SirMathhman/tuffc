/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test";
import { compileTuffToTS, evaluateTuff, greet } from "../src/index";

const supportedIntegerCases = [
  { source: "100U8", ts: "export default 100;", value: 100 },
  { source: "+100U8", ts: "export default 100;", value: 100 },
  { source: " 100U16 ", ts: "export default 100;", value: 100 },
  { source: "+100U32", ts: "export default 100;", value: 100 },
  { source: "100U64", ts: "export default 100n;", value: 100n },
  { source: "-1I8", ts: "export default -1;", value: -1 },
  { source: "+1I16", ts: "export default 1;", value: 1 },
  { source: "-2147483648I32", ts: "export default -2147483648;", value: -2147483648 },
  {
    source: "9223372036854775807I64",
    ts: "export default 9223372036854775807n;",
    value: 9223372036854775807n,
  },
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
      try {
        compileTuffToTS(source);
        throw new Error("Expected compileTuffToTS to throw.");
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
      }
    }
  });

  test("rejects values outside supported ranges", () => {
    for (const source of overflowCases) {
      try {
        compileTuffToTS(source);
        throw new Error("Expected compileTuffToTS to throw.");
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
      }
    }
  });
});

describe("evaluateTuff", () => {
  test("evaluates supported integer literals to their numeric value", () => {
    for (const { source, value } of supportedIntegerCases) {
      expect(evaluateTuff(source) as any).toBe(value as any);
    }
  });

  test("throws on invalid input", () => {
    expect(() => evaluateTuff("print hello")).toThrow(SyntaxError);
  });

  test("rejects signed unsigned integer literals", () => {
    for (const source of unsignedNegativeCases) {
      try {
        evaluateTuff(source);
        throw new Error("Expected evaluateTuff to throw.");
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
      }
    }
  });

  test("rejects values outside supported ranges", () => {
    for (const source of overflowCases) {
      try {
        evaluateTuff(source);
        throw new Error("Expected evaluateTuff to throw.");
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
      }
    }
  });
});
