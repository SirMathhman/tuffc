"use strict";

// extern from collections

// extern type Vec

// extern fn __vec_new

// extern fn __vec_push

// extern fn __vec_get

// extern fn __vec_set

// extern fn __vec_init

// extern fn __vec_capacity

// extern fn __vec_includes

// extern fn __vec_length

const __tuff_outer_for_vec_new = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function vec_new() {
  let __tuff_this = { this: __tuff_outer_for_vec_new };
  return __vec_new();
}
if (typeof __tuff_this !== 'undefined') __tuff_this.vec_new = vec_new;

function vec_push(__this_param, item) {
  let __tuff_this = undefined;
  return __vec_push((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), item);
}

function vec_get(__this_param, index) {
  let __tuff_this = undefined;
  return __vec_get((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), index);
}

function vec_set(__this_param, index, item) {
  let __tuff_this = undefined;
  return __vec_set((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), index, item);
}

function vec_init(__this_param) {
  let __tuff_this = undefined;
  return __vec_init((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)));
}

function vec_capacity(__this_param) {
  let __tuff_this = undefined;
  return __vec_capacity((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)));
}

function vec_includes(__this_param, item) {
  let __tuff_this = undefined;
  return __vec_includes((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), item);
}

function vec_length(__this_param) {
  let __tuff_this = undefined;
  return __vec_length((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)));
}

// extern type Map

// extern fn __map_new

// extern fn map_set

// extern fn map_get

const __tuff_outer_for_map_new = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function map_new() {
  let __tuff_this = { this: __tuff_outer_for_map_new };
  return __map_new();
}
if (typeof __tuff_this !== 'undefined') __tuff_this.map_new = map_new;

// extern type Set

// extern fn __set_new

// extern fn set_add

// extern fn set_has

const __tuff_outer_for_set_new = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function set_new() {
  let __tuff_this = { this: __tuff_outer_for_set_new };
  return __set_new();
}
if (typeof __tuff_this !== 'undefined') __tuff_this.set_new = set_new;

const __tuff_outer_for_main = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function main() {
  let __tuff_this = { this: __tuff_outer_for_main };
  let v = vec_new(); if (typeof __tuff_this !== 'undefined') __tuff_this.v = v;
  (() => { const __recv = v; const __prop = __recv?.["vec_push"]; if (typeof __prop === "function") return __prop(7); const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, 7) : vec_push(__recv, 7); })();
  (() => { const __recv = v; const __prop = __recv?.["vec_push"]; if (typeof __prop === "function") return __prop(9); const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, 9) : vec_push(__recv, 9); })();
  (() => { const __recv = v; const __prop = __recv?.["vec_set"]; if (typeof __prop === "function") return __prop((() => { const __recv = v; const __prop = __recv?.["vec_length"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })(), 11); const __dyn = __recv?.table?.vec_set; return __dyn ? __dyn(__recv.ref, (() => { const __recv = v; const __prop = __recv?.["vec_length"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })(), 11) : vec_set(__recv, (() => { const __recv = v; const __prop = __recv?.["vec_length"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })(), 11); })();
  let m = map_new(); if (typeof __tuff_this !== 'undefined') __tuff_this.m = m;
  (() => { const __recv = m; const __prop = __recv?.["map_set"]; if (typeof __prop === "function") return __prop(5, 11); const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, 5, 11) : map_set(__recv, 5, 11); })();
  let s = set_new(); if (typeof __tuff_this !== 'undefined') __tuff_this.s = s;
  (() => { const __recv = s; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop(42); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, 42) : set_add(__recv, 42); })();
  if (((((((((() => { const __recv = v; const __prop = __recv?.["vec_length"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() === 3) && ((() => { const __recv = v; const __prop = __recv?.["vec_init"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.vec_init; return __dyn ? __dyn(__recv.ref) : vec_init(__recv); })() === 3)) && ((() => { const __recv = v; const __prop = __recv?.["vec_capacity"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.vec_capacity; return __dyn ? __dyn(__recv.ref) : vec_capacity(__recv); })() >= (() => { const __recv = v; const __prop = __recv?.["vec_init"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.vec_init; return __dyn ? __dyn(__recv.ref) : vec_init(__recv); })())) && ((() => { const __recv = v; const __prop = __recv?.["vec_get"]; if (typeof __prop === "function") return __prop(2); const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 2) : vec_get(__recv, 2); })() === 11)) && (() => { const __recv = v; const __prop = __recv?.["vec_includes"]; if (typeof __prop === "function") return __prop(9); const __dyn = __recv?.table?.vec_includes; return __dyn ? __dyn(__recv.ref, 9) : vec_includes(__recv, 9); })()) && ((() => { const __recv = m; const __prop = __recv?.["map_get"]; if (typeof __prop === "function") return __prop(5); const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, 5) : map_get(__recv, 5); })() === 11)) && (() => { const __recv = s; const __prop = __recv?.["set_has"]; if (typeof __prop === "function") return __prop(42); const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, 42) : set_has(__recv, 42); })())) {
  return 0;
}
  return 13;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.main = main;

