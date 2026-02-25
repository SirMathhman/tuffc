"use strict";

const __tuff_outer_for_main = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function main() {
  let __tuff_this = { this: __tuff_outer_for_main };
  let x = 1; if (typeof __tuff_this !== 'undefined') __tuff_this.x = x;
  let y = 2; if (typeof __tuff_this !== 'undefined') __tuff_this.y = y;
  return (((x < y)) ? (() => {
    return (x + y);
  })() : (() => {
    return y;
  })());
}
if (typeof __tuff_this !== 'undefined') __tuff_this.main = main;

