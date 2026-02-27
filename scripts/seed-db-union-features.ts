// @ts-nocheck
import { seedCategory } from "./seed-db-utils.ts";

const SCRIPT_LABEL = "seed-db-union-features";
const category = "migrated:union-features";

const CASES = [
  {
    key: "union-inline-struct-basic",
    source: [
      "type MyUnion = struct Variant1 { field: I32; } | struct Variant2 { field: *Str; };",
      "let a : MyUnion = Variant1 { field: 42 };",
      'let b : MyUnion = Variant2 { field: "hello" };',
      "",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
  {
    key: "union-match-exhaustive",
    source: [
      "type MyUnion = struct Variant1 { field: I32; } | struct Variant2 { field: I32; };",
      "fn f(x: MyUnion) : I32 => {",
      "  match (x) {",
      "    case struct Variant1 { field } = field;",
      "    case struct Variant2 { field } = field;",
      "  }",
      "}",
      "",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
  {
    key: "union-match-single-variant",
    source: [
      "type MyUnion = struct Variant1 { field: I32; } | struct Variant2 { field: I32; };",
      "fn f(x: MyUnion) : I32 => {",
      "  match (x) {",
      "    case struct Variant1 { field } = field;",
      "  }",
      "}",
      "",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
  {
    key: "union-is-operator-narrowing",
    source: [
      "type MyUnion = struct Variant1 { field: I32; } | struct Variant2 { field: I32; };",
      "fn f(x: MyUnion) : I32 => {",
      "  if (x is struct Variant1) {",
      "    x.field",
      "  } else {",
      "    x.field",
      "  }",
      "}",
      "",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
  {
    key: "result-inline-union-and-unwrap",
    source: [
      "type Result<T, E> = struct Ok { value: T; } | struct Err { error: E; };",
      "fn get(x: I32) : Result<I32, *Str> => {",
      "  if (x > 0) {",
      "    Ok<I32> { value: x }",
      "  } else {",
      '    Err<*Str> { error: "bad" }',
      "  }",
      "}",
      "fn main() : I32 => {",
      "  let r = get(1);",
      "  if (r is struct Ok) {",
      "    r.value",
      "  } else {",
      "    0",
      "  }",
      "}",
      "",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
];


seedCategory(SCRIPT_LABEL, category, CASES);
