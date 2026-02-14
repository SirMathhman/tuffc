/**
 * Runtime support for the self-hosted Tuff compiler.
 * Exports functions that are declared as `extern` in Tuff source.
 */
import fs from "node:fs";
import path from "node:path";
import { TuffError, raise } from "./errors.ts";

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
  return sb.parts.reduce((acc, s) => acc + s.length, 0);
}

// === Array/Vec operations ===
export function vec_new<T = unknown>(): T[] {
  return [];
}

export function vec_push<T>(arr: T[], item: T): T[] {
  arr.push(item);
  return arr;
}

export function vec_pop<T>(arr: T[]): T | undefined {
  return arr.pop();
}

export function vec_get<T>(arr: T[], i: number): T | undefined {
  return arr[i];
}

export function vec_set<T>(arr: T[], i: number, v: T): T[] {
  arr[i] = v;
  return arr;
}

export function vec_length<T>(arr: T[]): number {
  return arr.length;
}

export function vec_clear<T>(arr: T[]): T[] {
  arr.length = 0;
  return arr;
}

export function vec_slice<T>(arr: T[], start: number, end: number): T[] {
  return arr.slice(start, end);
}

export function vec_join(arr: string[], sep: string): string {
  return arr.join(sep);
}

export function vec_concat<T>(a: T[], b: T[]): T[] {
  return a.concat(b);
}

export function vec_map<T, U>(arr: T[], fn: (item: T) => U): U[] {
  return arr.map(fn);
}

export function vec_filter<T>(arr: T[], fn: (item: T) => boolean): T[] {
  return arr.filter(fn);
}

export function vec_find<T>(arr: T[], fn: (item: T) => boolean): T | undefined {
  return arr.find(fn);
}

export function vec_some<T>(arr: T[], fn: (item: T) => boolean): boolean {
  return arr.some(fn);
}

export function vec_includes<T>(arr: T[], item: T): boolean {
  return arr.includes(item);
}

// === Map operations ===
export function map_new<K = unknown, V = unknown>(): Map<K, V> {
  return new Map<K, V>();
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
    return raise(
      new TuffError(`Failed to read file: ${filePath}`, null, {
        code: "E_SELFHOST_PANIC",
        reason:
          "The self-hosted compiler could not load a required source file while resolving inputs/modules.",
        fix: "Verify the file path and module layout, then retry compilation.",
        details: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export function write_file(filePath: string, contents: string): number {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents, "utf8");
    return 0;
  } catch (error: unknown) {
    return raise(
      new TuffError(`Failed to write file: ${filePath}`, null, {
        code: "E_SELFHOST_PANIC",
        reason:
          "The self-hosted compiler could not persist generated output to disk.",
        fix: "Verify output path permissions and directory accessibility, then retry.",
        details: error instanceof Error ? error.message : String(error),
      }),
    );
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
export function panic(msg: string): never {
  return raise(
    new TuffError(msg, null, {
      code: "E_SELFHOST_PANIC",
      reason:
        "The self-hosted compiler encountered an unrecoverable internal parse/compile condition.",
      fix: "Check the reported source construct and simplify or correct the syntax; if valid, add a targeted selfhost frontend test and patch the selfhost parser pipeline.",
    }),
  );
}

export function panic_with_code(
  code: string | null,
  msg: string,
  reason: string | null,
  fix: string | null,
): never {
  return raise(
    new TuffError(msg, null, {
      code: code ?? "E_SELFHOST_PANIC",
      reason:
        reason ??
        "The self-hosted compiler encountered an unrecoverable internal parse/compile condition.",
      fix:
        fix ??
        "Check the reported source construct and simplify or correct the syntax; if valid, add a targeted selfhost frontend test and patch the selfhost parser pipeline.",
    }),
  );
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

export function is_null(v: unknown): boolean {
  return v === null;
}

export function typeof_value(v: unknown): string {
  return typeof v;
}

// === Test helpers ===
export function assert(cond: boolean, msg: string): void {
  if (!cond) return raise(new Error("Assertion failed: " + msg));
}

export function assert_eq(a: unknown, b: unknown, msg: string): void {
  if (a !== b)
    return raise(new Error(`Assertion failed: ${msg} (${a} !== ${b})`));
}
