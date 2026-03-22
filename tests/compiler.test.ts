import { describe, expect, test } from "bun:test";
import { compileTuffToTS, executeTuff } from "../src/compiler";

describe("compileTuffToTS", () => {
  describe("integer literals", () => {
    // --- happy path: value in range ---
    test("U8 mid-range compiles to process.exit", () => {
      expect(compileTuffToTS("100U8")).toBe("process.exit(100);");
    });
    test("U8 minimum (0) compiles", () => {
      expect(compileTuffToTS("0U8")).toBe("process.exit(0);");
    });
    test("U8 maximum (255) compiles", () => {
      expect(compileTuffToTS("255U8")).toBe("process.exit(255);");
    });
    test("U16 maximum (65535) compiles", () => {
      expect(compileTuffToTS("65535U16")).toBe("process.exit(65535);");
    });
    test("U32 maximum compiles", () => {
      expect(compileTuffToTS("4294967295U32")).toBe(
        "process.exit(4294967295);",
      );
    });
    test("I8 positive compiles", () => {
      expect(compileTuffToTS("127I8")).toBe("process.exit(127);");
    });
    test("I8 negative compiles", () => {
      expect(compileTuffToTS("-1I8")).toBe("process.exit(-1);");
    });
    test("I8 minimum (-128) compiles", () => {
      expect(compileTuffToTS("-128I8")).toBe("process.exit(-128);");
    });
    test("I32 negative compiles", () => {
      expect(compileTuffToTS("-2147483648I32")).toBe(
        "process.exit(-2147483648);",
      );
    });

    // --- error: out of range ---
    test("U8 value 256 throws", () => {
      expect(() => compileTuffToTS("256U8")).toThrow();
    });
    test("U8 value 300 throws", () => {
      expect(() => compileTuffToTS("300U8")).toThrow();
    });
    test("I8 value 128 throws", () => {
      expect(() => compileTuffToTS("128I8")).toThrow();
    });
    test("I8 value -129 throws", () => {
      expect(() => compileTuffToTS("-129I8")).toThrow();
    });

    // --- error: negative unsigned ---
    test("negative U8 throws", () => {
      expect(() => compileTuffToTS("-1U8")).toThrow();
    });
    test("negative U32 throws", () => {
      expect(() => compileTuffToTS("-1U32")).toThrow();
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
});
