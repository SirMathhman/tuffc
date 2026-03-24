import { describe, expect, test } from "bun:test";
import { greet } from "../src/index";

describe("greet", () => {
  test("returns a friendly greeting", () => {
    expect(greet("Bun")).toBe("Hello, Bun!");
  });
});
