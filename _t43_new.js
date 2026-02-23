"use strict";

const __tuff_outer_for_main = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function main() {
  let __tuff_this = { this: __tuff_outer_for_main };
  let array = [1, 2, 3]; if (typeof __tuff_this !== 'undefined') __tuff_this.array = array;
  let slice = array; if (typeof __tuff_this !== 'undefined') __tuff_this.slice = slice;
  return slice.length;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.main = main;

