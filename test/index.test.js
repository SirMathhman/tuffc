import { expect, test } from "bun:test";
import {
  buildBundleSource,
  compileTuffToJS,
  createMessage,
  executeAllTuff,
  executeAllTuffWithNative,
  executeTuff,
} from "../src/index.js";

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

test('executeTuff("read()", "false") => 0', () => {
  expect(executeTuff("read()", "false")).toBe(0);
});

test('executeTuff("read()", "   ") => NaN', () => {
  expect(Number.isNaN(executeTuff("read()", "   "))).toBe(true);
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

test('executeAllTuff("main", [[ ["main"], "read()" ]], "100") => 100', () => {
  expect(executeAllTuff("main", [[["main"], "read()"]], "100")).toBe(100);
});

test('executeAllTuff("main", [[ ["main"], "let { get } = lib; get()" ], [ ["lib"] ], "out fn get() => { return read(); }"]], "100") => 100', () => {
  expect(
    executeAllTuff(
      "main",
      [
        [["main"], "let { get } = lib; get()"],
        [["lib"]],
        "out fn get() => { return read(); }",
      ],
      "100",
    ),
  ).toBe(100);
});

test('executeAllTuff("main", [[ ["main"], "let { wah } = lib; wah()" ], [ ["lib"] ], "out fn wah() => { return read(); }"]], "100") => 100', () => {
  expect(
    executeAllTuff(
      "main",
      [
        [["main"], "let { wah } = lib; wah()"],
        [["lib"]],
        "out fn wah() => { return read(); }",
      ],
      "100",
    ),
  ).toBe(100);
});

test('executeAllTuff("missing", [[ ["main"], "read()" ]], "100") throws', () => {
  expect(() =>
    executeAllTuff("missing", [[["main"], "read()"]], "100"),
  ).toThrow();
});

test('executeAllTuff("main", [[ ["main"], "let { get } = foo::lib; get()" ], [ ["foo", "lib"], "out fn get() => { return read(); }" ]], "100") => 100', () => {
  expect(
    executeAllTuff(
      "main",
      [
        [["main"], "let { get } = foo::lib; get()"],
        [["foo", "lib"], "out fn get() => { return read(); }"],
      ],
      "100",
    ),
  ).toBe(100);
});

test('executeAllTuff("main", [[ ["main"], "let { get } = foo::lib; get()" ], [ ["foo", "lib"], "out fn get() => { return read(); }" ]], "") => NaN', () => {
  expect(
    Number.isNaN(
      executeAllTuff(
        "main",
        [
          [["main"], "let { get } = foo::lib; get()"],
          [["foo", "lib"], "out fn get() => { return read(); }"],
        ],
        "",
      ),
    ),
  ).toBe(true);
});

test('executeAllTuffWithNative("main", [[ ["main"], "let { extern get } = extern outsideJS; extern fn get(); get()" ]], [[ ["outsideJS"], "export function get() { return 100; }" ]], "100") => 100', () => {
  expect(
    executeAllTuffWithNative(
      "main",
      [
        [
          ["main"],
          "let { extern get } = extern outsideJS; extern fn get(); get()",
        ],
      ],
      [[["outsideJS"], "export function get() { return 100; }"]],
      "100",
    ),
  ).toBe(100);
});

test('executeAllTuffWithNative("main", [[ ["main"], "let { extern get } = extern outsideJS; extern fn get(); get()" ]], [[ ["outsideJS"], "export function get() { return ; }" ]], "100") throws', () => {
  expect(() =>
    executeAllTuffWithNative(
      "main",
      [
        [
          ["main"],
          "let { extern get } = extern outsideJS; extern fn get(); get()",
        ],
      ],
      [[["outsideJS"], "export function get() { return ; }"]],
      "100",
    ),
  ).toThrow();
});

test('executeAllTuffWithNative("main", [[ ["main"], "let { extern get } = extern outsideJS; extern fn get(); get()" ]], [], "100") throws', () => {
  expect(() =>
    executeAllTuffWithNative(
      "main",
      [
        [
          ["main"],
          "let { extern get } = extern outsideJS; extern fn get(); get()",
        ],
      ],
      [],
      "100",
    ),
  ).toThrow();
});

test('executeAllTuffWithNative("main", [[ ["main"], "let { extern get } = extern wah::outsideJS; extern fn get(); get()" ]], [[ ["wah", "outsideJS"], "export function get() { return 100; }" ]], "100") => 100', () => {
  expect(
    executeAllTuffWithNative(
      "main",
      [
        [
          ["main"],
          "let { extern get } = extern wah::outsideJS; extern fn get(); get()",
        ],
      ],
      [[["wah", "outsideJS"], "export function get() { return 100; }"]],
      "100",
    ),
  ).toBe(100);
});

test('executeTuff("let x = 5; x", "") throws', () => {
  expect(() => executeTuff("let x = 5; x", "")).toThrow();
});

test('executeTuff("let x = read(); x = x; x", "25") => 25', () => {
  expect(executeTuff("let x = read(); x = x; x", "25")).toBe(25);
});

test('executeTuff("fn wah(foo) => { let x = foo + read(); return y; } wah(5)", "25") throws', () => {
  expect(() =>
    executeTuff(
      "fn wah(foo) => { let x = foo + read(); return y; } wah(5)",
      "25",
    ),
  ).toThrow();
});

test('executeAllTuffWithNative("main", [[ ["main"], "let { extern get } = extern wah::outside-JS; extern fn get(); get()" ]], [[ ["wah", "outsideJS"], "export function get() { return 100; }" ]], "100") throws', () => {
  expect(() =>
    executeAllTuffWithNative(
      "main",
      [
        [
          ["main"],
          "let { extern get } = extern wah::outside-JS; extern fn get(); get()",
        ],
      ],
      [[["wah", "outsideJS"], "export function get() { return 100; }"]],
      "100",
    ),
  ).toThrow();
});

test('executeAllTuffWithNative("main", [[ ["main"], "let { extern get } = extern wah::outsideJS; extern fn get(); get()" ]], [[ ["wah", "outsideJS"], "export function get() { return 100 }" ]], "100") throws', () => {
  expect(() =>
    executeAllTuffWithNative(
      "main",
      [
        [
          ["main"],
          "let { extern get } = extern wah::outsideJS; extern fn get(); get()",
        ],
      ],
      [[["wah", "outsideJS"], "export function get() { return 100 }"]],
      "100",
    ),
  ).toThrow();
});

test("buildBundleSource wraps compiled body in Node.js readable runtime", () => {
  const compiled = compileTuffToJS("read()");
  const bundle = buildBundleSource(compiled);
  expect(bundle).toContain('import { createInterface } from "node:readline"');
  expect(bundle).toContain("__tuff_read");
  expect(bundle).toContain("__tuff_coerce");
  expect(bundle).toContain("__tuff_tokenize");
  expect(bundle).toContain(compiled);
});

test("buildBundleSource embeds arbitrary compiled body", () => {
  const compiled = "return 42;";
  const bundle = buildBundleSource(compiled);
  expect(bundle).toContain(compiled);
});

test('executeTuff("fn get() => {\\n    return 100;\\n}\\n\\nread()", "50") => 50', () => {
  expect(executeTuff("fn get() => {\n    return 100;\n}\n\nread()", "50")).toBe(
    50,
  );
});

test('executeTuff("fn get() => {\\n    return read();\\n}\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff("fn get() => {\n    return read();\n}\n\nread()", "50"),
  ).toBe(50);
});

