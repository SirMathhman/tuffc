"use strict";

function Some(fields = {}) { return { __tag: "Some", value: fields.value }; }

function None(fields = {}) { return { __tag: "None" }; }

// type Option = ...

const __tuff_outer_for_valueOrZero = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function valueOrZero(option) {
  let __tuff_this = { option: option, this: __tuff_outer_for_valueOrZero };
  return (() => { const __m = option; if (__m && __m.__tag === "Some") { const value = __m.value; return value; } else if (__m && __m.__tag === "None") { const None = __m; return 0; } else { throw new Error("Non-exhaustive match"); } })();
}
if (typeof __tuff_this !== 'undefined') __tuff_this.valueOrZero = valueOrZero;

const __tuff_outer_for_main = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function main() {
  let __tuff_this = { this: __tuff_outer_for_main };
  let a = ((typeof Some === "function") ? Some({value: 41}) : ({ __tag: "Some", value: 41 })); if (typeof __tuff_this !== 'undefined') __tuff_this.a = a;
  return (valueOrZero(a) + 1);
}
if (typeof __tuff_this !== 'undefined') __tuff_this.main = main;

