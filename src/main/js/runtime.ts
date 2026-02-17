/**
 * Runtime support for the self-hosted Tuff compiler.
 * Exports functions that are declared as `extern` in Tuff source.
 */
import fs from "node:fs";
import path from "node:path";
import { TuffError } from "./errors.ts";

type StringBuilder = { parts: string[] };

// === String operations ===
export function str_length(s: string): number {
  return s.length;
}

export function str_char_at(s: string, i: number): number {
  return s.charCodeAt(i);
}

export function str_char(s: string, i: number): string {
  return s.charAt(i);
}

export function str_slice(s: string, start: number, end: number): string {
  return s.slice(start, end);
}

export function str_concat(a: string, b: string): string {
  return a + b;
}

export function str_eq(a: string, b: string): boolean {
  return a === b;
}

export function str_from_char_code(code: number): string {
  return String.fromCharCode(code);
}

export function str_index_of(s: string, needle: string): number {
  return s.indexOf(needle);
}

export function str_includes(s: string, needle: string): boolean {
  return s.includes(needle);
}

export function str_starts_with(s: string, prefix: string): boolean {
  return s.startsWith(prefix);
}

export function str_trim(s: string): string {
  return s.trim();
}

export function str_replace_all(s: string, from: string, to: string): string {
  return s.replaceAll(from, to);
}

export function char_code(ch: string): number {
  return ch.charCodeAt(0);
}

export function int_to_string(n: number): string {
  return String(n);
}

export function parse_int(s: string): number {
  return parseInt(s, 10);
}

export function parse_float(s: string): number {
  return parseFloat(s);
}

// === StringBuilder (mutable string building) ===
export function sb_new(): StringBuilder {
  return { parts: [] };
}

export function sb_append(sb: StringBuilder, s: string): StringBuilder {
  sb.parts.push(s);
  return sb;
}

export function sb_append_char(sb: StringBuilder, code: number): StringBuilder {
  sb.parts.push(String.fromCharCode(code));
  return sb;
}

export function sb_build(sb: StringBuilder): string {
  return sb.parts.join("");
}

export function sb_length(sb: StringBuilder): number {
  return sb.parts.reduce((acc: number, s: string) => acc + s.length, 0);
}

// === Array/Vec operations ===
type VecState<T = unknown> = {
  data: (T | undefined)[];
  init: number;
  length: number;
};

function isVecState<T>(value: unknown): value is VecState<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as VecState<T>).data) &&
    typeof (value as VecState<T>).init === "number" &&
    typeof (value as VecState<T>).length === "number"
  );
}

function asVecState<T>(value: VecState<T> | T[]): VecState<T> {
  if (isVecState<T>(value)) return value;
  return {
    data: value as T[],
    init: (value as T[]).length,
    length: (value as T[]).length,
  };
}

function vecEnsureCapacity<T>(vec: VecState<T>, need: number): void {
  if (need <= vec.length) return;
  let next = vec.length === 0 ? 4 : vec.length;
  while (next < need) next *= 2;
  vec.length = next;
  vec.data.length = next;
}

export function vec_new<T = unknown>(capacity = 0): VecState<T> {
  const safeCap =
    Number.isFinite(capacity) && capacity > 0 ? Math.floor(capacity) : 0;
  return {
    data: new Array<T | undefined>(safeCap),
    init: 0,
    length: safeCap,
  };
}

export function vec_push<T>(input: VecState<T> | T[], item: T): VecState<T> {
  const vec = asVecState(input);
  vecEnsureCapacity(vec, vec.init + 1);
  vec.data[vec.init] = item;
  vec.init += 1;
  return vec;
}

export function vec_pop<T>(input: VecState<T> | T[]): T | undefined {
  const vec = asVecState(input);
  if (vec.init <= 0) return undefined;
  vec.init -= 1;
  const value = vec.data[vec.init];
  vec.data[vec.init] = undefined;
  return value as T | undefined;
}

export function vec_get<T>(input: VecState<T> | T[], i: number): T | undefined {
  const vec = asVecState(input);
  const idx = Math.floor(i);
  if (idx < 0 || idx >= vec.init) return undefined;
  return vec.data[idx] as T | undefined;
}

export function vec_set<T>(
  input: VecState<T> | T[],
  i: number,
  v: T,
): VecState<T> {
  const vec = asVecState(input);
  const idx = Math.floor(i);
  if (idx < 0) {
    throw new TuffError("vec_set index must be >= 0", undefined, {
      code: "E_RUNTIME_VEC_INDEX",
      hint: "Use 0 <= index <= vec_length(vec).",
    });
  }
  if (idx > vec.init) {
    throw new TuffError("vec_set index exceeds initialized size", undefined, {
      code: "E_RUNTIME_VEC_INDEX",
      hint: "vec_set permits index <= vec_length(vec).",
    });
  }
  vecEnsureCapacity(vec, idx + 1);
  vec.data[idx] = v;
  if (idx === vec.init) vec.init += 1;
  return vec;
}