test('executeTuff("fn a() => {\\n    return 1;\\n}\\n\\nfn b() => {\\n    return 2;\\n}\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff(
      "fn a() => {\n    return 1;\n}\n\nfn b() => {\n    return 2;\n}\n\nread()",
      "50",
    ),
  ).toBe(50);
});

test('executeTuff("fn get() => {\\n    return hello;\\n}\\n\\nread()", "50") => 50 (hello is runtime undefined, read() still returns 50)', () => {
  expect(
    executeTuff("fn get() => {\n    return hello;\n}\n\nread()", "50"),
  ).toBe(50);
});

test('executeTuff("fn get() => {\\n}\\n\\nread()", "50") => 50', () => {
  expect(executeTuff("fn get() => {\n}\n\nread()", "50")).toBe(50);
});

test('executeTuff("read() == read()", "true 1") => 0', () => {
  expect(executeTuff("read() == read()", "true 1")).toBe(0);
});

test('executeTuff("read() == read()", "42 42") => 1', () => {
  expect(executeTuff("read() == read()", "42 42")).toBe(1);
});

test('executeTuff("read() == read() == read()", "42 42 42") => 1', () => {
  expect(executeTuff("read() == read() == read()", "42 42 42")).toBe(1);
});

test('executeTuff("read() == read() == read()", "42 42 99") => 0', () => {
  expect(executeTuff("read() == read() == read()", "42 42 99")).toBe(0);
});

