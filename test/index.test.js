import { expect, test } from "bun:test";
import { createMessage } from "../src/index.js";

test("createMessage uses the default name", () => {
  expect(createMessage()).toBe("Hello, world!");
});

test("createMessage uses a custom name", () => {
  expect(createMessage("Bun")).toBe("Hello, Bun!");
});
