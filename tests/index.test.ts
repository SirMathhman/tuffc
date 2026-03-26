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
  // When stdin is provided, inject a mock read() that consumes space-separated
  // tokens left-to-right.
  let readIdx: number = 0;
  const stdinTokens: string[] =
    stdin !== undefined
      ? stdin.split(/\s+/).filter((t: string): boolean => t.length > 0)
      : [];
  const mockRead: () => number = (): number =>
    parseInt(stdinTokens[readIdx++]!, 10);
  const mockReadBool: () => boolean = (): boolean =>
    stdinTokens[readIdx++] === "true";
  const raw: number | undefined =
    stdin !== undefined
      ? (new Function("read", "readBool", tsCode)(mockRead, mockReadBool) as
          | number
          | undefined)
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

describe("arithmetic", () => {
  describe("valid", () => {
    test("read<U8>() + read<U8>() = 3", () => {
      expectTuff("read<U8>() + read<U8>()", "1 2", 3);
    });

    test("read<U8>() - read<U8>() = 2", () => {
      expectTuff("read<U8>() - read<U8>()", "5 3", 2);
    });

    test("read<U8>() * read<U8>() = 12", () => {
      expectTuff("read<U8>() * read<U8>()", "4 3", 12);
    });

    test("read<U8>() / read<U8>() = 4", () => {
      expectTuff("read<U8>() / read<U8>()", "12 3", 4);
    });

    test("chaining: read<U8>() + read<U8>() + read<U8>() = 6", () => {
      expectTuff("read<U8>() + read<U8>() + read<U8>()", "1 2 3", 6);
    });

    test("precedence: 2 + read<U8>() * read<U8>() = 14", () => {
      expectTuff("2 + read<U8>() * read<U8>()", "3 4", 14);
    });

    test("mixed: read<U8>() + 5U8 = 8", () => {
      expectTuff("read<U8>() + 5U8", "3", 8);
    });

    test("literal + literal: 3 + 5 = 8", () => {
      expectTuff("3 + 5", 8);
    });
  });

  describe("invalid", () => {
    test("trailing operator throws", () => {
      expect(() => compileTuffToTS("1 +")).toThrow();
    });

    test("leading operator throws", () => {
      expect(() => compileTuffToTS("+ 1")).toThrow();
    });

    test("unknown character throws", () => {
      expect(() => compileTuffToTS("1 % 2")).toThrow();
    });
  });
});

describe("let statements", () => {
  describe("valid", () => {
    test("let x: U8 = 5U8; x exits 5", () => {
      expectTuff("let x: U8 = 5U8;\nx", 5);
    });

    test("let x: U8 = 5U8; x + 3U8 exits 8 (variable in expression)", () => {
      expectTuff("let x: U8 = 5U8;\nx + 3U8", 8);
    });

    test("let with read<T>() RHS", () => {
      expectTuff("let x: U8 = read<U8>();\nx", "42", 42);
    });

    test("let with arithmetic RHS", () => {
      expectTuff("let x: I16 = read<U8>() + read<I8>();\nx", "10 5", 15);
    });

    test("compatible declared type (U16 declared, U8 inferred)", () => {
      expectTuff("let x: U16 = 5U8;\nx", 5);
    });

    test("multiple lets, last expression uses both", () => {
      expectTuff("let x: U8 = 3U8;\nlet y: U8 = 4U8;\nx + y", 7);
    });

    test("shadowing: second let shadows first", () => {
      expectTuff("let x: U8 = 1U8;\nlet x: U8 = 10U8;\nx", 10);
    });

    test("let with I32 compatible type (bare literal RHS)", () => {
      expectTuff("let x: I32 = 100;\nx", 100);
    });
  });

  describe("invalid", () => {
    test("unknown variable throws", () => {
      expect(() => compileTuffToTS("x")).toThrow();
    });

    test("incompatible type: U8 declared, I16 inferred throws", () => {
      expect(() =>
        compileTuffToTS("let x: U8 = read<U8>() + read<I8>();\nx"),
      ).toThrow();
    });

    test("last statement is let throws", () => {
      expect(() => compileTuffToTS("let x: U8 = 5U8;")).toThrow();
    });

    test("arithmetic type with no covering type throws", () => {
      expect(() => compileTuffToTS("read<U64>() + read<I64>()")).toThrow();
    });
  });
});

