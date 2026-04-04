import { expect, test } from "bun:test";
import { createMessage, executeTuff } from "../src/index.js";

test("createMessage uses the default name", () => {
  expect(createMessage()).toBe("Hello, world!");
});

test("createMessage uses a custom name", () => {
  expect(createMessage("Bun")).toBe("Hello, Bun!");
});

test('executeTuff("read()", "100") => 100', () => {
  expect(executeTuff("read()", "100")).toBe(100);
});

test('executeTuff("read()", "100 200") => 100', () => {
  expect(executeTuff("read()", "100 200")).toBe(100);
});
