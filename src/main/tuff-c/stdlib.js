"use strict";

// extern from string

// extern from stdlib

// extern fn strlen

// type Alloc = ...

// type Vec = ...

// type Map = ...

// type Set = ...

// extern fn malloc

{
  // extern fn realloc
}

// extern fn free

let DEFAULT_SIZE = 10; if (typeof __tuff_this !== 'undefined') __tuff_this.DEFAULT_SIZE = DEFAULT_SIZE;

let EMPTY_VEC_I32 = 0; if (typeof __tuff_this !== 'undefined') __tuff_this.EMPTY_VEC_I32 = EMPTY_VEC_I32;

let EMPTY_MAP_I32_I32 = 0; if (typeof __tuff_this !== 'undefined') __tuff_this.EMPTY_MAP_I32_I32 = EMPTY_MAP_I32_I32;

let EMPTY_SET_I32 = 0; if (typeof __tuff_this !== 'undefined') __tuff_this.EMPTY_SET_I32 = EMPTY_SET_I32;

function vec_i32_ensure_capacity(__this_param, need) {
  let __tuff_this = undefined;
  if (((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)) === 0)) {
}
  if (((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)).length >= need)) {
}
  let next_len = ((((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)).length === 0)) ? 4 : (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)).length); if (typeof __tuff_this !== 'undefined') __tuff_this.next_len = next_len;
  while ((next_len < need)) {
  next_len = (next_len * 2); if (typeof __tuff_this !== 'undefined') __tuff_this.next_len = next_len;
}
  let grown = realloc((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), (sizeOf() * next_len)); if (typeof __tuff_this !== 'undefined') __tuff_this.grown = grown;
  if ((grown === 0)) {
}
  return grown;
}

function map_i32_ensure_capacity(__this_param, need) {
  let __tuff_this = undefined;
  if (((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)) === 0)) {
}
  if (((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)).length >= need)) {
}
  let next_len = ((((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)).length === 0)) ? 4 : (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)).length); if (typeof __tuff_this !== 'undefined') __tuff_this.next_len = next_len;
  while ((next_len < need)) {
  next_len = (next_len * 2); if (typeof __tuff_this !== 'undefined') __tuff_this.next_len = next_len;
}
  let grown = realloc((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), (sizeOf() * next_len)); if (typeof __tuff_this !== 'undefined') __tuff_this.grown = grown;
  if ((grown === 0)) {
}
  return grown;
}

function set_i32_ensure_capacity(__this_param, need) {
  let __tuff_this = undefined;
  if (((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)) === 0)) {
}
  if (((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)).length >= need)) {
}
  let next_len = ((((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)).length === 0)) ? 4 : (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)).length); if (typeof __tuff_this !== 'undefined') __tuff_this.next_len = next_len;
  while ((next_len < need)) {
  next_len = (next_len * 2); if (typeof __tuff_this !== 'undefined') __tuff_this.next_len = next_len;
}
  let grown = realloc((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), (sizeOf() * next_len)); if (typeof __tuff_this !== 'undefined') __tuff_this.grown = grown;
  if ((grown === 0)) {
}
  return grown;
}

function length(__this_param) {
  let __tuff_this = undefined;
  return strlen((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)));
}

const __tuff_outer_for_vec_new_i32 = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function vec_new_i32() {
  let __tuff_this = { this: __tuff_outer_for_vec_new_i32 };
  let out_ptr = malloc((sizeOf() * DEFAULT_SIZE)); if (typeof __tuff_this !== 'undefined') __tuff_this.out_ptr = out_ptr;
  if ((out_ptr === 0)) {
}
  return out_ptr;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.vec_new_i32 = vec_new_i32;

function vec_push_i32(__this_param, item) {
  let __tuff_this = undefined;
  let slice = (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)); if (typeof __tuff_this !== 'undefined') __tuff_this.slice = slice;
  if ((slice === 0)) {
}
  slice = vec_i32_ensure_capacity(slice, (slice.length + 1)); if (typeof __tuff_this !== 'undefined') __tuff_this.slice = slice;
  slice[slice.length] = item;
  slice.length = (slice.length + 1);
  return slice;
}