// vec_length reports initialized element count (size)
export function vec_length<T>(input: VecState<T> | T[]): number {
  const vec = asVecState(input);
  return vec.init;
}

export function vec_init<T>(input: VecState<T> | T[]): number {
  const vec = asVecState(input);
  return vec.init;
}

export function vec_capacity<T>(input: VecState<T> | T[]): number {
  const vec = asVecState(input);
  return vec.length;
}

export function vec_clear<T>(input: VecState<T> | T[]): VecState<T> {
  const vec = asVecState(input);
  for (let i = 0; i < vec.init; i += 1) vec.data[i] = undefined;
  vec.init = 0;
  return vec;
}

export function vec_slice<T>(
  input: VecState<T> | T[],
  start: number,
  end: number,
): T[] {
  const vec = asVecState(input);
  const s = Math.max(0, Math.floor(start));
  const e = Math.min(vec.init, Math.floor(end));
  return vec.data.slice(s, e) as T[];
}

export function vec_join(
  input: VecState<string> | string[],
  sep: string,
): string {
  const vec = asVecState<string>(input);
  return (vec.data.slice(0, vec.init) as string[]).join(sep);
}

export function vec_concat<T>(
  aInput: VecState<T> | T[],
  bInput: VecState<T> | T[],
): VecState<T> {
  const a = asVecState(aInput);
  const b = asVecState(bInput);
  const out = vec_new<T>(a.init + b.init);
  for (let i = 0; i < a.init; i += 1) {
    vec_push(out, a.data[i] as T);
  }
  for (let i = 0; i < b.init; i += 1) {
    vec_push(out, b.data[i] as T);
  }
  return out;
}

export function vec_map<T, U>(
  input: VecState<T> | T[],
  fn: (item: T) => U,
): VecState<U> {
  const vec = asVecState(input);
  const out = vec_new<U>(vec.init);
  for (let i = 0; i < vec.init; i += 1) {
    vec_push(out, fn(vec.data[i] as T));
  }
  return out;
}

export function vec_filter<T>(
  input: VecState<T> | T[],
  fn: (item: T) => boolean,
): VecState<T> {
  const vec = asVecState(input);
  const out = vec_new<T>(vec.init);
  for (let i = 0; i < vec.init; i += 1) {
    const item = vec.data[i] as T;
    if (fn(item)) vec_push(out, item);
  }
  return out;
}

export function vec_find<T>(
  input: VecState<T> | T[],
  fn: (item: T) => boolean,
): T | undefined {
  const vec = asVecState(input);
  for (let i = 0; i < vec.init; i += 1) {
    const item = vec.data[i] as T;
    if (fn(item)) return item;
  }
  return undefined;
}

export function vec_some<T>(
  input: VecState<T> | T[],
  fn: (item: T) => boolean,
): boolean {
  return vec_find(input, fn) !== undefined;
}

export function vec_includes<T>(input: VecState<T> | T[], item: T): boolean {
  const vec = asVecState(input);
  for (let i = 0; i < vec.init; i += 1) {
    if (vec.data[i] === item) return true;
  }
  return false;
}

export function __vec_new<T = unknown>(): VecState<T> {
  return vec_new<T>();
}

// === Map operations ===
export function map_new<K = unknown, V = unknown>(): Map<K, V> {
  return new Map<K, V>();
}

export function __map_new<K = unknown, V = unknown>(): Map<K, V> {
  return map_new<K, V>();
}

export function map_set<K, V>(m: Map<K, V>, k: K, v: V): Map<K, V> {
  m.set(k, v);
  return m;
}

export function map_get<K, V>(m: Map<K, V>, k: K): V | undefined {
  return m.get(k);
}

export function map_has<K, V>(m: Map<K, V>, k: K): boolean {
  return m.has(k);
}

export function map_delete<K, V>(m: Map<K, V>, k: K): boolean {
  return m.delete(k);
}

export function map_size<K, V>(m: Map<K, V>): number {
  return m.size;
}

export function map_keys<K, V>(m: Map<K, V>): K[] {
  return [...m.keys()];
}

export function map_values<K, V>(m: Map<K, V>): V[] {
  return [...m.values()];
}

// === Set operations ===
export function set_new<T = unknown>(): Set<T> {
  return new Set<T>();
}

export function __set_new<T = unknown>(): Set<T> {
  return set_new<T>();
}

export function set_add<T>(s: Set<T>, item: T): Set<T> {
  s.add(item);
  return s;
}

export function set_has<T>(s: Set<T>, item: T): boolean {
  return s.has(item);
}

