import { expect, test } from "bun:test";
import { compileTuffToJS, message } from "../src/index.js";

test("exports a greeting message", () => {
  expect(message).toBe("Hello from Bun!");
});

test("compileTuffToJS returns a string", () => {
  expect(compileTuffToJS("print 'hello'")).toBe("print 'hello'");
});