test('executeTuff("let { extern readFileSync } = extern node::fs;\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff(
      "let { extern readFileSync } = extern node::fs;\n\nread()",
      "50",
    ),
  ).toBe(50);
});

test('executeTuff("fn get() => {\\n    return 1;\\n}\\n\\nlet { extern readFileSync } = extern node::fs;\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff(
      "fn get() => {\n    return 1;\n}\n\nlet { extern readFileSync } = extern node::fs;\n\nread()",
      "50",
    ),
  ).toBe(50);
});

test('executeTuff("let { extern readFileSync } = extern node::fs;\\n\\nlet { extern join } = extern node::path;\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff(
      "let { extern readFileSync } = extern node::fs;\n\nlet { extern join } = extern node::path;\n\nread()",
      "50",
    ),
  ).toBe(50);
});

test('executeTuff("let { extern bad-name } = extern node::fs;\\n\\nread()", "50") throws', () => {
  expect(() =>
    executeTuff("let { extern bad-name } = extern node::fs;\n\nread()", "50"),
  ).toThrow();
});

test('executeTuff("let { extern readFileSync } = extern node::bad-path;\\n\\nread()", "50") throws', () => {
  expect(() =>
    executeTuff(
      "let { extern readFileSync } = extern node::bad-path;\n\nread()",
      "50",
    ),
  ).toThrow();
});

test('executeTuff("let { extern readFileSync, extern writeFileSync, extern mkdirSync } = extern node::fs;\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff(
      "let { extern readFileSync, extern writeFileSync, extern mkdirSync } = extern node::fs;\n\nread()",
      "50",
    ),
  ).toBe(50);
});

test('executeTuff("let { extern readFileSync, extern bad-name } = extern node::fs;\\n\\nread()", "50") throws', () => {
  expect(() =>
    executeTuff(
      "let { extern readFileSync, extern bad-name } = extern node::fs;\n\nread()",
      "50",
    ),
  ).toThrow();
});

// multi-line extern import block (two consecutive import lines in one block)
test('executeTuff("let { extern readFileSync } = extern node::fs;\\nlet { extern createRequire } = extern node::module;\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff(
      "let { extern readFileSync } = extern node::fs;\nlet { extern createRequire } = extern node::module;\n\nread()",
      "50",
    ),
  ).toBe(50);
});

// extern fn declaration compiles to nothing
test('executeTuff("let { extern createRequire } = extern node::module;\\n\\nextern fn createRequire(arg);\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff(
      "let { extern createRequire } = extern node::module;\n\nextern fn createRequire(arg);\n\nread()",
      "50",
    ),
  ).toBe(50);
});

// extern fn declaration with invalid name throws
test('executeTuff("extern fn bad-name(arg);\\n\\nread()", "50") throws', () => {
  expect(() =>
    executeTuff("extern fn bad-name(arg);\n\nread()", "50"),
  ).toThrow();
});

// let-fn-call with import.meta.url
test('executeTuff("let { extern createRequire } = extern node::module;\\n\\nlet r = createRequire(import.meta.url);\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff(
      "let { extern createRequire } = extern node::module;\n\nlet r = createRequire(import.meta.url);\n\nread()",
      "50",
    ),
  ).toBe(50);
});

// let-fn-call with invalid arg throws
test('executeTuff("let { extern createRequire } = extern node::module;\\n\\nlet r = createRequire(123);\\n\\nread()", "50") throws', () => {
  expect(() =>
    executeTuff(
      "let { extern createRequire } = extern node::module;\n\nlet r = createRequire(123);\n\nread()",
      "50",
    ),
  ).toThrow();
});

