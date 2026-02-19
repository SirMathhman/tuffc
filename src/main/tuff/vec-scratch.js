"use strict";

function __dyn_EquatableTable(fields = {}) { return { __tag: "__dyn_EquatableTable", equalsTo: fields.equalsTo }; }

function __dyn_Equatable(fields = {}) { return { __tag: "__dyn_Equatable", ref: fields.ref, table: fields.table }; }

// type alias: Alloc

const { malloc, free } = stdlib;

// extern fn malloc

{
  // extern fn realloc
}

// extern fn free

const { memcpy } = string;

// extern fn memcpy

function Some(fields = {}) { return { __tag: "Some", field: fields.field }; }

const None = { __tag: "None" };

// type alias: Option

function flat_map(__this_param, f) {
  return (((__this_param && __this_param.__tag === "Some")) ? (() => {
  let someValue = __this_param;
  return f(someValue.field);
})() : (() => {
  return ({ __tag: "None" });
})());
}

let DEFAULT_SIZE = 10;

// type alias: Iter

function filter(__this_param, predicate) {
  return (() => {
  while (true) {
  const __tup0 = __this_param();
let hasValue = __tup0[0];
let element = __tup0[1];
  if (predicate(element)) {
  return [hasValue, element];
} else {
  if ((!hasValue)) {
  break;
}
}
}
});
}

function first(__this_param) {
  const __tup1 = __this_param();
let hasValue = __tup1[0];
let element = __tup1[1];
  return ((hasValue) ? ({ __tag: "Some", field: element }) : ({ __tag: "None" }));
}

function Vec() {
  let __tuff_this = {  };
  // type alias: Index
  let slice = malloc((sizeOf() * DEFAULT_SIZE)); __tuff_this.slice = slice;
  if ((slice == 0)) {
  return ({ __tag: "None" });
}
  {
  function addLast(__this_param, element) { return set((() => { const __recv = __this_param; const __prop = __recv?.["size"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.size; return __dyn ? __dyn(__recv.ref) : size(__recv); })(), element); }
__tuff_this.addLast = addLast;
  function set(__this_param, index, element) {
  if ((index == slice.length)) {
  let reallocated = realloc(slice, ((sizeOf() * slice.length) * 2));
  if ((reallocated == 0)) {
  return ({ __tag: "None" });
}
  slice = reallocated;
}
  slice[index] = element;
  return ({ __tag: "Some", field: __this_param.this });
}
__tuff_this.set = set;
  function clear(__this_param) {
  slice.init = 0;
}
__tuff_this.clear = clear;
  function removeByIndex(__this_param, index) {
  let removed = slice[index];
  let elementsToShift = ((slice.init - index) - 1);
  if ((elementsToShift > 0)) {
  memcpy((slice + index), ((slice + index) + 1), (sizeOf() * elementsToShift));
}
  slice.init = (slice.init - 1);
  return removed;
}
__tuff_this.removeByIndex = removeByIndex;
}
  const __tuff_outer_for_get = __tuff_this;
function get(index) {
  let __tuff_this = { index: index, this: __tuff_outer_for_get };
  return (slice + index);
}
__tuff_this.get = get;
  function get_mut(__this_param, index) {
  return (slice + index);
}
__tuff_this.get_mut = get_mut;
  const __tuff_outer_for_size = __tuff_this;
function size() { let __tuff_this = { this: __tuff_outer_for_size }; return slice.init; }
__tuff_this.size = size;
  const __tuff_outer_for_iterIndices = __tuff_this;
function iterIndices() { let __tuff_this = { this: __tuff_outer_for_iterIndices }; return (function() { let __cur = 0, __hi = size(); return function() { if (__cur > __hi) return [true, __hi]; let __val = __cur++; return [false, __val]; }; })(); }
__tuff_this.iterIndices = iterIndices;
  return ({ __tag: "Some", field: __tuff_this });
}

// contract Equatable

function remove_by_value(__this_param, value) {
  return (() => { const __recv = index_of(__this_param, value); const __prop = __recv?.["flat_map"]; if (typeof __prop === "function") return __prop(((index) => (() => { const __recv = __this_param; const __prop = __recv?.["removeByIndex"]; if (typeof __prop === "function") return __prop(index); const __dyn = __recv?.table?.removeByIndex; return __dyn ? __dyn(__recv.ref, index) : removeByIndex(__recv, index); })())); const __dyn = __recv?.table?.flat_map; return __dyn ? __dyn(__recv.ref, ((index) => (() => { const __recv = __this_param; const __prop = __recv?.["removeByIndex"]; if (typeof __prop === "function") return __prop(index); const __dyn = __recv?.table?.removeByIndex; return __dyn ? __dyn(__recv.ref, index) : removeByIndex(__recv, index); })())) : flat_map(__recv, ((index) => (() => { const __recv = __this_param; const __prop = __recv?.["removeByIndex"]; if (typeof __prop === "function") return __prop(index); const __dyn = __recv?.table?.removeByIndex; return __dyn ? __dyn(__recv.ref, index) : removeByIndex(__recv, index); })())); })();
}

function contains(__this_param, element) { return (index_of(element) && index_of(element).__tag === "Some"); }

function index_of(__this_param, element) {
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = __this_param; const __prop = __recv?.["iterIndices"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.iterIndices; return __dyn ? __dyn(__recv.ref) : iterIndices(__recv); })(); const __prop = __recv?.["filter"]; if (typeof __prop === "function") return __prop(((index) => (() => { const __recv = (() => { const __recv = __this_param; const __prop = __recv?.["get"]; if (typeof __prop === "function") return __prop(index); const __dyn = __recv?.table?.get; return __dyn ? __dyn(__recv.ref, index) : get(__recv, index); })(); const __prop = __recv?.["equalsTo"]; if (typeof __prop === "function") return __prop(element); const __dyn = __recv?.table?.equalsTo; return __dyn ? __dyn(__recv.ref, element) : equalsTo(__recv, element); })())); const __dyn = __recv?.table?.filter; return __dyn ? __dyn(__recv.ref, ((index) => (() => { const __recv = (() => { const __recv = __this_param; const __prop = __recv?.["get"]; if (typeof __prop === "function") return __prop(index); const __dyn = __recv?.table?.get; return __dyn ? __dyn(__recv.ref, index) : get(__recv, index); })(); const __prop = __recv?.["equalsTo"]; if (typeof __prop === "function") return __prop(element); const __dyn = __recv?.table?.equalsTo; return __dyn ? __dyn(__recv.ref, element) : equalsTo(__recv, element); })())) : filter(__recv, ((index) => (() => { const __recv = (() => { const __recv = __this_param; const __prop = __recv?.["get"]; if (typeof __prop === "function") return __prop(index); const __dyn = __recv?.table?.get; return __dyn ? __dyn(__recv.ref, index) : get(__recv, index); })(); const __prop = __recv?.["equalsTo"]; if (typeof __prop === "function") return __prop(element); const __dyn = __recv?.table?.equalsTo; return __dyn ? __dyn(__recv.ref, element) : equalsTo(__recv, element); })())); })(); const __prop = __recv?.["first"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.first; return __dyn ? __dyn(__recv.ref) : first(__recv); })();
}
