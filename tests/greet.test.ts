import { describe, expect, it } from "vitest";
import { greet } from "../src/greet";

describe("greet", () => {
  it("returns a formatted greeting", () => {
    expect(greet("TypeScript")).toBe("Hello from TypeScript 👋");
  });

  it("supports arbitrary names", () => {
    expect(greet("unit tests")).toBe("Hello from unit tests 👋");
  });
});