// full complex program matching main.tuff pattern
test("executeTuff full extern import + extern fn decl + let fn call + read() => 50", () => {
  expect(
    executeTuff(
      [
        "let { extern readFileSync, extern writeFileSync, extern mkdirSync } = extern node::fs;",
        "let { extern createRequire } = extern node::module;",
        "",
        "extern fn createRequire(arg);",
        "",
        "let __tuff_builtin_require = createRequire(import.meta.url);",
        "",
        "read()",
      ].join("\n"),
      "50",
    ),
  ).toBe(50);
});

// empty multi-line fn body (no-op)
test('executeTuff("fn get() => {\\n    \\n}\\n\\nread()", "50") => 50', () => {
  expect(executeTuff("fn get() => {\n    \n}\n\nread()", "50")).toBe(50);
});

// out fn as non-final block in multi-line program
test('executeTuff("out fn noop(source) => {\\n    \\n}\\n\\nread()", "50") => 50', () => {
  expect(executeTuff("out fn noop(source) => {\n    \n}\n\nread()", "50")).toBe(
    50,
  );
});

// multi-line fn with params
test('executeTuff("fn add(a, b) => {\\n    return a;\\n}\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff("fn add(a, b) => {\n    return a;\n}\n\nread()", "50"),
  ).toBe(50);
});

// multi-line fn with invalid param name throws
test('executeTuff("fn bad(a, b-c) => {\\n    return a;\\n}\\n\\nread()", "50") throws', () => {
  expect(() =>
    executeTuff("fn bad(a, b-c) => {\n    return a;\n}\n\nread()", "50"),
  ).toThrow();
});

// full main.tuff pattern
test("executeTuff full main.tuff pattern => 50", () => {
  expect(
    executeTuff(
      [
        "let { extern readFileSync, extern writeFileSync, extern mkdirSync } = extern node::fs;",
        "let { extern createRequire } = extern node::module;",
        "",
        "extern fn createRequire(arg);",
        "",
        "let __tuff_builtin_require = createRequire(import.meta.url);",
        "",
        "out fn compileTuffToJS(source) => {",
        "    ",
        "}",
        "",
        "read()",
      ].join("\n"),
      "50",
    ),
  ).toBe(50);
});

// let binding in body
test('executeTuff("out fn f(s) => {\\n    let t = s.trim();\\n}\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff("out fn f(s) => {\n    let t = s.trim();\n}\n\nread()", "50"),
  ).toBe(50);
});

// return method call expression
test('executeTuff("out fn f(s) => {\\n    return s.trim();\\n}\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff("out fn f(s) => {\n    return s.trim();\n}\n\nread()", "50"),
  ).toBe(50);
});

// chained method call
test('executeTuff("out fn f(s) => {\\n    return s.trim().toString();\\n}\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff(
      "out fn f(s) => {\n    return s.trim().toString();\n}\n\nread()",
      "50",
    ),
  ).toBe(50);
});

// method call with param argument
test('executeTuff("out fn f(a, b) => {\\n    return a.concat(b);\\n}\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff(
      "out fn f(a, b) => {\n    return a.concat(b);\n}\n\nread()",
      "50",
    ),
  ).toBe(50);
});

// s + 1 is now valid (+ was added); result is NaN but doesn't throw
test('executeTuff("out fn f(s) => {\\n    let t = s + 1;\\n}\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff("out fn f(s) => {\n    let t = s + 1;\n}\n\nread()", "50"),
  ).toBe(50);
});

// let binding + return in body
test('executeTuff("out fn f(s) => {\\n    let t = s.trim();\\n    return t;\\n}\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff(
      "out fn f(s) => {\n    let t = s.trim();\n    return t;\n}\n\nread()",
      "50",
    ),
  ).toBe(50);
});

// return s + 1 is now valid (+ added); read() still returns 50
test('executeTuff("out fn f(s) => {\\n    return s + 1;\\n}\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff("out fn f(s) => {\n    return s + 1;\n}\n\nread()", "50"),
  ).toBe(50);
});

