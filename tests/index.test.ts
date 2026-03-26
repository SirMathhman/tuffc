/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test";
import { compileTuffToTS, evaluateTuff, greet } from "../src/index";

describe("greet", () => {
  test("greets the provided name", () => {
    expect(greet("Copilot")).toBe("Hello, Copilot!");
  });

  test("falls back cleanly when given a plain string", () => {
    expect(greet("world")).toBe("Hello, world!");
  });
});

describe("compileTuffToTS", () => {
  test("compiles an unsigned integer literal to TS", () => {
    expect(compileTuffToTS("100U8")).toBe("export default 100;");
  });

  test("ignores surrounding whitespace", () => {
    expect(compileTuffToTS(" 100U8 ")).toBe("export default 100;");
  });

  test("throws on invalid input", () => {
    expect(() => compileTuffToTS("print hello")).toThrow(SyntaxError);
  });
});

describe("evaluateTuff", () => {
  test("evaluates an unsigned integer literal to a number", () => {
    expect(evaluateTuff("100U8")).toBe(100);
  });

  test("ignores surrounding whitespace", () => {
    expect(evaluateTuff(" 100U8 ")).toBe(100);
  });

  test("throws on invalid input", () => {
    expect(() => evaluateTuff("print hello")).toThrow(SyntaxError);
  });
});
