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

test("interpret invalid input returns descriptive error", () => {
  const result = interpret("not a number");
  expect(result.isFailure()).toBe(true);
  if (result.isFailure()) {
    const error = result.error;
    expect(error.source).toBe("not a number");
    expect(error.description).toBe(
      "Failed to parse input as a number"
    );
    expect(error.reason).toBe(
      "The input string cannot be converted to a valid integer"
    );
    expect(error.fix).toBe(
      "Provide a valid numeric string (e.g., '42', '100', '-5')"
    );
  }
});

