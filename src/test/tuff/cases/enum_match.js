"use strict";

const Color = { Red: { __tag: "Red" }, Blue: { __tag: "Blue" } }; 

const __tuff_outer_for_pick = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function pick(c) {
  let __tuff_this = { c: c, this: __tuff_outer_for_pick };
  return (() => { const __m = c; if (__m && __m.__tag === "Red") { const Red = __m; return 1; } else if (__m && __m.__tag === "Blue") { const Blue = __m; return 2; } else { throw new Error("Non-exhaustive match"); } })();
}
if (typeof __tuff_this !== 'undefined') __tuff_this.pick = pick;

const __tuff_outer_for_main = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function main() {
  let __tuff_this = { this: __tuff_outer_for_main };
  return pick(Color.Blue);
}
if (typeof __tuff_this !== 'undefined') __tuff_this.main = main;

