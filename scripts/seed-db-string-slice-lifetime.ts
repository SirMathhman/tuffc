// @ts-nocheck
import { seedCategory } from "./seed-db-utils.ts";

const SCRIPT_LABEL = "seed-db-string-slice-lifetime";
const category = "migrated:string-slice-lifetime";

const CASES = [
  {
    key: "lifetime-extern-str-slice-window",
    source: [
      "extern let { str_length, str_slice_window } = globalThis;",
      "extern fn str_length(this: *Str) : USize;",
      "type StrIndex(this: *Str) = USize < str_length(this);",
      "lifetime t {",
      "  extern fn str_slice_window(this: *t Str, start: StrIndex(this) <= end, end: StrIndex(this)) : *t Str;",
      "}",
      "fn main() : I32 => {",
      '  let s = "hello";',
      "  let p = s.str_slice_window(1, 3);",
      "  p.str_length()",
      "}",
      "",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
  {
    key: "explicit-str-copy-after-window",
    source: [
      "extern let { str_length, str_slice_window, str_copy } = globalThis;",
      "extern fn str_length(this: *Str) : USize;",
      "type StrIndex(this: *Str) = USize < str_length(this);",
      "lifetime t {",
      "  extern fn str_slice_window(this: *t Str, start: StrIndex(this) <= end, end: StrIndex(this)) : *t Str;",
      "}",
      "extern fn str_copy(this: *Str) : *Str;",
      "fn main() : I32 => {",
      '  let s = "abcdef";',
      "  let owned = s.str_slice_window(1, 4).str_copy();",
      "  owned.str_length()",
      "}",
      "",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
  {
    key: "legacy-str-slice-still-compiles",
    source: [
      "extern let { str_length, str_slice } = globalThis;",
      "extern fn str_length(this: *Str) : USize;",
      "type StrIndex(this: *Str) = USize < str_length(this);",
      "extern fn str_slice(this: *Str, start: StrIndex(this) <= end, end: StrIndex(this)) : *Str;",
      "fn main() : I32 => {",
      '  let s = "legacy";',
      "  let x = s.str_slice(0, 3);",
      "  x.str_length()",
      "}",
      "",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
];

seedCategory(SCRIPT_LABEL, category, CASES);