// bare expression statement (not let/return) in body throws (covers parseLetBodyStatement parsed=undefined path)
test('executeTuff("out fn f(s) => {\\n    s.trim();\\n}\\n\\nread()", "50") throws', () => {
  expect(() =>
    executeTuff("out fn f(s) => {\n    s.trim();\n}\n\nread()", "50"),
  ).toThrow();
});

// multi-arg call in body covers while-loop for additional args
test('executeTuff("out fn f(a, b, c) => {\\n    return a.concat(b, c);\\n}\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff(
      "out fn f(a, b, c) => {\n    return a.concat(b, c);\n}\n\nread()",
      "50",
    ),
  ).toBe(50);
});

// import.meta.url in body expression compiles to __tuff_import_meta_url
test('executeTuff("out fn f() => {\\n    return import.meta.url;\\n}\\n\\nread()", "50") => 50', () => {
  expect(
    executeTuff(
      "out fn f() => {\n    return import.meta.url;\n}\n\nread()",
      "50",
    ),
  ).toBe(50);
});

// full main.tuff pattern with let binding in body
test("executeTuff main.tuff with let binding in body => 50", () => {
  expect(
    executeTuff(
      [
        "let { extern readFileSync, extern writeFileSync, extern mkdirSync } = extern node::fs;",
        "let { extern createRequire } = extern node::module;",
        "",
        "extern fn createRequire(arg);",
        "",
        "let __tuff_builtin_require = createRequire(import.meta.url);",
        "",
        "out fn compileTuffToJS(source) => {",
        "    let trimmed = source.trim();",
        "}",
        "",
        "read()",
      ].join("\n"),
      "50",
    ),
  ).toBe(50);
});

// ── if statements ─────────────────────────────────────────────────────────────

// simple if: condition true → return from if body
test("executeTuff simple if true branch => 50", () => {
  expect(
    executeTuff(
      "out fn f(x) => {\n    if (x != undefined) {\n        return x;\n    }\n}\n\nread()",
      "50",
    ),
  ).toBe(50);
});

// simple if: condition false → fall through; read() still 50
test("executeTuff simple if false branch falls through => 50", () => {
  expect(
    executeTuff(
      "out fn f(x) => {\n    if (x == undefined) {\n        return x;\n    }\n}\n\nread()",
      "50",
    ),
  ).toBe(50);
});

// if-else
test("executeTuff if-else => 50", () => {
  expect(
    executeTuff(
      [
        "out fn pick(a, b) => {",
        "    if (a != undefined) {",
        "        return a;",
        "    } else {",
        "        return b;",
        "    }",
        "}",
        "",
        "read()",
      ].join("\n"),
      "50",
    ),
  ).toBe(50);
});

// if-else if-else chain
test("executeTuff if-else if-else chain => 50", () => {
  expect(
    executeTuff(
      [
        "out fn classify(x) => {",
        "    if (x == 1) {",
        "        return x;",
        "    } else if (x == 2) {",
        "        return x;",
        "    } else {",
        "        return x;",
        "    }",
        "}",
        "",
        "read()",
      ].join("\n"),
      "50",
    ),
  ).toBe(50);
});

// nested if
test("executeTuff nested if => 50", () => {
  expect(
    executeTuff(
      [
        "out fn f(a, b) => {",
        "    if (a != undefined) {",
        "        if (b != undefined) {",
        "            return b;",
        "        }",
        "        return a;",
        "    }",
        "    return a;",
        "}",
        "",
        "read()",
      ].join("\n"),
      "50",
    ),
  ).toBe(50);
});

// let + if + return combo (the main.tuff pattern)
test("executeTuff let + if + return => 50", () => {
  expect(
    executeTuff(
      [
        "out fn f(source) => {",
        "    let trimmed = source.trim();",
        "    if (trimmed != undefined) {",
        "        return trimmed;",
        "    }",
        "    return source;",
        "}",
        "",
        "read()",
      ].join("\n"),
      "50",
    ),
  ).toBe(50);
});

// && condition
test("executeTuff && condition => 50", () => {
  expect(
    executeTuff(
      [
        "out fn f(a, b) => {",
        "    if (a != undefined && b != undefined) {",
        "        return a;",
        "    }",
        "    return b;",
        "}",
        "",
        "read()",
      ].join("\n"),
      "50",
    ),
  ).toBe(50);
});

