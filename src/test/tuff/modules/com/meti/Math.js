"use strict";

const __tuff_outer_for_add = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function add(a, b) {
  let __tuff_this = { a: a, b: b, this: __tuff_outer_for_add };
  return (a + b);
}
if (typeof __tuff_this !== 'undefined') __tuff_this.add = add;

