"use strict";

const __tuff_outer_for_outer = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function outer() {
  let __tuff_this = { this: __tuff_outer_for_outer };
  let x = 100; if (typeof __tuff_this !== 'undefined') __tuff_this.x = x;
  const __tuff_outer_for_inner = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function inner() {
  let __tuff_this = { this: __tuff_outer_for_inner };
  return (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this));
}
if (typeof __tuff_this !== 'undefined') __tuff_this.inner = inner;
  return (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this));
}
if (typeof __tuff_this !== 'undefined') __tuff_this.outer = outer;

let outerVal = outer(); if (typeof __tuff_this !== 'undefined') __tuff_this.outerVal = outerVal;

let innerVal = (() => { const __recv = outerVal; const __prop = __recv?.["inner"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.inner; return __dyn ? __dyn(__recv.ref) : inner(__recv); })(); if (typeof __tuff_this !== 'undefined') __tuff_this.innerVal = innerVal;

innerVal.x;

