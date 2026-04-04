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

// invalid expression in rhs throws
test('executeTuff("out fn f(s) => {\\n    let t = s + 1;\\n}\\n\\nread()", "50") throws', () => {
  expect(() =>
    executeTuff("out fn f(s) => {\n    let t = s + 1;\n}\n\nread()", "50"),
  ).toThrow();
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

// invalid expression in return body throws (covers parseReturnBodyStatement compiled=undefined path)
test('executeTuff("out fn f(s) => {\\n    return s + 1;\\n}\\n\\nread()", "50") throws', () => {
  expect(() =>
    executeTuff("out fn f(s) => {\n    return s + 1;\n}\n\nread()", "50"),
  ).toThrow();
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
