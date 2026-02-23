"use strict";

const __tuff_outer_for_main = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function main() {
  let __tuff_this = { this: __tuff_outer_for_main };
  let x = 0; if (typeof __tuff_this !== 'undefined') __tuff_this.x = x;
  function drop(__this_param) {
  let __tuff_this = undefined;
  x = (x + (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this))); if (typeof __tuff_this !== 'undefined') __tuff_this.x = x;
}
  // type DroppableI32 = ...
  let temp = 100; if (typeof __tuff_this !== 'undefined') __tuff_this.temp = temp;
  drop(temp);
    return x;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.main = main;

