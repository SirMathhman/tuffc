import { expect, test } from "bun:test";
import { interpret } from "./index";

function testSuccess(input: string, expected: number, description: string) {
  test(description, () => {
    const result = interpret(input);
    expect(result.isSuccess()).toBe(true);
    if (result.isSuccess()) {
      expect(result.value).toBe(expected);
    }
  });
}

testSuccess("", 0, "interpret(empty string) => 0");
testSuccess("100", 100, 'interpret("100") => 100');
testSuccess("100U8", 100, 'interpret("100U8") => 100');

test("interpret invalid input returns descriptive error", () => {
  const result = interpret("not a number");
  expect(result.isFailure()).toBe(true);
  if (result.isFailure()) {
    const error = result.error;
    expect(error.source).toBe("not a number");
    expect(error.description).toBe("Failed to parse input as a number");
    expect(error.reason).toBe(
      "The input string cannot be converted to a valid integer",
    );
    expect(error.fix).toBe(
      "Provide a valid numeric string (e.g., '42', '100', '-5')",
    );
  }
});
