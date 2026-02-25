"use strict";

// extern from stdlib

// extern fn abort

const __tuff_outer_for_tuff_runtime_panic = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function tuff_runtime_panic(msg) {
  let __tuff_this = { msg: msg, this: __tuff_outer_for_tuff_runtime_panic };
  abort();
  return 0;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.tuff_runtime_panic = tuff_runtime_panic;

const __tuff_outer_for_tuff_runtime_panic_with_code = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function tuff_runtime_panic_with_code(code, msg, reason, fix) {
  let __tuff_this = { code: code, msg: msg, reason: reason, fix: fix, this: __tuff_outer_for_tuff_runtime_panic_with_code };
  abort();
  return 0;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.tuff_runtime_panic_with_code = tuff_runtime_panic_with_code;

