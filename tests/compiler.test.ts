import { describe, expect, test } from "bun:test";
import { executeTuff } from "../src/compiler";

describe("executeTuff", () => {
  describe("empty program", () => {
    test("returns exit code 0 for empty string", async () => {
      const exitCode = await executeTuff("");
      expect(exitCode).toBe(0);
    });
  });
});