// || condition
test("executeTuff || condition => 50", () => {
  expect(
    executeTuff(
      [
        "out fn f(a, b) => {",
        "    if (a == undefined || b != undefined) {",
        "        return b;",
        "    }",
        "    return a;",
        "}",
        "",
        "read()",
      ].join("\n"),
      "50",
    ),
  ).toBe(50);
});

// invalid condition token in if (@ is not a valid token) => throws
test("executeTuff invalid condition token in if => throws", () => {
  expect(() =>
    executeTuff(
      "out fn f(x) => {\n    if (x @ 1) {\n        return x;\n    }\n}\n\nread()",
      "50",
    ),
  ).toThrow();
});

// invalid body statement inside if => throws
test("executeTuff invalid body statement inside if => throws", () => {
  expect(() =>
    executeTuff(
      "out fn f(x) => {\n    if (x != undefined) {\n        x + 1;\n    }\n}\n\nread()",
      "50",
    ),
  ).toThrow();
});

// malformed else-if header (missing space before {) => throws
test("executeTuff malformed else-if header => throws", () => {
  expect(() =>
    executeTuff(
      [
        "out fn f(x) => {",
        "    if (x != undefined) {",
        "        return x;",
        "    } else if (x) {oops",
        "        return x;",
        "    }",
        "}",
        "",
        "read()",
      ].join("\n"),
      "50",
    ),
  ).toThrow();
});

// < > <= >= comparison operators in condition
test("executeTuff < and <= conditions => 50", () => {
  expect(
    executeTuff(
      [
        "out fn f(x) => {",
        "    if (x > 0) {",
        "        if (x <= 100) {",
        "            return x;",
        "        }",
        "    }",
        "    return x;",
        "}",
        "",
        "read()",
      ].join("\n"),
      "50",
    ),
  ).toBe(50);
});

// grouping parens in condition
test("executeTuff grouped condition => 50", () => {
  expect(
    executeTuff(
      [
        "out fn f(x) => {",
        "    if ((x >= 0) && (x != undefined)) {",
        "        return x;",
        "    }",
        "    return x;",
        "}",
        "",
        "read()",
      ].join("\n"),
      "50",
    ),
  ).toBe(50);
});

// if with empty body (no statements)
test("executeTuff if with empty body => 50", () => {
  expect(
    executeTuff(
      [
        "out fn f(x) => {",
        "    if (x != undefined) {",
        "    }",
        "    return x;",
        "}",
        "",
        "read()",
      ].join("\n"),
      "50",
    ),
  ).toBe(50);
});

// ── while statements ─────────────────────────────────────────────────────────

// while true once (return exits loop immediately)
test("executeTuff while true returns from body => 99", () => {
  expect(
    executeTuff(
      [
        "out fn f() => {",
        "    while (read()) {",
        "        return 99;",
        "    }",
        "    return 50;",
        "}",
        "",
        "f()",
      ].join("\n"),
      "1",
    ),
  ).toBe(99);
});

// while false falls through
test("executeTuff while false falls through => 50", () => {
  expect(
    executeTuff(
      [
        "out fn f() => {",
        "    while (read()) {",
        "        return 99;",
        "    }",
        "    return 50;",
        "}",
        "",
        "f()",
      ].join("\n"),
      "0",
    ),
  ).toBe(50);
});

// nested while in if block
test("executeTuff nested while in if block => 77", () => {
  expect(
    executeTuff(
      [
        "out fn f(x) => {",
        "    if (x != undefined) {",
        "        while (read()) {",
        "            return 77;",
        "        }",
        "    }",
        "    return 50;",
        "}",
        "",
        "f(1)",
      ].join("\n"),
      "1",
    ),
  ).toBe(77);
});

// malformed while header should throw
test("executeTuff malformed while header => throws", () => {
  expect(() =>
    executeTuff(
      [
        "out fn f() => {",
        "    while (read()) oops {",
        "        return 1;",
        "    }",
        "    return 0;",
        "}",
        "",
        "f()",
      ].join("\n"),
      "1",
    ),
  ).toThrow();
});

