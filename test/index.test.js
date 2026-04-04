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

test('executeTuff("read()", "true") => 1', () => {
  expect(executeTuff("read()", "true")).toBe(1);
});

test('executeTuff("let x = read(); x", "100") => 100', () => {
  expect(executeTuff("let x = read(); x", "100")).toBe(100);
});

test('executeTuff("let y = read(); y", "100") => 100', () => {
  expect(executeTuff("let y = read(); y", "100")).toBe(100);
});

test('executeTuff("let y = read(); let z = y; z", "100") => 100', () => {
  expect(executeTuff("let y = read(); let z = y; z", "100")).toBe(100);
});

test('executeTuff("let y = read(); let z = y; let a = z; a", "100") => 100', () => {
  expect(executeTuff("let y = read(); let z = y; let a = z; a", "100")).toBe(
    100,
  );
});

test('executeTuff("let y = read(); y = read(); y", "25 75") => 75', () => {
  expect(executeTuff("let y = read(); y = read(); y", "25 75")).toBe(75);
});

test('executeTuff("let y = read(); y = read(); let z = y; z", "25 75") => 75', () => {
  expect(executeTuff("let y = read(); y = read(); let z = y; z", "25 75")).toBe(
    75,
  );
});
