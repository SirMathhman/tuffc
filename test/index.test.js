import { expect, test } from "bun:test";
import { message } from "../src/index.js";

test("exports a greeting message", () => {
  expect(message).toBe("Hello from Bun!");
});
