"use strict";

const Wrapper = (() => { const __cache = new Map(); return (fields = {}) => { const __key = JSON.stringify([fields.x]); const __cached = __cache.get(__key); if (__cached !== undefined) return __cached; const __value = { __tag: "Wrapper", x: fields.x }; __cache.set(__key, __value); return __value; }; })();

const __tuff_outer_for_main = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function main() {
  let __tuff_this = { this: __tuff_outer_for_main };
  return ((((typeof Wrapper === "function") ? Wrapper({x: 100}) : ({ __tag: "Wrapper", x: 100 })) === ((typeof Wrapper === "function") ? Wrapper({x: 100}) : ({ __tag: "Wrapper", x: 100 }))) && (((typeof Wrapper === "function") ? Wrapper({x: 100}) : ({ __tag: "Wrapper", x: 100 })) !== ((typeof Wrapper === "function") ? Wrapper({x: 120}) : ({ __tag: "Wrapper", x: 120 }))));
}
if (typeof __tuff_this !== 'undefined') __tuff_this.main = main;

