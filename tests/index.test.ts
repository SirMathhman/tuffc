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

    test("program ending in let exits 0", () => {
      expectTuff("let x: U8 = 5U8;", 0);
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

describe("block expressions", () => {
  describe("valid", () => {
    test("bare block as program { 5U8 } exits 5", () => {
      expectTuff("{ 5U8 }", 5);
    });

    test("block with let as program finalexpr", () => {
      expectTuff("{ let y: U8 = 3U8;\ny }", 3);
    });

    test("block as RHS of let", () => {
      expectTuff("let x: U8 = { 5U8 };\nx", 5);
    });

    test("block with inner let as RHS", () => {
      expectTuff("let x: U8 = { let y: U8 = 3U8;\ny };\nx", 3);
    });

    test("outer variable accessible inside block", () => {
      expectTuff("let x: U8 = 10U8;\nlet y: U8 = { x };\ny", 10);
    });

    test("outer mut reassigned inside block", () => {
      expectTuff("let mut x = 5U8;\nlet y: U8 = { x = 10U8;\nx };\nx", 10);
    });

    test("inner let shadows outer, outer unchanged after block", () => {
      expectTuff(
        "let x: U8 = 5U8;\nlet y: U8 = { let x: U8 = 10U8;\nx };\nx",
        5,
      );
    });

    test("nested blocks", () => {
      expectTuff("let x: U8 = { let y: U8 = { 3U8 };\ny };\nx", 3);
    });

    test("block used as arithmetic operand", () => {
      expectTuff("{ 3U8 } + 2U8", 5);
    });

    test("block returning Bool", () => {
      expectTuff("let x: Bool = { true };\nx", 1);
    });

    test("block with read<T>() inside", () => {
      expectTuff("let x: U8 = { read<U8>() };\nx", "42", 42);
    });
  });

  describe("invalid", () => {
    test("empty block expression throws", () => {
      expect(() => compileTuffToTS("let x: U8 = { };\nx")).toThrow();
    });

    test("block expression ending in let throws", () => {
      expect(() =>
        compileTuffToTS("let y: U8 = { let x: U8 = 5U8; };\ny"),
      ).toThrow();
    });

    test("block-local variable out of scope throws", () => {
      expect(() =>
        compileTuffToTS("let y: U8 = { let z: U8 = 5U8;\nz };\nz"),
      ).toThrow();
    });
  });
});

describe("statement blocks", () => {
  describe("valid", () => {
    test("empty statement block program exits 0", () => {
      expectTuff("{ }", 0);
    });

    test("statement-only program exits 0", () => {
      expectTuff("let mut x = 1U8;\n{ x = 2U8; }", 0);
    });

    test("block can reassign outer mutable variable", () => {
      expectTuff("let mut x = 5U8;\n{ x = 10U8; }\nx", 10);
    });

    test("nested statement blocks", () => {
      expectTuff("let mut x = 1U8;\n{ { x = 2U8; } }\nx", 2);
    });

    test("block-local shadow does not escape", () => {
      expectTuff("let x: U8 = 1U8;\n{ let x: U8 = 2U8; }\nx", 1);
    });

    test("block-local variable may be mutated internally", () => {
      expectTuff("let x: U8 = 1U8;\n{ let mut y = 2U8;\ny = 3U8; }\nx", 1);
    });
  });

  describe("invalid", () => {
    test("bare expression inside statement block is invalid", () => {
      expect(() => compileTuffToTS("let x: U8 = 100U8;\n{ x }\nx")).toThrow();
    });

    test("block-local variable remains out of scope after statement block", () => {
      expect(() => compileTuffToTS("{ let y: U8 = 2U8; }\ny")).toThrow();
    });
  });
});

describe("comparisons", () => {
  describe("valid", () => {
    test("1U8 < 2U8 exits 1", () => {
      expectTuff("1U8 < 2U8", 1);
    });

    test("2U8 < 1U8 exits 0", () => {
      expectTuff("2U8 < 1U8", 0);
    });

    test("1U8 <= 1U8 exits 1", () => {
      expectTuff("1U8 <= 1U8", 1);
    });

    test("2U8 > 1U8 exits 1", () => {
      expectTuff("2U8 > 1U8", 1);
    });

    test("1U8 >= 1U8 exits 1", () => {
      expectTuff("1U8 >= 1U8", 1);
    });

    test("1U8 == 1U8 exits 1", () => {
      expectTuff("1U8 == 1U8", 1);
    });

    test("1U8 == 2U8 exits 0", () => {
      expectTuff("1U8 == 2U8", 0);
    });

    test("1U8 != 2U8 exits 1", () => {
      expectTuff("1U8 != 2U8", 1);
    });

    test("true == true exits 1", () => {
      expectTuff("true == true", 1);
    });

    test("true == false exits 0", () => {
      expectTuff("true == false", 0);
    });

    test("true != false exits 1", () => {
      expectTuff("true != false", 1);
    });

    test("mixed integer types: read<U8>() < read<U16>()", () => {
      expectTuff("read<U8>() < read<U16>()", "10 20", 1);
    });

    test("comparison result used in &&", () => {
      expectTuff("1U8 < 2U8 && 3U8 > 2U8", 1);
    });

    test("comparison binds tighter than &&: 1+1 == 2 && 3 > 2", () => {
      expectTuff("1U8 + 1U8 == 2U8 && 3U8 > 2U8", 1);
    });

    test("let x: Bool = 5U8 > 3U8; x", () => {
      expectTuff("let x: Bool = 5U8 > 3U8;\nx", 1);
    });
  });

  describe("invalid", () => {
    test("Bool < Bool throws", () => {
      expect(() => compileTuffToTS("true < false")).toThrow();
    });

    test("Bool == integer throws", () => {
      expect(() => compileTuffToTS("true == 1U8")).toThrow();
    });

    test("integer == Bool throws", () => {
      expect(() => compileTuffToTS("1U8 == true")).toThrow();
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

describe("if-statements", () => {
  describe("valid", () => {
    test("if-stmt with assignment, condition true", () => {
      expectTuff("let mut x = 0U8;\nif (true) x = 5U8;\nx", 5);
    });

    test("if-stmt with assignment, condition false", () => {
      expectTuff("let mut x = 0U8;\nif (false) x = 5U8;\nx", 0);
    });

    test("if-stmt with statement block", () => {
      expectTuff("let mut x = 0U8;\nif (true) { let y = 5U8; x = y; }\nx", 5);
    });

    test("if-else with statement blocks, then taken", () => {
      expectTuff(
        "let mut x = 0U8;\nif (true) { x = 5U8; } else { x = 10U8; }\nx",
        5,
      );
    });

    test("if-else with statement blocks, else taken", () => {
      expectTuff(
        "let mut x = 0U8;\nif (false) { x = 5U8; } else { x = 10U8; }\nx",
        10,
      );
    });

    test("if-else with empty statement blocks", () => {
      expectTuff("let mut x = 7U8;\nif (true) { } else { }\nx", 7);
    });

    test("if-stmt with condition from read<Bool>()", () => {
      expectTuff("let mut x = 0U8;\nif (read<Bool>()) x = 5U8;\nx", "true", 5);
    });

    test("else-if chaining", () => {
      expectTuff(
        "let mut x = 0U8;\nlet a = false;\nlet b = true;\nif (a) x = 1U8; else if (b) x = 2U8; else x = 3U8;\nx",
        2,
      );
    });

    test("nested if-stmt inside statement block", () => {
      expectTuff("let mut x = 0U8;\nif (true) { if (true) x = 5U8; }\nx", 5);
    });

    test("program ending with if-stmt exits 0", () => {
      expectTuff("let mut x = 0U8;\nif (true) x = 5U8;", 0);
    });
  });

  describe("invalid", () => {
    test("if-stmt condition must be Bool", () => {
      expect(() =>
        compileTuffToTS("let mut x = 0U8;\nif (5U8) x = 1U8;"),
      ).toThrow();
    });

    test("expression in then-branch without else is invalid", () => {
      expect(() => compileTuffToTS("if (true) 5U8;")).toThrow();
    });

    test("block expression in then-branch without else is invalid", () => {
      expect(() => compileTuffToTS("if (true) { 5U8 }")).toThrow();
    });
  });
});

describe("if-expressions", () => {
  describe("valid", () => {
    test("simple if-expr, then taken", () => {
      expectTuff("if (true) 5U8 else 10U8", 5);
    });

    test("simple if-expr, else taken", () => {
      expectTuff("if (false) 5U8 else 10U8", 10);
    });

    test("if-expr assigned to variable", () => {
      expectTuff("let x = if (true) 5U8 else 10U8;\nx", 5);
    });

    test("if-expr with declared type, compatible branches", () => {
      expectTuff("let x: U16 = if (true) 5U8 else 10U16;\nx", 5);
    });

    test("if-expr with no declared type, infer common type", () => {
      expectTuff("let x = if (true) 5U8 else 10U16;\nx", 5);
    });

    test("if-expr with block-expr as then-branch", () => {
      expectTuff("if (true) { let y = 5U8; y } else 10U8", 5);
    });

    test("if-expr with block-expr as else-branch", () => {
      expectTuff("if (false) 5U8 else { let z = 10U8; z }", 10);
    });

    test("else-if chaining in expression", () => {
      expectTuff(
        "let a = false;\nlet b = true;\nif (a) 1U8 else if (b) 2U8 else 3U8",
        2,
      );
    });

    test("if-expr in arithmetic", () => {
      expectTuff("(if (true) 5U8 else 10U8) + 1U8", 6);
    });

    test("if-expr with Bool values", () => {
      expectTuff("if (true) true else false", 1);
    });

    test("nested if-expr", () => {
      expectTuff("if (true) (if (false) 1U8 else 2U8) else 3U8", 2);
    });

    test("if-expr with condition from read<Bool>()", () => {
      expectTuff("if (read<Bool>()) 5U8 else 10U8", "true", 5);
    });
  });

  describe("invalid", () => {
    test("if-expr requires else clause", () => {
      expect(() => compileTuffToTS("if (true) 5U8")).toThrow();
    });

    test("if-expr branches must have common type", () => {
      expect(() =>
        compileTuffToTS("let x = if (true) 5U8 else true;"),
      ).toThrow();
    });

    test("if-expr branches must be compatible with declared type", () => {
      expect(() =>
        compileTuffToTS("let x: U8 = if (true) 5U8 else 256U16;"),
      ).toThrow();
    });

    test("if-expr condition must be Bool", () => {
      expect(() => compileTuffToTS("if (5U8) 5U8 else 10U8")).toThrow();
    });

    test("empty statement blocks cannot be used as if-expression", () => {
      expect(() =>
        compileTuffToTS("let x: U8 = if (true) { } else { };"),
      ).toThrow();
    });
  });
});

describe("compound assignment", () => {
  describe("valid", () => {
    test("x += adds to mutable variable", () => {
      expectTuff("let mut x = 10U8;\nx += 5U8;\nx", 15);
    });

    test("x -= subtracts from mutable variable", () => {
      expectTuff("let mut x = 10U8;\nx -= 3U8;\nx", 7);
    });

    test("x *= multiplies mutable variable", () => {
      expectTuff("let mut x = 5U8;\nx *= 3U8;\nx", 15);
    });

    test("x /= divides mutable variable", () => {
      expectTuff("let mut x = 20U8;\nx /= 4U8;\nx", 5);
    });

    test("bool &= with true and false", () => {
      expectTuff("let mut flag = true;\nflag &= false;\nflag", 0);
    });

    test("bool &= with true and true", () => {
      expectTuff("let mut flag = true;\nflag &= true;\nflag", 1);
    });

    test("bool |= with false and true", () => {
      expectTuff("let mut flag = false;\nflag |= true;\nflag", 1);
    });

    test("bool |= with false and false", () => {
      expectTuff("let mut flag = false;\nflag |= false;\nflag", 0);
    });

    test("mixed widths: U8 into U16", () => {
      expectTuff("let mut x: U16 = 100U16;\nx += 50U8;\nx", 150);
    });

    test("multiple compound assignments", () => {
      expectTuff(
        "let mut x = 10U8;\nlet mut y = 5U8;\nx += 2U8;\ny -= 1U8;\nx + y",
        16,
      );
    });

    test("compound assignment in statement block", () => {
      expectTuff("let mut x = 10U8;\n{ x += 5U8; }\nx", 15);
    });

    test("compound assignment with read<T>()", () => {
      expectTuff("let mut x = 10U8;\nx += read<U8>();\nx", "5", 15);
    });

    test("compound assignment with arithmetic RHS", () => {
      expectTuff("let mut x = 10U8;\nx += 2U8 + 3U8;\nx", 15);
    });

    test("program ending with compound assignment exits 0", () => {
      expectTuff("let mut x = 10U8;\nx += 5U8;", 0);
    });
  });

  describe("invalid", () => {
    test("compound assignment on immutable variable throws", () => {
      expect(() => compileTuffToTS("let x = 5U8;\nx += 10U8;")).toThrow();
    });

    test("compound assignment on undeclared variable throws", () => {
      expect(() => compileTuffToTS("y += 5U8;")).toThrow();
    });

    test("arithmetic compound op on Bool throws", () => {
      expect(() => compileTuffToTS("let mut b = true;\nb += false;")).toThrow();
    });

    test("bool compound op on integer throws", () => {
      expect(() => compileTuffToTS("let mut x = 5U8;\nx &= 10U8;")).toThrow();
    });

    test("type incompatible RHS throws", () => {
      expect(() =>
        compileTuffToTS("let mut x: U8 = 10U8;\nx += 500U16;"),
      ).toThrow();
    });

    test("chaining compound assignment throws (not expression)", () => {
      expect(() =>
        compileTuffToTS("let mut x = 0U8;\nlet mut y = 0U8;\nx += y += 5U8;"),
      ).toThrow();
    });
  });
});

describe("while statements", () => {
  describe("valid", () => {
    test("countdown with decrement", () => {
      expectTuff(
        "let mut x: U8 = 5U8;\nwhile (x > 0U8) {\n  x -= 1U8;\n}\nx",
        0,
      );
    });

    test("sum 1 to 10", () => {
      expectTuff(
        "let mut sum: U16 = 0U16;\nlet mut i: U16 = 1U16;\nwhile (i <= 10U16) {\n  sum += i;\n  i += 1U16;\n}\nsum",
        55,
      );
    });

    test("single statement body", () => {
      expectTuff("let mut x: U8 = 3U8;\nwhile (x > 0U8) x -= 1U8;\nx", 0);
    });

    test("condition false on first check, body never executes", () => {
      expectTuff("let mut x: U8 = 0U8;\nwhile (false) {\n  x = 10U8;\n}\nx", 0);
    });

    test("empty statement block body", () => {
      expectTuff("let mut x: U8 = 0U8;\nwhile (x > 0U8) {\n}\n5U8", 5);
    });

    test("nested while loops", () => {
      expectTuff(
        "let mut outer: U8 = 3U8;\nlet mut sum: U8 = 0U8;\nwhile (outer > 0U8) {\n  let mut inner: U8 = 2U8;\n  while (inner > 0U8) {\n    sum += 1U8;\n    inner -= 1U8;\n  }\n  outer -= 1U8;\n}\nsum",
        6,
      );
    });

    test("while with if-statement inside", () => {
      expectTuff(
        "let mut x: U8 = 10U8;\nlet mut evens: U8 = 0U8;\nwhile (x > 0U8) {\n  if (x == 2U8 || x == 4U8 || x == 6U8 || x == 8U8 || x == 10U8) {\n    evens += 1U8;\n  }\n  x -= 1U8;\n}\nevens",
        5,
      );
    });

    test("while condition from read<Bool>()", () => {
      expectTuff("while (read<Bool>()) {\n}\n0", "false", 0);
    });

    test("while with multiple statements in body", () => {
      expectTuff(
        "let mut x: U8 = 5U8;\nlet mut y: U8 = 0U8;\nwhile (x > 0U8) {\n  y += x;\n  x -= 1U8;\n}\ny",
        15,
      );
    });

    test("program ending with while exits 0", () => {
      expectTuff("let mut x: U8 = 3U8;\nwhile (x > 0U8) {\n  x -= 1U8;\n}", 0);
    });
  });

  describe("invalid", () => {
    test("while condition must be Bool", () => {
      expect(() => compileTuffToTS("while (5) {\n}")).toThrow(
        /while condition must be Bool/,
      );
    });

    test("while as expression throws", () => {
      expect(() => compileTuffToTS("let x = while (true) {\n};")).toThrow();
    });
  });

  describe("pointers", () => {
    describe("valid", () => {
      test("basic immutable pointer", () => {
        expectTuff("let x = 100; let y: *I32 = &x; *y", 100);
      });

      test("mutable pointer with assignment", () => {
        expectTuff("let mut x = 100; let p: *mut I32 = &mut x; *p = 42; x", 42);
      });

      test("immutable pointer to mutable variable", () => {
        expectTuff("let mut x = 100; let p: *I32 = &x; *p", 100);
      });

      test("nested pointers (double)", () => {
        expectTuff(
          "let x = 100; let p: *I32 = &x; let pp: **I32 = &p; **pp",
          100,
        );
      });

      test("nested pointers (triple)", () => {
        expectTuff(
          "let x = 42; let p: *I32 = &x; let pp: **I32 = &p; let ppp: ***I32 = &pp; ***ppp",
          42,
        );
      });

      test("nested mutable pointer", () => {
        expectTuff(
          "let mut x = 10; let p: *mut I32 = &mut x; let pp: *(*mut I32) = &p; **pp = 20; x",
          20,
        );
      });

      test("pointer comparison - same variable", () => {
        expectTuff(
          "let x = 100; let p1: *I32 = &x; let p2: *I32 = &x; p1 == p2",
          1,
        );
      });

      test("pointer comparison - different variables", () => {
        expectTuff(
          "let x = 100; let y = 100; let p1: *I32 = &x; let p2: *I32 = &y; p1 != p2",
          1,
        );
      });

      test("dereferenced value comparison", () => {
        expectTuff(
          "let x = 100; let y = 100; let px: *I32 = &x; let py: *I32 = &y; *px == *py",
          1,
        );
      });

      test("pointer with arithmetic on dereferenced value", () => {
        expectTuff("let mut x = 50; let p: *mut I32 = &mut x; *p + 10U8", 60);
      });

      test("multiple operations with mutable pointer", () => {
        expectTuff(
          "let mut x = 10; let p: *mut I32 = &mut x; *p = *p * 2; x",
          20,
        );
      });

      test("pointer to U8", () => {
        expectTuff("let x = 255U8; let p: *U8 = &x; *p", 255);
      });

      test("pointer to Bool", () => {
        expectTuff("let x = true; let p: *Bool = &x; *p", 1);
      });

      test("mutable pointer to Bool", () => {
        expectTuff(
          "let mut x = true; let p: *mut Bool = &mut x; *p = false; x",
          0,
        );
      });

      test("pointer in block expression", () => {
        expectTuff("let x = 100; { let p: *I32 = &x; *p }", 100);
      });

      test("pointer with if-statement", () => {
        expectTuff(
          "let mut x = 10; let p: *mut I32 = &mut x; if (true) { *p = 20; } x",
          20,
        );
      });

      test("pointer with comparison operators", () => {
        expectTuff(
          "let x = 100; let y = 50; let px: *I32 = &x; let py: *I32 = &y; *px > *py",
          1,
        );
      });

      test("address-of in if-expression", () => {
        expectTuff(
          "let x = 100; let y = 200; let p: *I32 = if (true) &x else &y; *p",
          100,
        );
      });

      test("pointer shadowing variable", () => {
        expectTuff("let x = 100; let x: *I32 = &x; *x", 100);
      });
    });

    describe("invalid", () => {
      test("cannot take mutable address of immutable variable", () => {
        expect(() =>
          compileTuffToTS("let x = 100; let p: *mut I32 = &mut x;"),
        ).toThrow(/cannot take mutable.*immutable/i);
      });

      test("cannot assign through immutable pointer", () => {
        expect(() =>
          compileTuffToTS("let mut x = 100; let p: *I32 = &x; *p = 42;"),
        ).toThrow(/cannot assign.*immutable pointer/i);
      });

      test("cannot take address of expression", () => {
        expect(() => compileTuffToTS("let p: *I32 = &(100 + 200);")).toThrow(
          /address.*variable/i,
        );
      });

      test("cannot use pointers in arithmetic", () => {
        expect(() =>
          compileTuffToTS("let x = 100; let p: *I32 = &x; p + 1"),
        ).toThrow(/pointer.*arithmetic/i);
      });

      test("cannot use pointer in boolean operation", () => {
        expect(() =>
          compileTuffToTS("let x = 100; let p: *I32 = &x; !p"),
        ).toThrow(/pointer.*boolean/i);
      });

      test("cannot use pointer as if-condition", () => {
        expect(() =>
          compileTuffToTS("let x = 100; let p: *I32 = &x; if (p) x else 0"),
        ).toThrow(/condition.*Bool/i);
      });

      test("cannot end program with pointer", () => {
        expect(() => compileTuffToTS("let x = 100; &x")).toThrow(
          /pointer.*exit/i,
        );
      });

      test("cannot take address of literal", () => {
        expect(() => compileTuffToTS("let p: *I32 = &100;")).toThrow(
          /address.*variable/i,
        );
      });

      test("type mismatch - pointer type vs non-pointer type", () => {
        expect(() => compileTuffToTS("let x = 100; let p: I32 = &x;")).toThrow(
          /type/i,
        );
      });

      test("type mismatch - wrong pointer target type", () => {
        expect(() => compileTuffToTS("let x = 100; let p: *U8 = &x;")).toThrow(
          /type/i,
        );
      });
    });
  });
});
