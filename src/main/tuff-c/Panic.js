"use strict";

// extern from stdio

// extern from stdlib

// extern fn printf

// extern fn abort

const __tuff_outer_for_panic = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function panic(msg) {
  let __tuff_this = { msg: msg, this: __tuff_outer_for_panic };
  printf("%s\n", msg);
  abort();
  return 0;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.panic = panic;

const __tuff_outer_for_panic_with_code = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function panic_with_code(code, msg, reason, fix) {
  let __tuff_this = { code: code, msg: msg, reason: reason, fix: fix, this: __tuff_outer_for_panic_with_code };
  printf("panic code: %s\n", code);
  printf("message: %s\n", msg);
  printf("reason: %s\n", reason);
  printf("fix: %s\n", fix);
  abort();
  return 0;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.panic_with_code = panic_with_code;

