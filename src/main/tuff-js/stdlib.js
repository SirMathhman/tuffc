"use strict";

// extern fn str_length

// extern type Vec

// extern type Map

// extern type Set

// extern fn __vec_new

// extern fn vec_push

// extern fn vec_get

// extern fn vec_set

// extern fn vec_init

// extern fn vec_capacity

// extern fn vec_length

// extern fn __map_new

// extern fn map_set

// extern fn map_get

// extern fn __set_new

// extern fn set_add

// extern fn set_has

// expect fn length

function length(__this_param) {
  let __tuff_this = undefined;
  return str_length((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)));
}

// expect fn vec_new_i32

// expect fn vec_push_i32

// expect fn vec_get_i32

// expect fn vec_set_i32

// expect fn vec_init_i32

// expect fn vec_capacity_i32

// expect fn vec_length_i32

// expect fn map_new_i32_i32

// expect fn map_set_i32_i32

// expect fn map_get_i32_i32

// expect fn set_new_i32

// expect fn set_add_i32

// expect fn set_has_i32

const __tuff_outer_for_vec_new_i32 = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function vec_new_i32() {
  let __tuff_this = { this: __tuff_outer_for_vec_new_i32 };
  return __vec_new();
}
if (typeof __tuff_this !== 'undefined') __tuff_this.vec_new_i32 = vec_new_i32;

function vec_push_i32(__this_param, item) {
  let __tuff_this = undefined;
  return vec_push((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), item);
}

function vec_get_i32(__this_param, index) {
  let __tuff_this = undefined;
  return vec_get((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), index);
}

function vec_set_i32(__this_param, index, item) {
  let __tuff_this = undefined;
  return vec_set((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), index, item);
}

function vec_init_i32(__this_param) {
  let __tuff_this = undefined;
  return vec_init((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)));
}

function vec_capacity_i32(__this_param) {
  let __tuff_this = undefined;
  return vec_capacity((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)));
}

function vec_length_i32(__this_param) {
  let __tuff_this = undefined;
  return vec_length((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)));
}

const __tuff_outer_for_map_new_i32_i32 = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function map_new_i32_i32() {
  let __tuff_this = { this: __tuff_outer_for_map_new_i32_i32 };
  return __map_new();
}
if (typeof __tuff_this !== 'undefined') __tuff_this.map_new_i32_i32 = map_new_i32_i32;

function map_set_i32_i32(__this_param, k, v) {
  let __tuff_this = undefined;
  return map_set((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), k, v);
}

function map_get_i32_i32(__this_param, k) {
  let __tuff_this = undefined;
  return map_get((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), k);
}

const __tuff_outer_for_set_new_i32 = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function set_new_i32() {
  let __tuff_this = { this: __tuff_outer_for_set_new_i32 };
  return __set_new();
}
if (typeof __tuff_this !== 'undefined') __tuff_this.set_new_i32 = set_new_i32;

function set_add_i32(__this_param, item) {
  let __tuff_this = undefined;
  return set_add((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), item);
}

function set_has_i32(__this_param, item) {
  let __tuff_this = undefined;
  return set_has((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), item);
}

