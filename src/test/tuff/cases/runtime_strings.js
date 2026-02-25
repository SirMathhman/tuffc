"use strict";

// extern from strings

// extern fn str_length

// extern fn str_concat

// extern fn str_index_of

// extern fn str_trim

function str_includes(__this_param, needle) {
  let __tuff_this = undefined;
  return ((() => { const __recv = (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)); const __prop = __recv?.["str_index_of"]; if (typeof __prop === "function") return __prop(needle); const __dyn = __recv?.table?.str_index_of; return __dyn ? __dyn(__recv.ref, needle) : str_index_of(__recv, needle); })() >= 0);
}

const __tuff_outer_for_main = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function main() {
  let __tuff_this = { this: __tuff_outer_for_main };
  let combined = (() => { const __recv = "ab"; const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop("cd"); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "cd") : str_concat(__recv, "cd"); })(); if (typeof __tuff_this !== 'undefined') __tuff_this.combined = combined;
  let trimmed = (() => { const __recv = "  hello  "; const __prop = __recv?.["str_trim"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.str_trim; return __dyn ? __dyn(__recv.ref) : str_trim(__recv); })(); if (typeof __tuff_this !== 'undefined') __tuff_this.trimmed = trimmed;
  if (((((() => { const __recv = combined; const __prop = __recv?.["str_length"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })() === 4) && (() => { const __recv = combined; const __prop = __recv?.["str_includes"]; if (typeof __prop === "function") return __prop("bc"); const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, "bc") : str_includes(__recv, "bc"); })()) && ((() => { const __recv = trimmed; const __prop = __recv?.["str_length"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })() === 5))) {
  return 0;
}
  return 7;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.main = main;

