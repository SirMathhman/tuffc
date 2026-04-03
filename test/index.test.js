import { expect, test } from "bun:test";
import { compileTuffToJS, executeTuff, message } from "../src/index.js";

test("exports a greeting message", () => {
  expect(message).toBe("Hello from Bun!");
});

test("compileTuffToJS returns a string", () => {
  expect(compileTuffToJS("print 'hello'")).toBe("print 'hello'");
});

test("compileTuffToJS compiles read calls", () => {
  expect(compileTuffToJS("read()")).toBe("return read();");
});

test("compileTuffToJS compiles read addition calls", () => {
  expect(compileTuffToJS("read() + read()")).toBe("return read() + read();");
});

test("compileTuffToJS leaves invalid length expressions unchanged", () => {
  expect(compileTuffToJS("foo.length")).toBe("foo.length");
});

test("compileTuffToJS leaves empty identifier assignment unchanged", () => {
  expect(compileTuffToJS(' = "foo"; .length')).toBe(' = "foo"; .length');
});

test("compileTuffToJS leaves invalid first-character identifiers unchanged", () => {
  expect(compileTuffToJS('1 = "foo"; 1.length')).toBe('1 = "foo"; 1.length');
});

test("compileTuffToJS leaves invalid identifier characters unchanged", () => {
  expect(compileTuffToJS('x-1 = "foo"; x-1.length')).toBe(
    'x-1 = "foo"; x-1.length',
  );
});

test("compileTuffToJS leaves unquoted assigned values unchanged", () => {
  expect(compileTuffToJS("x = foo; x.length")).toBe("x = foo; x.length");
});

test("executeTuff runs compiled JS and returns its result", () => {
  expect(executeTuff("return 2 + 3;")).toBe(5);
});

test("executeTuff returns 0 for empty source", () => {
  expect(executeTuff("")).toBe(0);
});

test("executeTuff returns 0 for false", () => {
  expect(executeTuff("false")).toBe(0);
});

test("executeTuff returns stdIn from read", () => {
  expect(executeTuff("read()", "100")).toBe(100);
});

test("executeTuff returns boolean stdIn from read", () => {
  expect(executeTuff("read()", "true")).toBe(true);
});

test("executeTuff returns false stdIn from read", () => {
  expect(executeTuff("read()", "false")).toBe(false);
});

test("executeTuff returns summed stdIn from reads", () => {
  expect(executeTuff("read() + read()", "25 75")).toBe(100);
});

test("executeTuff returns assigned block values", () => {
  expect(executeTuff("x = 0; { x = 1; } x")).toBe(1);
});

test("executeTuff returns boolean block values", () => {
  expect(executeTuff("x = true; { x = false; } x")).toBe(false);
});

test("executeTuff returns equality results", () => {
  expect(executeTuff("x = 0; y = 1; x == y")).toBe(0);
});

test("compileTuffToJS leaves mismatched block assignments unchanged", () => {
  expect(compileTuffToJS("x = 0; { y = 1; } x")).toBe("x = 0; { y = 1; } x");
});

test("executeTuff returns numeric literals", () => {
  expect(executeTuff("100")).toBe(100);
});

test("executeTuff returns string length expressions", () => {
  expect(executeTuff('"foo".length')).toBe(3);
});

test("executeTuff returns assigned string length expressions", () => {
  expect(executeTuff('x = "foo"; x.length')).toBe(3);
});

test("executeTuff returns function call results", () => {
  expect(executeTuff("fn get() => { return 100; } get()")).toBe(100);
});

test("executeTuff returns zero for false-returning function calls", () => {
  expect(executeTuff("fn get() => { return false; } get()")).toBe(0);
});

test("executeTuff returns parameterized function call results", () => {
  expect(executeTuff("fn pass(param) => { return param; } get(100)")).toBe(100);
});

test("executeTuff returns parameterized string arguments", () => {
  expect(executeTuff('fn pass(param) => { return param; } get("foo")')).toBe(
    "foo",
  );
});

test("compileTuffToJS leaves invalid parameterized fn arguments unchanged", () => {
  expect(compileTuffToJS("fn pass(param) => { return param; } get(foo)")).toBe(
    "fn pass(param) => { return param; } get(foo)",
  );
});

test("compileTuffToJS leaves mismatched fn calls unchanged", () => {
  expect(compileTuffToJS("fn get() => { return 100; } nope()")).toBe(
    "fn get() => { return 100; } nope()",
  );
});

test("compileTuffToJS leaves invalid fn names unchanged", () => {
  expect(compileTuffToJS("fn 1() => { return 100; } 1()")).toBe(
    "fn 1() => { return 100; } 1()",
  );
});
