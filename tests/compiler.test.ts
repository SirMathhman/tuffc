import { describe, expect, test } from "bun:test";
import { compileTuffToTS, executeTuff } from "../src/compiler";

describe("compileTuffToTS", () => {
  describe("integer literals", () => {
    // --- happy path: value in range ---
    test("U8 mid-range compiles to process.exit", () => {
      expect(compileTuffToTS("100U8")).toEqual({
        isOk: true,
        value: "process.exit(100);",
      });
    });
    test("U8 minimum (0) compiles", () => {
      expect(compileTuffToTS("0U8")).toEqual({
        isOk: true,
        value: "process.exit(0);",
      });
    });
    test("U8 maximum (255) compiles", () => {
      expect(compileTuffToTS("255U8")).toEqual({
        isOk: true,
        value: "process.exit(255);",
      });
    });
    test("U16 maximum (65535) compiles", () => {
      expect(compileTuffToTS("65535U16")).toEqual({
        isOk: true,
        value: "process.exit(65535);",
      });
    });
    test("U32 maximum compiles", () => {
      expect(compileTuffToTS("4294967295U32")).toEqual({
        isOk: true,
        value: "process.exit(4294967295);",
      });
    });
    test("I8 positive compiles", () => {
      expect(compileTuffToTS("127I8")).toEqual({
        isOk: true,
        value: "process.exit(127);",
      });
    });
    test("I8 negative compiles", () => {
      expect(compileTuffToTS("-1I8")).toEqual({
        isOk: true,
        value: "process.exit(-1);",
      });
    });
    test("I8 minimum (-128) compiles", () => {
      expect(compileTuffToTS("-128I8")).toEqual({
        isOk: true,
        value: "process.exit(-128);",
      });
    });
    test("I32 negative compiles", () => {
      expect(compileTuffToTS("-2147483648I32")).toEqual({
        isOk: true,
        value: "process.exit(-2147483648);",
      });
    });
    test("read<U8>() compiles", () => {
      const compiled = compileTuffToTS("read<U8>()");
      expect(compiled.isOk).toBe(true);
      if (compiled.isOk) {
        expect(compiled.value).toContain("TUFFC_STDIN");
        expect(compiled.value).toContain("process.exit");
      }
    });
    test("read<U8>() + read<U8>() compiles", () => {
      const compiled = compileTuffToTS("read<U8>() + read<U8>()");
      expect(compiled.isOk).toBe(true);
      if (compiled.isOk) {
        expect(compiled.value).toContain("process.exit");
        expect(compiled.value).toContain("+");
      }
    });
    test("read<U8>() + 50U8 compiles", () => {
      expect(compileTuffToTS("read<U8>() + 50U8").isOk).toBe(true);
    });
    test("50U8 + read<U8>() compiles", () => {
      expect(compileTuffToTS("50U8 + read<U8>()").isOk).toBe(true);
    });
    test("read<U8>() + token returns Err", () => {
      expect(compileTuffToTS("read<U8>() + token").isOk).toBe(false);
    });
    test("trailing operator returns Err", () => {
      expect(compileTuffToTS("read<U8>() +").isOk).toBe(false);
    });

    // --- error: out of range ---
    test("U8 value 256 returns Err", () => {
      expect(compileTuffToTS("256U8").isOk).toBe(false);
    });
    test("U8 value 300 returns Err", () => {
      expect(compileTuffToTS("300U8").isOk).toBe(false);
    });
    test("I8 value 128 returns Err", () => {
      expect(compileTuffToTS("128I8").isOk).toBe(false);
    });
    test("I8 value -129 returns Err", () => {
      expect(compileTuffToTS("-129I8").isOk).toBe(false);
    });

    // --- error: negative unsigned ---
    test("negative U8 returns Err", () => {
      expect(compileTuffToTS("-1U8").isOk).toBe(false);
    });
    test("negative U32 returns Err", () => {
      expect(compileTuffToTS("-1U32").isOk).toBe(false);
    });
  });
});

describe("executeTuff", () => {
  describe("empty program", () => {
    test("returns exit code 0 for empty string", async () => {
      const exitCode = await executeTuff("");
      expect(exitCode).toBe(0);
    });
  });

  describe("integer literal program", () => {
    test("100U8 returns exit code 100", async () => {
      expect(await executeTuff("100U8")).toBe(100);
    });
    test("0U8 returns exit code 0", async () => {
      expect(await executeTuff("0U8")).toBe(0);
    });
  });

  describe("read from stdin", () => {
    test("read<U8>() with single token returns that token", async () => {
      expect(await executeTuff("read<U8>()", "100")).toBe(100);
    });

    test("read<U8>() uses first space-delimited token", async () => {
      expect(await executeTuff("read<U8>()", "100 200")).toBe(100);
    });

    test("read<U8>() + read<U8>() sums two tokens", async () => {
      expect(await executeTuff("read<U8>() + read<U8>()", "100 50")).toBe(150);
    });

    test("read<U8>()+read<U8>() also sums two tokens", async () => {
      expect(await executeTuff("read<U8>()+read<U8>()", "100 50")).toBe(150);
    });

    test("read<U8>() + literal works", async () => {
      expect(await executeTuff("read<U8>() + 50U8", "100")).toBe(150);
    });

    test("literal + read<U8>() works", async () => {
      expect(await executeTuff("50U8 + read<U8>()", "100")).toBe(150);
    });

    test("supports multiplication and precedence", async () => {
      expect(await executeTuff("read<U8>() + 2U8 * 3U8", "10")).toBe(16);
    });

    test("supports subtraction", async () => {
      expect(await executeTuff("read<U8>() - 30U8", "100")).toBe(70);
    });

    test("supports integer division truncation", async () => {
      expect(await executeTuff("read<U8>() / 3U8", "10")).toBe(3);
    });
  });
});
