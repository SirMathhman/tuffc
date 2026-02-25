"use strict";

const __tuff_outer_for_add = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function add(a, b) {
  let __tuff_this = { a: a, b: b, this: __tuff_outer_for_add };
  return (a + b);
}
if (typeof __tuff_this !== 'undefined') __tuff_this.add = add;

const __tuff_outer_for_call_nested = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function call_nested() {
  let __tuff_this = { this: __tuff_outer_for_call_nested };
  return add(20, 22);
}
if (typeof __tuff_this !== 'undefined') __tuff_this.call_nested = call_nested;

const __tuff_outer_for_main = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function main() {
  let __tuff_this = { this: __tuff_outer_for_main };
  return call_nested();
}
if (typeof __tuff_this !== 'undefined') __tuff_this.main = main;

