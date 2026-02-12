import { expect, test } from "bun:test";
import { interpret } from "./index";

test("interpret(empty string) => 0", () => {
  expect(interpret("")).toBe(0);
});

test("interpret(\"100\") => 100", () => {
  expect(interpret("100")).toBe(100);
});
