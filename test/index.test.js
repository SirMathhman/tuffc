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

test('executeTuff("let x = read(); let y = read(); x + y", "25 75") => 100', () => {
  expect(executeTuff("let x = read(); let y = read(); x + y", "25 75")).toBe(
    100,
  );
});

test('executeTuff("let x = read(); x + x", "25") => 50', () => {
  expect(executeTuff("let x = read(); x + x", "25")).toBe(50);
});

test('executeTuff("read() + read()", "25 75") => 100', () => {
  expect(executeTuff("read() + read()", "25 75")).toBe(100);
});

test('executeTuff("fn get() => { return read(); } get()", "25") => 25', () => {
  expect(executeTuff("fn get() => { return read(); } get()", "25")).toBe(25);
});

test('executeTuff("fn wah() => { return read(); } wah()", "25") => 25', () => {
  expect(executeTuff("fn wah() => { return read(); } wah()", "25")).toBe(25);
});

test('executeTuff("fn wah(foo) => { return foo + read(); } wah(5)", "25") => 30', () => {
  expect(
    executeTuff("fn wah(foo) => { return foo + read(); } wah(5)", "25"),
  ).toBe(30);
});

test('executeTuff("fn wah(foo) => { let x = foo + read(); return x; } wah(5)", "25") => 30', () => {
  expect(
    executeTuff(
      "fn wah(foo) => { let x = foo + read(); return x; } wah(5)",
      "25",
    ),
  ).toBe(30);
});

test('executeTuff("read()", "false") => 0', () => {
  expect(executeTuff("read()", "false")).toBe(0);
});

test('executeTuff("read()", "   ") => NaN', () => {
  expect(Number.isNaN(executeTuff("read()", "   "))).toBe(true);
});

test('executeTuff("fn () => { return read(); } ()", "25") throws', () => {
  expect(() => executeTuff("fn () => { return read(); } ()", "25")).toThrow();
});

test('executeTuff("fn bad() => { return read(); } other()", "25") throws', () => {
  expect(() =>
    executeTuff("fn bad() => { return read(); } other()", "25"),
  ).toThrow();
});

test('executeTuff("fn wah(foo) => { return bar + read(); } wah(5)", "25") throws', () => {
  expect(() =>
    executeTuff("fn wah(foo) => { return bar + read(); } wah(5)", "25"),
  ).toThrow();
});

test('executeTuff("fn wah(foo) => { return foo + read(); } other(5)", "25") throws', () => {
  expect(() =>
    executeTuff("fn wah(foo) => { return foo + read(); } other(5)", "25"),
  ).toThrow();
});

test('executeTuff("fn wah(foo) => { return foo + read(); } wah()", "25") throws', () => {
  expect(() =>
    executeTuff("fn wah(foo) => { return foo + read(); } wah()", "25"),
  ).toThrow();
});

test('executeTuff("let x=read(); x", "25") throws', () => {
  expect(() => executeTuff("let x=read(); x", "25")).toThrow();
});

test('executeTuff("let 1x = read(); 1x", "25") throws', () => {
  expect(() => executeTuff("let 1x = read(); 1x", "25")).toThrow();
});

test('executeTuff("let x = read(); y = read(); y", "25 75") throws', () => {
  expect(() => executeTuff("let x = read(); y = read(); y", "25 75")).toThrow();
});

test('executeTuff("let x = read(); let y = z; y", "25") throws', () => {
  expect(() => executeTuff("let x = read(); let y = z; y", "25")).toThrow();
});

test('executeTuff("let x = read(); x + y", "25") throws', () => {
  expect(() => executeTuff("let x = read(); x + y", "25")).toThrow();
});
