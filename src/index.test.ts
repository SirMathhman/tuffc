import { expect, test } from "bun:test";
import { interpret } from "./index";

test("interpret(empty string) => 0", () => {
  expect(interpret("")).toBe(0);
});
