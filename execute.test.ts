import { test, expect } from "bun:test";
import { compile as compileTuffToJS } from "./compile";

/**
 * Executes compiled code by creating a new Function from the compiled
 * string and running it. The result of the function is coerced to a number.
 */
export function executeTuff(input: string): number {
  const compiled = compileTuffToJS(input);
  const fn = new Function(compiled);
  const result = fn();
  return Number(result);
}

test("execute with empty string returns 0", () => {
  expect(executeTuff("")).toBe(0);
});