// invalid while body statement should throw
test("executeTuff invalid while body statement => throws", () => {
  expect(() =>
    executeTuff(
      [
        "out fn f() => {",
        "    while (read()) {",
        "        x + 1;",
        "    }",
        "    return 0;",
        "}",
        "",
        "f()",
      ].join("\n"),
      "1",
    ),
  ).toThrow();
});

// ── arrays ───────────────────────────────────────────────────────────────────

test('executeTuff "[1, 2, 3]" as entry => [1,2,3]', () => {
  expect(executeTuff("[1, 2, 3]", "")).toEqual([1, 2, 3]);
});

test('executeTuff "[[1], [2]][1][0]" as entry => 2', () => {
  expect(executeTuff("[[1], [2]][1][0]", "")).toBe(2);
});

test("executeTuff array literal + index return => 20", () => {
  expect(
    executeTuff(
      [
        "out fn f() => {",
        "    let arr = [10, 20, 30];",
        "    return arr[1];",
        "}",
        "",
        "f()",
      ].join("\n"),
      "",
    ),
  ).toBe(20);
});

test("executeTuff array reassignment => 6", () => {
  expect(
    executeTuff(
      [
        "out fn f() => {",
        "    let arr = [1];",
        "    arr = [5, 6];",
        "    return arr[1];",
        "}",
        "",
        "f()",
      ].join("\n"),
      "",
    ),
  ).toBe(6);
});

test("executeTuff array element assignment with expression index => 99", () => {
  expect(
    executeTuff(
      [
        "out fn f(i) => {",
        "    let arr = [10, 20, 30];",
        "    arr[i + 1] = 99;",
        "    return arr[2];",
        "}",
        "",
        "f(1)",
      ].join("\n"),
      "",
    ),
  ).toBe(99);
});

test("executeTuff out-of-bounds array index => undefined", () => {
  expect(
    executeTuff(
      [
        "out fn f() => {",
        "    let arr = [1];",
        "    return arr[5];",
        "}",
        "",
        "f()",
      ].join("\n"),
      "",
    ),
  ).toBeUndefined();
});

test("executeTuff negative array index => undefined", () => {
  expect(
    executeTuff(
      [
        "out fn f() => {",
        "    let arr = [1];",
        "    return arr[-1];",
        "}",
        "",
        "f()",
      ].join("\n"),
      "",
    ),
  ).toBeUndefined();
});

test("executeTuff trailing comma in array literal => throws", () => {
  expect(() => executeTuff("[1, 2,]", "")).toThrow();
});

test("executeTuff empty index access => throws", () => {
  expect(() =>
    executeTuff(
      [
        "out fn f() => {",
        "    let arr = [1];",
        "    return arr[];",
        "}",
        "",
        "f()",
      ].join("\n"),
      "",
    ),
  ).toThrow();
});

test("executeTuff non-assignable LHS assignment => throws", () => {
  expect(() =>
    executeTuff(
      [
        "out fn f() => {",
        "    [1, 2] = 3;",
        "    return 0;",
        "}",
        "",
        "f()",
      ].join("\n"),
      "",
    ),
  ).toThrow();
});

// ── string literals and + operator ───────────────────────────────────────────

// return a double-quoted string literal
test('executeTuff return double-quoted string literal => "hello"', () => {
  expect(
    executeTuff('out fn f() => {\n    return "hello";\n}\n\nread()', "50"),
  ).toBe(50);
});

// return a single-quoted string literal
test("executeTuff return single-quoted string literal => 50", () => {
  expect(
    executeTuff("out fn f(x) => {\n    return 'yes';\n}\n\nread()", "50"),
  ).toBe(50);
});

// string + string concatenation
test("executeTuff string + string => 50", () => {
  expect(
    executeTuff('out fn f() => {\n    return "5" + "0";\n}\n\nread()', "50"),
  ).toBe(50);
});

// number + number (+ works for numbers too)
test("executeTuff number + number in return => 50", () => {
  expect(
    executeTuff("out fn f() => {\n    return 25 + 25;\n}\n\nread()", "50"),
  ).toBe(50);
});