export function set_delete<T>(s: Set<T>, item: T): boolean {
  return s.delete(item);
}

export function set_size<T>(s: Set<T>): number {
  return s.size;
}

// === I/O ===
export function read_file(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error: unknown) {
    throw new TuffError(`Failed to read file: ${filePath}`, undefined, {
      code: "E_SELFHOST_IO_READ_FAILED",
      reason:
        "The self-hosted compiler could not load a required source file while resolving inputs/modules.",
      fix: "Verify the file path and module layout, then retry compilation.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export function write_file(filePath: string, contents: string): number {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents, "utf8");
    return 0;
  } catch (error: unknown) {
    throw new TuffError(`Failed to write file: ${filePath}`, undefined, {
      code: "E_SELFHOST_IO_WRITE_FAILED",
      reason:
        "The self-hosted compiler could not persist generated output to disk.",
      fix: "Verify output path permissions and directory accessibility, then retry.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export function file_exists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function path_join(a: string, b: string): string {
  return path.join(a, b);
}

export function path_dirname(p: string): string {
  return path.dirname(p);
}

export function path_resolve(p: string): string {
  return path.resolve(p);
}

// === Console ===
export function print(s: unknown): void {
  console.log(s);
}

export function print_error(s: unknown): void {
  console.error(s);
}

// === Misc ===
function inferSelfhostDiagnosticCode(msg: string): string {
  if (msg.startsWith("Expected ")) return "E_PARSE_EXPECTED_TOKEN";
  if (msg.includes("Unexpected token in expression")) {
    return "E_PARSE_UNEXPECTED_TOKEN";
  }
  if (msg.includes("type-level numeric sentinel")) {
    return "E_PARSE_INVALID_NUMERIC_TYPE_LITERAL";
  }
  if (msg.includes("Unterminated string")) return "E_LEX_UNTERMINATED_STRING";
  if (msg.includes("Unterminated char")) return "E_LEX_UNTERMINATED_CHAR";
  if (msg.includes("Unterminated block comment")) {
    return "E_LEX_UNTERMINATED_BLOCK_COMMENT";
  }
  if (msg.startsWith("Unexpected character:")) return "E_LEX_UNEXPECTED_CHAR";
  return "E_SELFHOST_INTERNAL_ERROR";
}

function inferSelfhostDiagnosticReason(code: string): string {
  if (code.startsWith("E_PARSE_")) {
    return "The self-hosted frontend rejected the input while parsing syntax.";
  }
  if (code.startsWith("E_LEX_")) {
    return "The self-hosted frontend rejected the input while lexing source text.";
  }
  return "The self-hosted compiler encountered an internal error outside normal user-facing diagnostics.";
}

function inferSelfhostDiagnosticFix(code: string): string {
  if (code.startsWith("E_PARSE_")) {
    return "Check nearby syntax and token boundaries; if source is valid, add a focused parser regression test and patch the selfhost parser.";
  }
  if (code.startsWith("E_LEX_")) {
    return "Check literals/operators near the reported location; if source is valid, add a lexer regression test and patch the selfhost lexer.";
  }
  return "Capture a minimal repro and patch the failing selfhost pass to emit a specific diagnostic code via panic_with_code.";
}

export function panic(msg: string): never {
  const code = inferSelfhostDiagnosticCode(msg);
  throw new TuffError(msg, undefined, {
    code,
    reason: inferSelfhostDiagnosticReason(code),
    fix: inferSelfhostDiagnosticFix(code),
  });
}

export function panic_with_code(
  code: string | undefined,
  msg: string,
  reason: string | undefined,
  fix: string | undefined,
): never {
  const resolvedCode =
    code && code.length > 0 ? code : inferSelfhostDiagnosticCode(msg);
  throw new TuffError(msg, undefined, {
    code: resolvedCode,
    reason: reason ?? inferSelfhostDiagnosticReason(resolvedCode),
    fix: fix ?? inferSelfhostDiagnosticFix(resolvedCode),
  });
}

// === String Vector (for intern table) ===
export function str_vec_new(): string[] {
  return [];
}

export function str_vec_push(arr: string[], s: string): string[] {
  arr.push(s);
  return arr;
}

export function str_vec_get(arr: string[], i: number): string | undefined {
  return arr[i];
}

export function str_vec_length(arr: string[]): number {
  return arr.length;
}

export function json_stringify(v: unknown): string {
  return JSON.stringify(v);
}

export function is_undefined(v: unknown): boolean {
  return v === undefined;
}

export function typeof_value(v: unknown): string {
  return typeof v;
}

// === Test helpers ===
export function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error("Assertion failed: " + msg);
}

export function assert_eq(a: unknown, b: unknown, msg: string): void {
  if (a !== b) throw new Error(`Assertion failed: ${msg} (${a} !== ${b})`);
}
