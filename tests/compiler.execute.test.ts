import { describe, expect, test } from "bun:test";
import { executeTuff } from "../src/compiler";

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

    test("let x : U8 = read<U8>(); x + x returns 200", async () => {
      expect(
        await executeTuff("let x : U8 = read<U8>(); x + x", "100 50"),
      ).toBe(200);
    });

    test("multiple let statements are supported", async () => {
      expect(
        await executeTuff(
          "let x : U8 = read<U8>(); let y : U8 = 50U8; x + y",
          "100",
        ),
      ).toBe(150);
    });
  });
});
