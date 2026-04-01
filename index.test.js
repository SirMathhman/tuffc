import { describe, expect, test } from "bun:test";
import { compile, interpret, interpretAll } from "./index.js";

describe("interpret", () => {
  test("empty string => 0", () => {
    expect(interpret("")).toBe(0);
  });

  test('compile("x = 100") preserves final assignment statement', () => {
    expect(compile("x = 100")).toBe("let x = Number(100);\n");
  });

  test('compile("x = { y : 100 }; x.y") preserves object literals and property access', () => {
    expect(compile("x = { y : 100 }; x.y")).toBe(
      "let x = { y : 100 };\nreturn Number(x.y);",
    );
  });

  test('compile("{ y : 100 }.y") preserves object literal property access', () => {
    expect(compile("{ y : 100 }.y")).toBe("return { y : 100 }.y;");
  });

  test('compile("{}") preserves plain block semantics', () => {
    expect(compile("{}")).toBe("");
  });

  test('compile("{{}}") preserves nested block semantics', () => {
    expect(compile("{{}}")).toBe("");
  });

  test('compile("{") gracefully handles unterminated brace input', () => {
    expect(compile("{")).toBe("");
  });

  test('compile("if true") falls back to a simple expression', () => {
    expect(compile("if true")).toBe("return Number(if true);");
  });

  test('compile("if") falls back to a simple expression', () => {
    expect(compile("if")).toBe("return Number(if);");
  });

  test('compile("if (true) 1") falls back when body braces are missing', () => {
    expect(compile("if (true) 1")).toBe("return Number(if (true) 1);");
  });

  test('compile("if (true)") falls back when the body is missing', () => {
    expect(compile("if (true)")).toBe("return Number(if (true));");
  });

  test('compile("ifx (true)") falls back when if is part of an identifier', () => {
    expect(compile("ifx (true)")).toBe("return Number(ifx (true));");
  });

  test('compile("return 1") preserves return statements', () => {
    expect(compile("return 1")).toBe("return Number(1);\n");
  });

  test('compile("fn add(a, b) => { return a + b; }") preserves final function statement', () => {
    expect(compile("fn add(a, b) => { return a + b; }")).toBe(
      "function add(a, b) {\nreturn Number(a + b);\n}\n",
    );
  });

  test('compile("fn") falls back when the function name is missing', () => {
    expect(compile("fn")).toBe("return Number(fn);");
  });

  test('compile("fn add") falls back when the parameter list is missing', () => {
    expect(compile("fn add")).toBe("return Number(fn add);");
  });

  test('compile("fn add(") falls back when the parameter list is unclosed', () => {
    expect(compile("fn add(")).toBe("return Number(fn add();");
  });

  test('compile("fn add(a, b)") falls back when the arrow is missing', () => {
    expect(compile("fn add(a, b)")).toBe("return Number(fn add(a, b));");
  });

  test('compile("fn add(a, b) => 1") falls back when the body braces are missing', () => {
    expect(compile("fn add(a, b) => 1")).toBe(
      "let fn add(a, b) = Number(> 1);\n",
    );
  });

  test('compile("extern fn add(this, other); 3.add(4)") injects a global-backed method wrapper', () => {
    expect(compile("extern fn add(this, other); 3.add(4)")).toBe(
      "Object.prototype.add = function(other) {\nreturn globalThis.add(this, other);\n};\nreturn Number(3 .add(4));",
    );
  });

  test('compile("extern") falls back when fn is missing', () => {
    expect(compile("extern")).toBe("return Number(extern);");
  });

  test('compile("extern fn") falls back when the extern signature is incomplete', () => {
    expect(compile("extern fn")).toBe("return Number(extern fn);");
  });

  test('compile("x = extern foo; x") assigns a globalThis reference via extern expression', () => {
    expect(compile("x = extern foo; x")).toBe(
      "let x = globalThis.foo;\nreturn Number(x);",
    );
  });

  test('compile("out fn get() => { return 4; }") preserves final out function statement', () => {
    expect(compile("out fn get() => { return 4; }")).toBe(
      "function get() {\nreturn Number(4);\n}\n",
    );
  });

  test('compile("out fn") falls back when the out signature is incomplete', () => {
    expect(compile("out fn")).toBe("return Number(out fn);");
  });

  test('compile("out x") falls back when out is not followed by fn', () => {
    expect(compile("out x")).toBe("return Number(out x);");
  });

  test('interpret("x = ; x") => 0 for an empty compiled value', () => {
    expect(interpret("x = ; x")).toBe(0);
  });

  test('"100" => 100', () => {
    expect(interpret("100")).toBe(100);
  });

  test('"x = 100; x" => 100', () => {
    expect(interpret("x = 100; x")).toBe(100);
  });

  test('"x = { y : 100 }; x.y" => 100', () => {
    expect(interpret("x = { y : 100 }; x.y")).toBe(100);
  });

  test('"{ y : 100 }.y" => 100', () => {
    expect(interpret("{ y : 100 }.y")).toBe(100);
  });

  test('"{}" => undefined', () => {
    expect(interpret("{}")).toBeUndefined();
  });

  test('"{{}}" => undefined', () => {
    expect(interpret("{{}}")).toBeUndefined();
  });

  test('"fn add(a, b) => { return a + b; } add(3, 4)" => 7', () => {
    expect(interpret("fn add(a, b) => { return a + b; } add(3, 4)")).toBe(7);
  });

  test('"fn add(a, b) => { sum = a + b; return sum; } add(3, 4)" => 7', () => {
    expect(
      interpret("fn add(a, b) => { sum = a + b; return sum; } add(3, 4)"),
    ).toBe(7);
  });

  test('"fn yes() => { return true; } yes()" => 1', () => {
    expect(interpret("fn yes() => { return true; } yes()")).toBe(1);
  });

  test('"fn Add(a, b) => { if (true) { return a + b; } }; Add(3, 4)" => 7', () => {
    expect(
      interpret("fn Add(a, b) => { if (true) { return a + b; } }; Add(3, 4)"),
    ).toBe(7);
  });

  test('"extern fn add(this, other); 3.add(4)" => 7', () => {
    expect(
      interpret("extern fn add(this, other); 3.add(4)", {
        add: (first, second) => {
          return first + second;
        },
      }),
    ).toBe(7);
  });

  test('"extern fn add(first, second); add(3, 4)" => 7', () => {
    expect(
      interpret("extern fn add(first, second); add(3, 4)", {
        add: (first, second) => {
          return first + second;
        },
      }),
    ).toBe(7);
  });

  test('"extern fn add(first, second); add(3, 4)" => 7 with existing globals', () => {
    expect(
      interpret("extern fn add(first, second); add(3, 4)", {
        add: (first, second) => {
          return first + second;
        },
        Math,
      }),
    ).toBe(7);
  });

  test('"true" => 1', () => {
    expect(interpret("true")).toBe(1);
  });

  test('"1 < 2" => 1', () => {
    expect(interpret("1 < 2")).toBe(1);
  });

  test('"1 <= 2" => 1', () => {
    expect(interpret("1 <= 2")).toBe(1);
  });

  test('"2 > 1" => 1', () => {
    expect(interpret("2 > 1")).toBe(1);
  });

  test('"2 >= 1" => 1', () => {
    expect(interpret("2 >= 1")).toBe(1);
  });

  test('"2 == 2" => 1', () => {
    expect(interpret("2 == 2")).toBe(1);
  });

  test('"2 != 1" => 1', () => {
    expect(interpret("2 != 1")).toBe(1);
  });

  test('"x = 1 <= 2; x" => 1', () => {
    expect(interpret("x = 1 <= 2; x")).toBe(1);
  });

  test('"x = 0; x = 100; x" => 100', () => {
    expect(interpret("x = 0; x = 100; x")).toBe(100);
  });

  test('"x = 0; { x = 100; } x" => 100', () => {
    expect(interpret("x = 0; { x = 100; } x")).toBe(100);
  });

  test('"x = 5; if (false) { x = 100; } x" => 5', () => {
    expect(interpret("x = 5; if (false) { x = 100; } x")).toBe(5);
  });

  test('"x = 100; if (true) { 200; } x" => 100', () => {
    expect(interpret("x = 100; if (true) { 200; } x")).toBe(100);
  });

  test('"x = 0; if ((true)) { x = 1; } x" => 1', () => {
    expect(interpret("x = 0; if ((true)) { x = 1; } x")).toBe(1);
  });

  test('"x = 0; if (true) { { x = 1; } } x" => 1', () => {
    expect(interpret("x = 0; if (true) { { x = 1; } } x")).toBe(1);
  });

  test('"x = 0; if (true) { x = 1; }; x" => 1', () => {
    expect(interpret("x = 0; if (true) { x = 1; }; x")).toBe(1);
  });

  test('compile("if (true) { x = 1; }") preserves final if statement', () => {
    expect(compile("if (true) { x = 1; }")).toBe(
      "if (Number(true)) {\nlet x = Number(1);\n}\n",
    );
  });

  test('"ifx = 1; ifx" => 1', () => {
    expect(interpret("ifx = 1; ifx")).toBe(1);
  });

  test('"fnx = 1; fnx" => 1', () => {
    expect(interpret("fnx = 1; fnx")).toBe(1);
  });

  test('"returnx = 1; returnx" => 1', () => {
    expect(interpret("returnx = 1; returnx")).toBe(1);
  });

  test('"ifx = 1 <= 2; ifx" => 1', () => {
    expect(interpret("ifx = 1 <= 2; ifx")).toBe(1);
  });

  test('"point = { x : 3, y : 4 }; { x, y } = point; x + y" => 7', () => {
    expect(interpret("point = { x : 3, y : 4 }; { x, y } = point; x + y")).toBe(
      7,
    );
  });

  test('"point = { x : 3, y : 4 }; {} = point; point.x" => 3', () => {
    expect(interpret("point = { x : 3, y : 4 }; {} = point; point.x")).toBe(3);
  });

  test('"point = { x : 3, y : 4 }; { x: left, y: right } = point; left + right" => 7', () => {
    expect(
      interpret(
        "point = { x : 3, y : 4 }; { x: left, y: right } = point; left + right",
      ),
    ).toBe(7);
  });

  test('"point = { x : 3, y : 4 }; { x, y } = point; { x, y } = { x : 5, y : 6 }; x + y" => 11', () => {
    expect(
      interpret(
        "point = { x : 3, y : 4 }; { x, y } = point; { x, y } = { x : 5, y : 6 }; x + y",
      ),
    ).toBe(11);
  });

  test('"[1, 2, 3][0]" => 1', () => {
    expect(interpret("[1, 2, 3][0]")).toBe(1);
  });

  test('"x = [1, 2, 3]; x[0]" => 1', () => {
    expect(interpret("x = [1, 2, 3]; x[0]")).toBe(1);
  });

  test('"\"test\".length" => 4', () => {
    expect(interpret('"test".length')).toBe(4);
  });

  test('"x = \"test\"; x.length" => 4', () => {
    expect(interpret('x = "test"; x.length')).toBe(4);
  });

  test('"x = [1, 2, 3, 4]; x.length" => 4', () => {
    expect(interpret("x = [1, 2, 3, 4]; x.length")).toBe(4);
  });

  test('interpretAll("main", { main, lib }) with out fn export => 4', () => {
    expect(
      interpretAll("main", {
        main: "{ get } = lib; get()",
        lib: "out fn get() => { return 4; }",
      }),
    ).toBe(4);
  });

  test("interpretAll skips empty non-entry module sources", () => {
    expect(
      interpretAll("main", {
        main: "0",
        lib: "   ",
      }),
    ).toBe(0);
  });

  test("interpretAll falls back to empty entry source when entry is missing", () => {
    expect(
      interpretAll("main", {
        lib: "out fn get() => { return 4; }",
      }),
    ).toBe(0);
  });
  test("interpretAll with jsModules routes calls through extern fn wrapper => 4", () => {
    expect(
      interpretAll(
        "main",
        {
          main: "{ extern wrapper } = extern fooJS; extern fn wrapper(); wrapper()",
          lib: "out fn get() => { return 4; }",
        },
        {
          fooJS:
            'import { get } from "./lib"; export function wrapper() { return get(); }',
        },
      ),
    ).toBe(4);
  });

  test("interpretAll skips empty jsModules entries", () => {
    expect(interpretAll("main", { main: "0" }, { emptyMod: "   " })).toBe(0);
  });

  test("interpretAll jsModules second module imports from first", () => {
    expect(
      interpretAll(
        "main",
        {
          main: "{ extern getValue } = extern modB; extern fn getValue(); getValue()",
        },
        {
          modA: "export function base() { return 7; }",
          modB: 'import { base } from "./modA"; export function getValue() { return base(); }',
        },
      ),
    ).toBe(7);
  });

  test("interpretAll jsModules import without leading dot-slash resolves module", () => {
    expect(
      interpretAll(
        "main",
        {
          main: "{ extern getValue } = extern helper; extern fn getValue(); getValue()",
        },
        {
          helper: "export function getValue() { return 9; }",
        },
      ),
    ).toBe(9);
  });

  test("interpretAll jsModules import with bare module name (no dot-slash)", () => {
    expect(
      interpretAll(
        "main",
        {
          main: "{ extern getValue } = extern modB; extern fn getValue(); getValue()",
        },
        {
          modA: "export function base() { return 11; }",
          modB: 'import { base } from "modA"; export function getValue() { return base(); }',
        },
      ),
    ).toBe(11);
  });

  test("interpretAll jsModules side-effect import without from clause still evaluates exports", () => {
    expect(
      interpretAll(
        "main",
        {
          main: "{ extern getValue } = extern helper; extern fn getValue(); getValue()",
        },
        {
          helper:
            'import "side-effect"; export function getValue() { return 13; }',
        },
      ),
    ).toBe(13);
  });
});

test('"fn add(this, b) => { return this + b; } 3.add(4)" => 7', () => {
  expect(interpret("fn add(this, b) => { return this + b; } 3.add(4)")).toBe(7);
});

test('"fn get(this) => { return this.x; } { x : 100 }.get()" => 100', () => {
  expect(
    interpret("fn get(this) => { return this.x; } { x : 100 }.get()"),
  ).toBe(100);
});
