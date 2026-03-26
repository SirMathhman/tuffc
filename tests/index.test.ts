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
  test("returns a string placeholder", () => {
    expect(typeof compileTuffToTS("print hello")).toBe("string");
    expect(compileTuffToTS("print hello")).toBe("");
  });
});

describe("evaluateTuff", () => {
  test("always returns a number", () => {
    expect(typeof evaluateTuff("print hello")).toBe("number");
    expect(evaluateTuff("print hello")).toBe(0);
  });
});
