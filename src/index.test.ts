import { expect, test } from "bun:test";
import { interpret } from "./index";

test("interpret(empty string) => 0", () => {
  const result = interpret("");
  expect(result.isSuccess()).toBe(true);
  if (result.isSuccess()) {
    expect(result.value).toBe(0);
  }
});

test('interpret("100") => 100', () => {
  const result = interpret("100");
  expect(result.isSuccess()).toBe(true);
  if (result.isSuccess()) {
    expect(result.value).toBe(100);
  }
});
