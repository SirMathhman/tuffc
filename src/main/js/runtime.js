/**
 * Runtime support for the self-hosted Tuff compiler.
 * Exports functions that are declared as `extern` in Tuff source.
 */
import fs from "node:fs";
import path from "node:path";
import { TuffError } from "./errors.js";

// === String operations ===
export function str_length(s) {
  return s.length;
}

export function str_char_at(s, i) {
  return s.charCodeAt(i);
}

export function str_char(s, i) {
  return s.charAt(i);
}

export function str_slice(s, start, end) {
  return s.slice(start, end);
}

export function str_concat(a, b) {
  return a + b;
}

export function str_eq(a, b) {
  return a === b;
}

export function str_from_char_code(code) {
  return String.fromCharCode(code);
}

export function str_index_of(s, needle) {
  return s.indexOf(needle);
}

export function str_includes(s, needle) {
  return s.includes(needle);
}

export function str_starts_with(s, prefix) {
  return s.startsWith(prefix);
}

export function str_trim(s) {
  return s.trim();
}

export function str_replace_all(s, from, to) {
  return s.replaceAll(from, to);
}

export function char_code(ch) {
  return ch.charCodeAt(0);
}

export function int_to_string(n) {
  return String(n);
}

export function parse_int(s) {
  return parseInt(s, 10);
}

export function parse_float(s) {
  return parseFloat(s);
}

// === StringBuilder (mutable string building) ===
export function sb_new() {
  return { parts: [] };
}

export function sb_append(sb, s) {
  sb.parts.push(s);
}

export function sb_append_char(sb, code) {
  sb.parts.push(String.fromCharCode(code));
}

export function sb_build(sb) {
  return sb.parts.join("");
}

export function sb_length(sb) {
  return sb.parts.reduce((acc, s) => acc + s.length, 0);
}

// === Array/Vec operations ===
export function vec_new() {
  return [];
}

export function vec_push(arr, item) {
  arr.push(item);
}

export function vec_pop(arr) {
  return arr.pop();
}

export function vec_get(arr, i) {
  return arr[i];
}

export function vec_set(arr, i, v) {
  arr[i] = v;
}

export function vec_length(arr) {
  return arr.length;
}

export function vec_clear(arr) {
  arr.length = 0;
}

export function vec_slice(arr, start, end) {
  return arr.slice(start, end);
}

export function vec_join(arr, sep) {
  return arr.join(sep);
}

export function vec_concat(a, b) {
  return a.concat(b);
}

export function vec_map(arr, fn) {
  return arr.map(fn);
}

export function vec_filter(arr, fn) {
  return arr.filter(fn);
}

export function vec_find(arr, fn) {
  return arr.find(fn);
}

export function vec_some(arr, fn) {
  return arr.some(fn);
}

export function vec_includes(arr, item) {
  return arr.includes(item);
}

// === Map operations ===
export function map_new() {
  return new Map();
}

export function map_set(m, k, v) {
  m.set(k, v);
}

export function map_get(m, k) {
  return m.get(k);
}

export function map_has(m, k) {
  return m.has(k);
}

export function map_delete(m, k) {
  return m.delete(k);
}

export function map_size(m) {
  return m.size;
}

export function map_keys(m) {
  return [...m.keys()];
}

export function map_values(m) {
  return [...m.values()];
}

// === Set operations ===
export function set_new() {
  return new Set();
}

export function set_add(s, item) {
  s.add(item);
}

export function set_has(s, item) {
  return s.has(item);
}

export function set_delete(s, item) {
  return s.delete(item);
}

export function set_size(s) {
  return s.size;
}

// === I/O ===
export function read_file(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new TuffError(`Failed to read file: ${filePath}`, null, {
      code: "E_SELFHOST_PANIC",
      reason:
        "The self-hosted compiler could not load a required source file while resolving inputs/modules.",
      fix: "Verify the file path and module layout, then retry compilation.",
      details: error?.message,
    });
  }
}

export function write_file(filePath, contents) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents, "utf8");
    return 0;
  } catch (error) {
    throw new TuffError(`Failed to write file: ${filePath}`, null, {
      code: "E_SELFHOST_PANIC",
      reason:
        "The self-hosted compiler could not persist generated output to disk.",
      fix: "Verify output path permissions and directory accessibility, then retry.",
      details: error?.message,
    });
  }
}

export function file_exists(filePath) {
  return fs.existsSync(filePath);
}

export function path_join(a, b) {
  return path.join(a, b);
}

export function path_dirname(p) {
  return path.dirname(p);
}

export function path_resolve(p) {
  return path.resolve(p);
}

// === Console ===
export function print(s) {
  console.log(s);
}

export function print_error(s) {
  console.error(s);
}

// === Misc ===
export function panic(msg) {
  throw new TuffError(msg, null, {
    code: "E_SELFHOST_PANIC",
    reason:
      "The self-hosted compiler encountered an unrecoverable internal parse/compile condition.",
    fix: "Check the reported source construct and simplify or correct the syntax; if valid, add a targeted selfhost frontend test and patch the selfhost parser pipeline.",
  });
}

// === String Vector (for intern table) ===
export function str_vec_new() {
  return [];
}

export function str_vec_push(arr, s) {
  arr.push(s);
}

export function str_vec_get(arr, i) {
  return arr[i];
}

export function str_vec_length(arr) {
  return arr.length;
}

export function json_stringify(v) {
  return JSON.stringify(v);
}

export function is_undefined(v) {
  return v === undefined;
}

export function is_null(v) {
  return v === null;
}

export function typeof_value(v) {
  return typeof v;
}

// === Test helpers ===
export function assert(cond, msg) {
  if (!cond) throw new Error("Assertion failed: " + msg);
}

export function assert_eq(a, b, msg) {
  if (a !== b) throw new Error(`Assertion failed: ${msg} (${a} !== ${b})`);
}
