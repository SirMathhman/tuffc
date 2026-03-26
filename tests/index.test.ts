import { describe, expect, test } from "bun:test";
import { compileTuffToTS } from "../src/index";

function expectTuff(tuffSourceCode: string, expectedExitCode: number): void;
function expectTuff(
  tuffSourceCode: string,
  stdin: string,
  expectedExitCode: number,
): void;
function expectTuff(
  tuffSourceCode: string,
  stdinOrExitCode: string | number,
  maybeExitCode?: number,
): void {
  const stdin: string | undefined =
    typeof stdinOrExitCode === "string" ? stdinOrExitCode : undefined;
  const expectedExitCode: number =
    typeof stdinOrExitCode === "number" ? stdinOrExitCode : maybeExitCode!;

  // Compile the Tuff source code to TypeScript
  const tsCode: string = compileTuffToTS(tuffSourceCode);

  // Wrap the generated code in a Function and invoke it; the return value is
  // the program's exit code (undefined/void programs default to 0).
  // When stdin is provided, inject a mock read() function.
  const raw: number | undefined =
    stdin !== undefined
      ? (new Function("read", tsCode)(
          (): number => parseInt(stdin, 10),
        ) as number | undefined)
      : (new Function(tsCode)() as number | undefined);
  const exitCode: number = raw ?? 0;
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

describe("read built-in", () => {
  describe("valid", () => {
    test("read<U8>() exits 255 (upper boundary)", () => {
      expectTuff("read<U8>()", "255", 255);
    });

    test("read<U8>() exits 0 (lower boundary)", () => {
      expectTuff("read<U8>()", "0", 0);
    });

    test("read<I8>() exits -128 (lower boundary)", () => {
      expectTuff("read<I8>()", "-128", -128);
    });

    test("read<I32>() exits 42 (default signed)", () => {
      expectTuff("read<I32>()", "42", 42);
    });
  });

  describe("invalid", () => {
    test("read<U9>() throws (unknown suffix)", () => {
      expect(() => compileTuffToTS("read<U9>()")).toThrow();
    });

    test("read<>() throws (empty type parameter)", () => {
      expect(() => compileTuffToTS("read<>()")).toThrow();
    });

    test("read() throws (missing type parameter)", () => {
      expect(() => compileTuffToTS("read()")).toThrow();
    });

    test("read<U8>(foo) throws (arguments not allowed)", () => {
      expect(() => compileTuffToTS("read<U8>(foo)")).toThrow();
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