function vec_get_i32(__this_param, index) {
  let __tuff_this = undefined;
  if ((((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)) === 0) || (index >= (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)).length))) {
}
  return (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this))[index];
}

function vec_set_i32(__this_param, index, item) {
  let __tuff_this = undefined;
  if (((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)) === 0)) {
}
  if ((index > (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)).length)) {
}
  let slice = vec_i32_ensure_capacity((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), (index + 1)); if (typeof __tuff_this !== 'undefined') __tuff_this.slice = slice;
  slice[index] = item;
  if ((index === slice.length)) {
  slice.length = (slice.length + 1);
}
  return slice;
}

function vec_init_i32(__this_param) {
  let __tuff_this = undefined;
  return ((((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)) === 0)) ? 0 : (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)).length);
}

function vec_capacity_i32(__this_param) {
  let __tuff_this = undefined;
  return ((((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)) === 0)) ? 0 : (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)).length);
}

function vec_length_i32(__this_param) {
  let __tuff_this = undefined;
  return vec_init_i32((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)));
}

const __tuff_outer_for_map_new_i32_i32 = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function map_new_i32_i32() {
  let __tuff_this = { this: __tuff_outer_for_map_new_i32_i32 };
  let out_ptr = malloc((sizeOf() * DEFAULT_SIZE)); if (typeof __tuff_this !== 'undefined') __tuff_this.out_ptr = out_ptr;
  if ((out_ptr === 0)) {
}
  return out_ptr;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.map_new_i32_i32 = map_new_i32_i32;

function map_set_i32_i32(__this_param, k, v) {
  let __tuff_this = undefined;
  let m = (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)); if (typeof __tuff_this !== 'undefined') __tuff_this.m = m;
  if ((m === 0)) {
}
  let i = 0; if (typeof __tuff_this !== 'undefined') __tuff_this.i = i;
  while (((i + 1) < m.length)) {
  if ((m[i] === k)) {
  m[(i + 1)] = v;
  return m;
}
  i = (i + 2); if (typeof __tuff_this !== 'undefined') __tuff_this.i = i;
}
  m = map_i32_ensure_capacity(m, (m.length + 2)); if (typeof __tuff_this !== 'undefined') __tuff_this.m = m;
  m[m.length] = k;
  m.length = (m.length + 1);
  m[m.length] = v;
  m.length = (m.length + 1);
  return m;
}

function map_get_i32_i32(__this_param, k) {
  let __tuff_this = undefined;
  if (((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)) === 0)) {
}
  let i = 0; if (typeof __tuff_this !== 'undefined') __tuff_this.i = i;
  while (((i + 1) < (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)).length)) {
  if (((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this))[i] === k)) {
  return (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this))[(i + 1)];
}
  i = (i + 2); if (typeof __tuff_this !== 'undefined') __tuff_this.i = i;
}
  return 0;
}

const __tuff_outer_for_set_new_i32 = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function set_new_i32() {
  let __tuff_this = { this: __tuff_outer_for_set_new_i32 };
  let out_ptr = malloc((sizeOf() * DEFAULT_SIZE)); if (typeof __tuff_this !== 'undefined') __tuff_this.out_ptr = out_ptr;
  if ((out_ptr === 0)) {
}
  return out_ptr;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.set_new_i32 = set_new_i32;

function set_add_i32(__this_param, item) {
  let __tuff_this = undefined;
  if (set_has_i32((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), item)) {
}
  let s = set_i32_ensure_capacity((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), ((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)).length + 1)); if (typeof __tuff_this !== 'undefined') __tuff_this.s = s;
  s[s.length] = item;
  s.length = (s.length + 1);
  return s;
}

function set_has_i32(__this_param, item) {
  let __tuff_this = undefined;
  if (((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)) === 0)) {
}
  let i = 0; if (typeof __tuff_this !== 'undefined') __tuff_this.i = i;
  while ((i < (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)).length)) {
  if (((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this))[i] === item)) {
}
  i = (i + 1); if (typeof __tuff_this !== 'undefined') __tuff_this.i = i;
}
  return false;
}

