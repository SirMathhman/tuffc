"use strict";

const __tuff_outer_for_add = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function add(a, b) {
  let __tuff_this = { a: a, b: b, this: __tuff_outer_for_add };
  return (a + b);
}
if (typeof __tuff_this !== 'undefined') __tuff_this.add = add;

const __tuff_outer_for_main = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function main() {
  let __tuff_this = { this: __tuff_outer_for_main };
  return add(40, 2);
}
if (typeof __tuff_this !== 'undefined') __tuff_this.main = main;

