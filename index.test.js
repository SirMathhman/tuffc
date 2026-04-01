import { describe, expect, test } from "bun:test";
import { compile } from "./index.js";

function interpret(source) {
  return new Function(compile(source))();
}

function interpretWithGlobals(source, globals = {}) {
  const previousGlobals = new Map();

  for (const [name, value] of Object.entries(globals)) {
    previousGlobals.set(
      name,
      Object.prototype.hasOwnProperty.call(globalThis, name)
        ? { exists: true, value: globalThis[name] }
        : { exists: false },
    );
    globalThis[name] = value;
  }

  try {
    return new Function(compile(source))();
  } finally {
    for (const [name, previousValue] of previousGlobals) {
      if (previousValue.exists) {
        globalThis[name] = previousValue.value;
      } else {
        delete globalThis[name];
      }
    }
  }
}

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
      interpretWithGlobals("extern fn add(this, other); 3.add(4)", {
        add: (first, second) => {
          return first + second;
        },
      }),
    ).toBe(7);
  });

  test('"extern fn add(first, second); add(3, 4)" => 7', () => {
    expect(
      interpretWithGlobals("extern fn add(first, second); add(3, 4)", {
        add: (first, second) => {
          return first + second;
        },
      }),
    ).toBe(7);
  });

  test('"extern fn add(first, second); add(3, 4)" => 7 with existing globals', () => {
    expect(
      interpretWithGlobals("extern fn add(first, second); add(3, 4)", {
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
});

test('"fn add(this, b) => { return this + b; } 3.add(4)" => 7', () => {
  expect(interpret("fn add(this, b) => { return this + b; } 3.add(4)")).toBe(7);
});

test('"fn get(this) => { return this.x; } { x : 100 }.get()" => 100', () => {
  expect(
    interpret("fn get(this) => { return this.x; } { x : 100 }.get()"),
  ).toBe(100);
});