// identifier + string literal
test("executeTuff identifier + string => 50", () => {
  expect(
    executeTuff('out fn f(x) => {\n    return x + "";\n}\n\nread()', "50"),
  ).toBe(50);
});

// escape sequences: \n in string survives compilation
test("executeTuff string with escape sequence compiles", () => {
  expect(
    executeTuff(
      'out fn f() => {\n    let s = "a\\nb";\n    return s;\n}\n\nread()',
      "50",
    ),
  ).toBe(50);
});

// method call on string literal
test("executeTuff method call on string literal => 50", () => {
  expect(
    executeTuff(
      'out fn f() => {\n    return "  50  ".trim();\n}\n\nread()',
      "50",
    ),
  ).toBe(50);
});

// string in condition
test("executeTuff string in condition => 50", () => {
  expect(
    executeTuff(
      'out fn f(x) => {\n    if (x == "nope") {\n        return "bad";\n    }\n    return x;\n}\n\nread()',
      "50",
    ),
  ).toBe(50);
});

// unclosed string literal => throws
test("executeTuff unclosed string literal => throws", () => {
  expect(() =>
    executeTuff('out fn f() => {\n    return "hello;\n}\n\nread()', "50"),
  ).toThrow();
});

// unknown escape sequence => throws
test("executeTuff unknown escape sequence in string => throws", () => {
  expect(() =>
    executeTuff('out fn f() => {\n    return "he\\llo";\n}\n\nread()', "50"),
  ).toThrow();
});

// ── free expression entry ─────────────────────────────────────────────────────

// string literal as sole entry point
test('executeTuff "hello" as entry => "hello"', () => {
  expect(executeTuff('"hello"', "")).toBe("hello");
});

// number literal as sole entry point
test("executeTuff 42 as entry => 42", () => {
  expect(executeTuff("42", "")).toBe(42);
});

// read() as entry (existing behaviour unchanged)
test("executeTuff read() as entry => 50 (unchanged)", () => {
  expect(executeTuff("read()", "50")).toBe(50);
});

// method call on string literal as entry
test('executeTuff "  hi  ".trim() as entry => "hi"', () => {
  expect(executeTuff('"  hi  ".trim()', "")).toBe("hi");
});

// function call with string arg as entry in multi-block program
test("executeTuff id(string) multi-block entry => 'hi'", () => {
  expect(
    executeTuff(
      ["out fn id(x) => {", "    return x;", "}", "", 'id("hi")'].join("\n"),
      "",
    ),
  ).toBe("hi");
});

// function call with read() arg as entry in multi-block program
test("executeTuff f(read()) via multi-block => 50", () => {
  expect(
    executeTuff(
      [
        "out fn passThrough(x) => {",
        "    return x;",
        "}",
        "",
        "passThrough(read())",
      ].join("\n"),
      "50",
    ),
  ).toBe(50);
});

// bare unsupported expression (comparison) still throws
test("executeTuff free comparison expression => throws", () => {
  expect(() => executeTuff("x == y", "")).toThrow();
});

// ── main.tuff self-host: read() dispatch ─────────────────────────────────────

// self-hosted compileTuffToJS("read()") returns the correct JS
test('executeTuff self-hosted compileTuffToJS("read()") => JS string', () => {
  expect(
    executeTuff(
      [
        "out fn compileTuffToJS(source) => {",
        "    let trimmed = source.trim();",
        '    if (trimmed == "read()") {',
        '        return "return __tuff_coerce(__tuff_read());";',
        "    }",
        "}",
        "",
        'compileTuffToJS("read()")',
      ].join("\n"),
      "",
    ),
  ).toBe("return __tuff_coerce(__tuff_read());");
});

// self-hosted compileTuffToJS with non-matching input returns undefined
test("executeTuff self-hosted compileTuffToJS(non-match) => undefined", () => {
  expect(
    executeTuff(
      [
        "out fn compileTuffToJS(source) => {",
        "    let trimmed = source.trim();",
        '    if (trimmed == "read()") {',
        '        return "return __tuff_coerce(__tuff_read());";',
        "    }",
        "}",
        "",
        'compileTuffToJS("other")',
      ].join("\n"),
      "",
    ),
  ).toBeUndefined();
});
