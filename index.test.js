import { describe, expect, test } from "bun:test";
import { compile } from "./index.js";

function interpret(source) {
  return new Function(compile(source))();
}

describe("interpret", () => {
  test("empty string => 0", () => {
    expect(interpret("")).toBe(0);
  });

  test('compile("x = 100") preserves final assignment statement', () => {
    expect(compile("x = 100")).toBe("let x = Number(100);\n");
  });

  test('compile("if true") falls back to a simple expression', () => {
    expect(compile("if true")).toBe("return Number(if true);");
  });

  test('compile("if (true) 1") falls back when body braces are missing', () => {
    expect(compile("if (true) 1")).toBe("return Number(if (true) 1);");
  });

  test('"100" => 100', () => {
    expect(interpret("100")).toBe(100);
  });

  test('"x = 100; x" => 100', () => {
    expect(interpret("x = 100; x")).toBe(100);
  });

  test('"true" => 1', () => {
    expect(interpret("true")).toBe(1);
  });

  test('"1 < 2" => 1', () => {
    expect(interpret("1 < 2")).toBe(1);
  });

  test('"1 <= 2" => 1', () => {
    expect(interpret("1 <= 2")).toBe(1);
  });

  test('"2 > 1" => 1', () => {
    expect(interpret("2 > 1")).toBe(1);
  });

  test('"2 >= 1" => 1', () => {
    expect(interpret("2 >= 1")).toBe(1);
  });

  test('"2 == 2" => 1', () => {
    expect(interpret("2 == 2")).toBe(1);
  });

  test('"2 != 1" => 1', () => {
    expect(interpret("2 != 1")).toBe(1);
  });

  test('"x = 1 <= 2; x" => 1', () => {
    expect(interpret("x = 1 <= 2; x")).toBe(1);
  });

  test('"x = 0; x = 100; x" => 100', () => {
    expect(interpret("x = 0; x = 100; x")).toBe(100);
  });

  test('"x = 0; { x = 100; } x" => 100', () => {
    expect(interpret("x = 0; { x = 100; } x")).toBe(100);
  });

  test('"x = 5; if (false) { x = 100; } x" => 5', () => {
    expect(interpret("x = 5; if (false) { x = 100; } x")).toBe(5);
  });

  test('"x = 100; if (true) { 200; } x" => 100', () => {
    expect(interpret("x = 100; if (true) { 200; } x")).toBe(100);
  });

  test('"x = 0; if ((true)) { x = 1; } x" => 1', () => {
    expect(interpret("x = 0; if ((true)) { x = 1; } x")).toBe(1);
  });

  test('"x = 0; if (true) { { x = 1; } } x" => 1', () => {
    expect(interpret("x = 0; if (true) { { x = 1; } } x")).toBe(1);
  });

  test('"x = 0; if (true) { x = 1; }; x" => 1', () => {
    expect(interpret("x = 0; if (true) { x = 1; }; x")).toBe(1);
  });

  test('compile("if (true) { x = 1; }") preserves final if statement', () => {
    expect(compile("if (true) { x = 1; }")).toBe(
      "if (Number(true)) {\nlet x = Number(1);\n}\n",
    );
  });
});
