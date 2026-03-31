import { describe, expect, test } from "bun:test";
import { interpret } from "./index.js";

describe("interpret", () => {
  test("empty string => 0", () => {
    expect(interpret("")).toBe(0);
  });
});
