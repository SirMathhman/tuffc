"use strict";

// extern from stdio

// extern from stdlib

// extern from string

// extern fn printf

// extern fn fopen

// extern fn fclose

// extern fn fwrite

// extern fn malloc

// extern fn free

// extern fn strlen

// extern fn strcpy

// extern fn strcat

const __tuff_outer_for_read_file = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function read_file(path) {
  let __tuff_this = { path: path, this: __tuff_outer_for_read_file };
  return "";
}
if (typeof __tuff_this !== 'undefined') __tuff_this.read_file = read_file;

const __tuff_outer_for_write_file = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function write_file(path, contents) {
  let __tuff_this = { path: path, contents: contents, this: __tuff_outer_for_write_file };
  let file = fopen(path, "wb"); if (typeof __tuff_this !== 'undefined') __tuff_this.file = file;
  if ((file === 0)) {
}
  let len = strlen(contents); if (typeof __tuff_this !== 'undefined') __tuff_this.len = len;
  fwrite(contents, 1, len, file);
  return fclose(file);
}
if (typeof __tuff_this !== 'undefined') __tuff_this.write_file = write_file;

const __tuff_outer_for_path_join = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function path_join(a, b) {
  let __tuff_this = { a: a, b: b, this: __tuff_outer_for_path_join };
  let alen = strlen(a); if (typeof __tuff_this !== 'undefined') __tuff_this.alen = alen;
  let blen = strlen(b); if (typeof __tuff_this !== 'undefined') __tuff_this.blen = blen;
  let cap = ((alen + blen) + 2); if (typeof __tuff_this !== 'undefined') __tuff_this.cap = cap;
  let out_ptr = malloc(cap); if (typeof __tuff_this !== 'undefined') __tuff_this.out_ptr = out_ptr;
  if ((out_ptr === 0)) {
}
  strcpy(out_ptr, a);
  if ((alen > 0)) {
  strcat(out_ptr, "/");
}
  strcat(out_ptr, b);
  return out_ptr;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.path_join = path_join;

const __tuff_outer_for_path_dirname = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function path_dirname(p) {
  let __tuff_this = { p: p, this: __tuff_outer_for_path_dirname };
  return p;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.path_dirname = path_dirname;

const __tuff_outer_for_print = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function print(s) {
  let __tuff_this = { s: s, this: __tuff_outer_for_print };
  return printf("%s\n", s);
}
if (typeof __tuff_this !== 'undefined') __tuff_this.print = print;

const __tuff_outer_for_print_error = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function print_error(s) {
  let __tuff_this = { s: s, this: __tuff_outer_for_print_error };
  return printf("[error] %s\n", s);
}
if (typeof __tuff_this !== 'undefined') __tuff_this.print_error = print_error;

