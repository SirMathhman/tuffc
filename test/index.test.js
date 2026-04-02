import { expect, test } from "bun:test";
import { compileTuffToJS, executeTuff, message } from "../src/index.js";

test("exports a greeting message", () => {
  expect(message).toBe("Hello from Bun!");
});

test("compileTuffToJS returns a string", () => {
  expect(compileTuffToJS("print 'hello'")).toBe("print 'hello'");
});

test("executeTuff runs compiled JS and returns its result", () => {
  expect(executeTuff("return 2 + 3;")).toBe(5);
});

test("executeTuff returns 0 for empty source", () => {
  expect(executeTuff("")).toBe(0);
});

test("executeTuff returns numeric literals", () => {
  expect(executeTuff("100")).toBe(100);
});