describe("Bool", () => {
  describe("valid", () => {
    test("true exits 1", () => {
      expectTuff("true", 1);
    });

    test("false exits 0", () => {
      expectTuff("false", 0);
    });

    test("let x: Bool = true; x", () => {
      expectTuff("let x: Bool = true;\nx", 1);
    });

    test("let x: Bool = false; x", () => {
      expectTuff("let x: Bool = false;\nx", 0);
    });

    test("let mut x = true; x = false; x exits 0", () => {
      expectTuff("let mut x = true;\nx = false;\nx", 0);
    });

    test("read<Bool>() exits 1 for stdin true", () => {
      expectTuff("read<Bool>()", "true", 1);
    });

    test("read<Bool>() exits 0 for stdin false", () => {
      expectTuff("read<Bool>()", "false", 0);
    });

    test("let mut x: Bool = false; x = read<Bool>(); x", () => {
      expectTuff("let mut x: Bool = false;\nx = read<Bool>();\nx", "true", 1);
    });

    test("read<Bool>() and read<U8>() share stdin index", () => {
      expectTuff(
        "let a: U8 = read<U8>();\nlet b: Bool = read<Bool>();\na",
        "42 true",
        42,
      );
    });
  });

  describe("invalid", () => {
    test("Bool in arithmetic throws", () => {
      expect(() => compileTuffToTS("true + 1U8")).toThrow();
    });

    test("assign Bool to integer type throws", () => {
      expect(() => compileTuffToTS("let x: U8 = true;")).toThrow();
    });

    test("assign integer to Bool type throws", () => {
      expect(() => compileTuffToTS("let x: Bool = 5U8;")).toThrow();
    });
  });
});

describe("bool operators", () => {
  describe("valid", () => {
    test("true || false exits 1", () => {
      expectTuff("true || false", 1);
    });

    test("false || false exits 0", () => {
      expectTuff("false || false", 0);
    });

    test("true && true exits 1", () => {
      expectTuff("true && true", 1);
    });

    test("true && false exits 0", () => {
      expectTuff("true && false", 0);
    });

    test("!true exits 0", () => {
      expectTuff("!true", 0);
    });

    test("!false exits 1", () => {
      expectTuff("!false", 1);
    });

    test("!!true exits 1 (double negation)", () => {
      expectTuff("!!true", 1);
    });

    test("!true || false exits 0 (! binds tighter than ||)", () => {
      expectTuff("!true || false", 0);
    });

    test("true || false && false exits 1 (&& binds tighter than ||)", () => {
      expectTuff("true || false && false", 1);
    });

    test("bool variable in operator", () => {
      expectTuff("let x: Bool = true;\nlet y: Bool = false;\nx || y", 1);
    });

    test("read<Bool> with &&", () => {
      expectTuff("read<Bool>() && read<Bool>()", "true true", 1);
    });
  });

  describe("invalid", () => {
    test("integer left operand of || throws", () => {
      expect(() => compileTuffToTS("1U8 || true")).toThrow();
    });

    test("integer right operand of && throws", () => {
      expect(() => compileTuffToTS("true && 1U8")).toThrow();
    });

    test("! on integer throws", () => {
      expect(() => compileTuffToTS("!5U8")).toThrow();
    });
  });
});

describe("let mut", () => {
  describe("valid", () => {
    test("let mut x = 5U8; x exits 5", () => {
      expectTuff("let mut x = 5U8;\nx", 5);
    });

    test("let mut x = 5U8; x = 10U8; x exits 10", () => {
      expectTuff("let mut x = 5U8;\nx = 10U8;\nx", 10);
    });

    test("let mut with explicit annotation (widening)", () => {
      expectTuff("let mut x: U16 = 5U8;\nx", 5);
    });

    test("reassign with compatible (wider) type", () => {
      expectTuff("let mut x: U16 = 5U8;\nx = 200U8;\nx", 200);
    });

    test("let mut with arithmetic RHS", () => {
      expectTuff("let mut x = read<U8>() + read<U8>();\nx", "3 4", 7);
    });

    test("reassign using other variables", () => {
      expectTuff("let mut x = 1U8;\nlet y: U8 = 2U8;\nx = y;\nx", 2);
    });

    test("multiple reassignments", () => {
      expectTuff("let mut x = 1U8;\nx = 2U8;\nx = 3U8;\nx", 3);
    });
  });

  describe("invalid", () => {
    test("reassign immutable let throws", () => {
      expect(() => compileTuffToTS("let x: U8 = 5U8;\nx = 10U8;\nx")).toThrow();
    });

    test("reassign undeclared variable throws", () => {
      expect(() => compileTuffToTS("x = 5U8;\nx")).toThrow();
    });

    test("reassign with incompatible type throws", () => {
      expect(() =>
        compileTuffToTS("let mut x = 5U8;\nx = read<I8>();\nx"),
      ).toThrow();
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
