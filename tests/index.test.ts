import { describe, expect, test } from "bun:test";
import { compileTuffToTS } from "../src/index";

function expectTuff(tuffSourceCode: string, expectedExitCode: number): void {
  // Compile the Tuff source code to TypeScript
  const tsCode: string = compileTuffToTS(tuffSourceCode);

  // Wrap the generated code in a Function and invoke it; the return value is
  // the program's exit code (undefined/void programs default to 0).
  const exitCode: number = (new Function(tsCode)() as number | undefined) ?? 0;
  expect(exitCode).toBe(expectedExitCode);
}

describe("integer literals", () => {
  describe("valid", () => {
    test("100U8 exits 100", () => {
      expectTuff("100U8", 100);
    });

    test("0U8 exits 0 (lower boundary)", () => {
      expectTuff("0U8", 0);
    });

    test("255U8 exits 255 (upper boundary)", () => {
      expectTuff("255U8", 255);
    });

    test("bare 100 exits 100 (default I32)", () => {
      expectTuff("100", 100);
    });
  });

  describe("invalid", () => {
    test("256U8 throws (out of range)", () => {
      expect(() => compileTuffToTS("256U8")).toThrow();
    });

    test("100U9 throws (unknown suffix)", () => {
      expect(() => compileTuffToTS("100U9")).toThrow();
    });

    test("-1U8 throws (negative unsigned)", () => {
      expect(() => compileTuffToTS("-1U8")).toThrow();
    });

    test("1.5U8 throws (non-integer)", () => {
      expect(() => compileTuffToTS("1.5U8")).toThrow();
    });
  });
});

describe("whitespace", () => {
  test("empty string exits 0", () => {
    expectTuff("", 0);
  });

  test("single space exits 0", () => {
    expectTuff(" ", 0);
  });

  test("mixed whitespace exits 0", () => {
    expectTuff("\t\n  ", 0);
  });
});
