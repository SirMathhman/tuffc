import { describe, expect, test } from "bun:test";
import { interpret } from "./index.js";

describe("interpret", () => {
  test("empty string => 0", () => {
    expect(interpret("")).toBe(0);
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
});
