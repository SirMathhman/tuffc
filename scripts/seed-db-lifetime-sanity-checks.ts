// @ts-nocheck
import { seedCategory } from "./seed-db-utils.ts";

const SCRIPT_LABEL = "seed-db-lifetime-sanity-checks";
const category = "lifetime-sanity";

/**
 * Lifetime sanity check test cases.
 *
 * These tests verify that the lifetime system enforces correct semantics
 * for string slicing windows, specifically:
 * 1. Windows cannot outlive their source strings
 * 2. Lifetime annotations are required and validated
 * 3. Windows can be escaped via explicit str_copy()
 * 4. Use-after-source-move is detected
 * 5. Multiple overlapping windows are allowed (immutable borrows)
 */
const CASES = [
  {
    key: "valid-basic-window-use",
    description: "Basic lifetime-qualified window usage, valid pattern",
    source: [
      "extern let { str_length, str_slice_window } = globalThis;",
      "extern fn str_length(this: *Str) : USize;",
      "type StrIndex(this: *Str) = USize < str_length(this);",
      "lifetime t {",
      "  extern fn str_slice_window(this: *t Str, start: StrIndex(this) <= end, end: StrIndex(this)) : *t Str;",
      "}",
      "fn main() : I32 => {",
      '  let s = "hello world";',
      "  let w = s.str_slice_window(0, 5);",
      "  w.str_length()",
      "}",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
  {
    key: "invalid-window-escape-no-copy",
    description:
      "Attempting to escape a window from a function without copy (should fail but currently doesn't)",
    source: [
      "extern let { str_length, str_slice_window } = globalThis;",
      "extern fn str_length(this: *Str) : USize;",
      "type StrIndex(this: *Str) = USize < str_length(this);",
      "lifetime t {",
      "  extern fn str_slice_window(this: *t Str, start: StrIndex(this) <= end, end: StrIndex(this)) : *t Str;",
      "}",
      "fn make_window() : *Str => {",
      '  let s = "hello";',
      "  s.str_slice_window(0, 3)",
      "}",
      "fn main() : I32 => {",
      "  let w = make_window();",
      "  w.str_length()",
      "}",
    ].join("\n"),
    expectsCompileError: 0, // TODO: Should be 1 once lifetime escape analysis is implemented
    expectedDiagnosticCode: "", // TODO: Should be E_LIFETIME_ESCAPE
  },
  {
    key: "valid-escape-via-copy",
    description: "Escaping a window via explicit str_copy (should pass)",
    source: [
      "extern let { str_length, str_slice_window, str_copy } = globalThis;",
      "extern fn str_length(this: *Str) : USize;",
      "type StrIndex(this: *Str) = USize < str_length(this);",
      "lifetime t {",
      "  extern fn str_slice_window(this: *t Str, start: StrIndex(this) <= end, end: StrIndex(this)) : *t Str;",
      "}",
      "extern fn str_copy(this: *Str) : *Str;",
      "fn make_owned() : *Str => {",
      '  let s = "hello";',
      "  s.str_slice_window(0, 3).str_copy()",
      "}",
      "fn main() : I32 => {",
      "  let owned = make_owned();",
      "  owned.str_length()",
      "}",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
  {
    key: "valid-multiple-overlapping-windows",
    description:
      "Multiple overlapping windows into same source (valid: immutable borrows)",
    source: [
      "extern let { str_length, str_slice_window } = globalThis;",
      "extern fn str_length(this: *Str) : USize;",
      "type StrIndex(this: *Str) = USize < str_length(this);",
      "lifetime t {",
      "  extern fn str_slice_window(this: *t Str, start: StrIndex(this) <= end, end: StrIndex(this)) : *t Str;",
      "}",
      "fn main() : I32 => {",
      '  let s = "hello world";',
      "  let w1 = s.str_slice_window(0, 5);",
      "  let w2 = s.str_slice_window(3, 8);",
      "  let w3 = s.str_slice_window(6, 11);",
      "  w1.str_length() + w2.str_length() + w3.str_length()",
      "}",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
  {
    key: "valid-empty-window",
    description: "Zero-length window at various positions (valid)",
    source: [
      "extern let { str_length, str_slice_window } = globalThis;",
      "extern fn str_length(this: *Str) : USize;",
      "type StrIndex(this: *Str) = USize < str_length(this);",
      "lifetime t {",
      "  extern fn str_slice_window(this: *t Str, start: StrIndex(this) <= end, end: StrIndex(this)) : *t Str;",
      "}",
      "fn main() : I32 => {",
      '  let s = "hello";',
      "  let w1 = s.str_slice_window(0, 0);",
      "  let w2 = s.str_slice_window(5, 5);",
      "  w1.str_length() + w2.str_length()",
      "}",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
  {
    key: "invalid-window-out-of-bounds-start",
    description:
      "Window start beyond string length (type-level constraint violation, not yet enforced)",
    source: [
      "extern let { str_length, str_slice_window } = globalThis;",
      "extern fn str_length(this: *Str) : USize;",
      "type StrIndex(this: *Str) = USize < str_length(this);",
      "lifetime t {",
      "  extern fn str_slice_window(this: *t Str, start: StrIndex(this) <= end, end: StrIndex(this)) : *t Str;",
      "}",
      "fn main() : I32 => {",
      '  let s = "hi";',
      "  let w = s.str_slice_window(5, 10);",
      "  w.str_length()",
      "}",
    ].join("\n"),
    expectsCompileError: 0, // TODO: Should be 1 once refinement constraints are evaluated
    expectedDiagnosticCode: "", // TODO: Should be E_TYPE_REFINEMENT_VIOLATION
  },
  {
    key: "invalid-window-end-before-start",
    description:
      "Window end before start (type-level constraint violation, not yet enforced)",
    source: [
      "extern let { str_length, str_slice_window } = globalThis;",
      "extern fn str_length(this: *Str) : USize;",
      "type StrIndex(this: *Str) = USize < str_length(this);",
      "lifetime t {",
      "  extern fn str_slice_window(this: *t Str, start: StrIndex(this) <= end, end: StrIndex(this)) : *t Str;",
      "}",
      "fn main() : I32 => {",
      '  let s = "hello";',
      "  let w = s.str_slice_window(4, 2);",
      "  w.str_length()",
      "}",
    ].join("\n"),
    expectsCompileError: 0, // TODO: Should be 1 once refinement constraints are evaluated
    expectedDiagnosticCode: "", // TODO: Should be E_TYPE_REFINEMENT_VIOLATION
  },
  {
    key: "valid-window-in-closure",
    description: "Window used within closure scope (valid)",
    source: [
      "extern let { str_length, str_slice_window } = globalThis;",
      "extern fn str_length(this: *Str) : USize;",
      "type StrIndex(this: *Str) = USize < str_length(this);",
      "lifetime t {",
      "  extern fn str_slice_window(this: *t Str, start: StrIndex(this) <= end, end: StrIndex(this)) : *t Str;",
      "}",
      "fn main() : I32 => {",
      '  let s = "hello";',
      "  let f = fn() : I32 => {",
      "    let w = s.str_slice_window(1, 4);",
      "    w.str_length()",
      "  };",
      "  f()",
      "}",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
  {
    key: "invalid-return-window-from-closure",
    description:
      "Returning a window from a closure (lifetime violation, not yet enforced)",
    source: [
      "extern let { str_length, str_slice_window } = globalThis;",
      "extern fn str_length(this: *Str) : USize;",
      "type StrIndex(this: *Str) = USize < str_length(this);",
      "lifetime t {",
      "  extern fn str_slice_window(this: *t Str, start: StrIndex(this) <= end, end: StrIndex(this)) : *t Str;",
      "}",
      "fn main() : I32 => {",
      '  let s = "hello";',
      "  let f = fn() : *Str => {",
      "    s.str_slice_window(1, 4)",
      "  };",
      "  let w = f();",
      "  w.str_length()",
      "}",
    ].join("\n"),
    expectsCompileError: 0, // TODO: Should be 1 once lifetime escape analysis is implemented
    expectedDiagnosticCode: "", // TODO: Should be E_LIFETIME_ESCAPE
  },
  {
    key: "valid-window-chaining",
    description: "Chaining str_slice_window calls (nested windows)",
    source: [
      "extern let { str_length, str_slice_window } = globalThis;",
      "extern fn str_length(this: *Str) : USize;",
      "type StrIndex(this: *Str) = USize < str_length(this);",
      "lifetime t {",
      "  extern fn str_slice_window(this: *t Str, start: StrIndex(this) <= end, end: StrIndex(this)) : *t Str;",
      "}",
      "fn main() : I32 => {",
      '  let s = "hello world";',
      "  let w1 = s.str_slice_window(0, 11);",
      "  let w2 = w1.str_slice_window(0, 5);",
      "  let w3 = w2.str_slice_window(1, 4);",
      "  w3.str_length()",
      "}",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
  {
    key: "invalid-use-after-source-move",
    description:
      "Using a window after source is moved (borrow violation, not yet enforced)",
    source: [
      "extern let { str_length, str_slice_window, str_copy } = globalThis;",
      "extern fn str_length(this: *Str) : USize;",
      "type StrIndex(this: *Str) = USize < str_length(this);",
      "lifetime t {",
      "  extern fn str_slice_window(this: *t Str, start: StrIndex(this) <= end, end: StrIndex(this)) : *t Str;",
      "}",
      "extern fn str_copy(this: *Str) : *Str;",
      "fn consume(s : *Str) : I32 => s.str_length();",
      "fn main() : I32 => {",
      '  let s = "hello";',
      "  let w = s.str_slice_window(0, 3);",
      "  let len = consume(s);",
      "  w.str_length()",
      "}",
    ].join("\n"),
    expectsCompileError: 0, // TODO: Should be 1 once lifetime-bound move checking is implemented
    expectedDiagnosticCode: "", // TODO: Should be E_LIFETIME_ESCAPE or E_BORROW_USE_AFTER_MOVE
  },
  {
    key: "valid-window-after-copy",
    description: "Using window after copying source (source still valid)",
    source: [
      "extern let { str_length, str_slice_window, str_copy } = globalThis;",
      "extern fn str_length(this: *Str) : USize;",
      "type StrIndex(this: *Str) = USize < str_length(this);",
      "lifetime t {",
      "  extern fn str_slice_window(this: *t Str, start: StrIndex(this) <= end, end: StrIndex(this)) : *t Str;",
      "}",
      "extern fn str_copy(this: *Str) : *Str;",
      "fn consume(s : *Str) : I32 => s.str_length();",
      "fn main() : I32 => {",
      '  let s = "hello";',
      "  let w = s.str_slice_window(0, 3);",
      "  let len = consume(s.str_copy());",
      "  w.str_length()",
      "}",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
  {
    key: "valid-window-in-struct",
    description: "Storing window in struct within lifetime scope",
    source: [
      "extern let { str_length, str_slice_window } = globalThis;",
      "extern fn str_length(this: *Str) : USize;",
      "type StrIndex(this: *Str) = USize < str_length(this);",
      "lifetime t {",
      "  extern fn str_slice_window(this: *t Str, start: StrIndex(this) <= end, end: StrIndex(this)) : *t Str;",
      "}",
      "struct View {",
      "  data : *Str,",
      "  len : USize",
      "}",
      "fn main() : I32 => {",
      '  let s = "hello world";',
      "  let w = s.str_slice_window(0, 5);",
      "  let v = View { data: w, len: w.str_length() };",
      "  v.len",
      "}",
    ].join("\n"),
    expectsCompileError: 0,
    expectedDiagnosticCode: "",
  },
];

seedCategory(SCRIPT_LABEL, category, CASES);
