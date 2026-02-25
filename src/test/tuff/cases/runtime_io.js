"use strict";

// extern from io

// extern from strings

// extern fn path_join

// extern fn path_dirname

// extern fn write_file

// extern fn read_file

// extern fn str_eq

const __tuff_outer_for_main = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function main() {
  let __tuff_this = { this: __tuff_outer_for_main };
  let path = (() => { const __recv = "tests/out/c"; const __prop = __recv?.["path_join"]; if (typeof __prop === "function") return __prop("runtime_io.txt"); const __dyn = __recv?.table?.path_join; return __dyn ? __dyn(__recv.ref, "runtime_io.txt") : path_join(__recv, "runtime_io.txt"); })(); if (typeof __tuff_this !== 'undefined') __tuff_this.path = path;
  let dir = (() => { const __recv = path; const __prop = __recv?.["path_dirname"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.path_dirname; return __dyn ? __dyn(__recv.ref) : path_dirname(__recv); })(); if (typeof __tuff_this !== 'undefined') __tuff_this.dir = dir;
  let code = write_file(path, "ok"); if (typeof __tuff_this !== 'undefined') __tuff_this.code = code;
  let readBack = read_file(path); if (typeof __tuff_this !== 'undefined') __tuff_this.readBack = readBack;
  if ((((code === 0) && (() => { const __recv = readBack; const __prop = __recv?.["str_eq"]; if (typeof __prop === "function") return __prop("ok"); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "ok") : str_eq(__recv, "ok"); })()) && (() => { const __recv = dir; const __prop = __recv?.["str_eq"]; if (typeof __prop === "function") return __prop("tests/out/c"); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "tests/out/c") : str_eq(__recv, "tests/out/c"); })())) {
  return 0;
}
  return 17;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.main = main;

