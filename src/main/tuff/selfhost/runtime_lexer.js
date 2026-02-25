"use strict";

// extern from globalThis

// extern from globalThis

// extern from globalThis

// extern from globalThis

// extern from globalThis

// extern from globalThis

// extern from globalThis

// extern from globalThis

// extern from globalThis

// extern fn str_length

// type StrIndex(...) = ...

// extern fn str_char_at

// extern fn str_slice

// extern fn str_concat

// extern fn str_eq

// extern fn str_from_char_code

// extern fn str_index_of

function str_includes(__this_param, needle) {
  let __tuff_this = undefined;
  return ((() => { const __recv = (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)); const __prop = __recv?.["str_index_of"]; if (typeof __prop === "function") return __prop(needle); const __dyn = __recv?.table?.str_index_of; return __dyn ? __dyn(__recv.ref, needle) : str_index_of(__recv, needle); })() >= 0);
}

function str_starts_with(__this_param, prefix) {
  let __tuff_this = undefined;
  let plen = (() => { const __recv = prefix; const __prop = __recv?.["str_length"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })(); if (typeof __tuff_this !== 'undefined') __tuff_this.plen = plen;
  return ((((() => { const __recv = (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)); const __prop = __recv?.["str_length"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })() < plen)) ? (() => {
    return false;
  })() : (() => {
    return (() => { const __recv = (() => { const __recv = (typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)); const __prop = __recv?.["str_slice"]; if (typeof __prop === "function") return __prop(0, plen); const __dyn = __recv?.table?.str_slice; return __dyn ? __dyn(__recv.ref, 0, plen) : str_slice(__recv, 0, plen); })(); const __prop = __recv?.["str_eq"]; if (typeof __prop === "function") return __prop(prefix); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, prefix) : str_eq(__recv, prefix); })();
  })());
}

// extern fn str_trim

// extern fn str_replace_all

// extern fn char_code

// extern fn int_to_string

// extern fn parse_int

// extern type StringBuilder

// extern fn sb_new

// extern fn sb_append

// extern fn sb_append_char

// extern fn sb_build

// extern type Vec

// extern fn __vec_new

// extern fn __vec_push

// extern fn __vec_pop

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

function vec_pop(__this_param) {
  let __tuff_this = undefined;
  return __vec_pop((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)));
}

// extern fn __vec_get

function vec_get(__this_param, i) {
  let __tuff_this = undefined;
  return __vec_get((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), i);
}

// extern fn __vec_set

// extern fn __vec_length

// extern fn __vec_init

// extern fn __vec_capacity

// extern fn __vec_clear

// extern fn __vec_join

// extern fn __vec_includes

function vec_set(__this_param, i, v) {
  let __tuff_this = undefined;
  return __vec_set((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), i, v);
}

function vec_length(__this_param) {
  let __tuff_this = undefined;
  return (0 + __vec_length((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this))));
}

function vec_init(__this_param) {
  let __tuff_this = undefined;
  return __vec_init((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)));
}

function vec_capacity(__this_param) {
  let __tuff_this = undefined;
  return __vec_capacity((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)));
}

function vec_clear(__this_param) {
  let __tuff_this = undefined;
  return __vec_clear((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)));
}

function vec_join(__this_param, sep) {
  let __tuff_this = undefined;
  return __vec_join((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), sep);
}

function vec_includes(__this_param, item) {
  let __tuff_this = undefined;
  return __vec_includes((typeof __this_param !== 'undefined' ? __this_param : (typeof __tuff_this !== 'undefined' ? __tuff_this : this)), item);
}

// extern type Map

// extern fn __map_new

// extern fn map_set

// extern fn map_get

// extern fn map_has

// extern fn map_delete

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

// extern fn set_delete

const __tuff_outer_for_set_new = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function set_new() {
  let __tuff_this = { this: __tuff_outer_for_set_new };
  return __set_new();
}
if (typeof __tuff_this !== 'undefined') __tuff_this.set_new = set_new;

// extern fn read_file

// extern fn write_file

// extern fn path_join

// extern fn path_dirname

// extern fn print

// extern fn print_error

// extern fn panic

// extern fn panic_with_code

// extern fn panic_with_code_loc

// extern fn get_argc

// extern fn get_argv

// extern fn perf_now

// extern fn profile_mark

// extern fn profile_take_json

let TK_EOF = 0; if (typeof __tuff_this !== 'undefined') __tuff_this.TK_EOF = TK_EOF;

let TK_KEYWORD = 1; if (typeof __tuff_this !== 'undefined') __tuff_this.TK_KEYWORD = TK_KEYWORD;

let TK_IDENTIFIER = 2; if (typeof __tuff_this !== 'undefined') __tuff_this.TK_IDENTIFIER = TK_IDENTIFIER;

let TK_NUMBER = 3; if (typeof __tuff_this !== 'undefined') __tuff_this.TK_NUMBER = TK_NUMBER;

let TK_STRING = 4; if (typeof __tuff_this !== 'undefined') __tuff_this.TK_STRING = TK_STRING;

let TK_BOOL = 5; if (typeof __tuff_this !== 'undefined') __tuff_this.TK_BOOL = TK_BOOL;

let TK_SYMBOL = 6; if (typeof __tuff_this !== 'undefined') __tuff_this.TK_SYMBOL = TK_SYMBOL;

let TK_CHAR = 7; if (typeof __tuff_this !== 'undefined') __tuff_this.TK_CHAR = TK_CHAR;

let tok_kinds = vec_new(); if (typeof __tuff_this !== 'undefined') __tuff_this.tok_kinds = tok_kinds;

let tok_values = vec_new(); if (typeof __tuff_this !== 'undefined') __tuff_this.tok_values = tok_values;

let tok_lines = vec_new(); if (typeof __tuff_this !== 'undefined') __tuff_this.tok_lines = tok_lines;

let tok_cols = vec_new(); if (typeof __tuff_this !== 'undefined') __tuff_this.tok_cols = tok_cols;

let tok_count = 0; if (typeof __tuff_this !== 'undefined') __tuff_this.tok_count = tok_count;

const __tuff_outer_for_tok_add = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function tok_add(kind, value, line, col) {
  let __tuff_this = { kind: kind, value: value, line: line, col: col, this: __tuff_outer_for_tok_add };
  let idx = tok_count; if (typeof __tuff_this !== 'undefined') __tuff_this.idx = idx;
  (() => { const __recv = tok_kinds; const __prop = __recv?.["vec_push"]; if (typeof __prop === "function") return __prop(kind); const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, kind) : vec_push(__recv, kind); })();
  (() => { const __recv = tok_values; const __prop = __recv?.["vec_push"]; if (typeof __prop === "function") return __prop(value); const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, value) : vec_push(__recv, value); })();
  (() => { const __recv = tok_lines; const __prop = __recv?.["vec_push"]; if (typeof __prop === "function") return __prop(line); const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, line) : vec_push(__recv, line); })();
  (() => { const __recv = tok_cols; const __prop = __recv?.["vec_push"]; if (typeof __prop === "function") return __prop(col); const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, col) : vec_push(__recv, col); })();
  tok_count = (tok_count + 1); if (typeof __tuff_this !== 'undefined') __tuff_this.tok_count = tok_count;
  return idx;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.tok_add = tok_add;

const __tuff_outer_for_tok_kind = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function tok_kind(idx) {
  let __tuff_this = { idx: idx, this: __tuff_outer_for_tok_kind };
  return (() => { const __recv = tok_kinds; const __prop = __recv?.["vec_get"]; if (typeof __prop === "function") return __prop(idx); const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, idx) : vec_get(__recv, idx); })();
}
if (typeof __tuff_this !== 'undefined') __tuff_this.tok_kind = tok_kind;

const __tuff_outer_for_tok_value = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function tok_value(idx) {
  let __tuff_this = { idx: idx, this: __tuff_outer_for_tok_value };
  return (() => { const __recv = tok_values; const __prop = __recv?.["vec_get"]; if (typeof __prop === "function") return __prop(idx); const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, idx) : vec_get(__recv, idx); })();
}
if (typeof __tuff_this !== 'undefined') __tuff_this.tok_value = tok_value;

const __tuff_outer_for_tok_line = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function tok_line(idx) {
  let __tuff_this = { idx: idx, this: __tuff_outer_for_tok_line };
  return (() => { const __recv = tok_lines; const __prop = __recv?.["vec_get"]; if (typeof __prop === "function") return __prop(idx); const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, idx) : vec_get(__recv, idx); })();
}
if (typeof __tuff_this !== 'undefined') __tuff_this.tok_line = tok_line;

const __tuff_outer_for_tok_col = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function tok_col(idx) {
  let __tuff_this = { idx: idx, this: __tuff_outer_for_tok_col };
  return (() => { const __recv = tok_cols; const __prop = __recv?.["vec_get"]; if (typeof __prop === "function") return __prop(idx); const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, idx) : vec_get(__recv, idx); })();
}
if (typeof __tuff_this !== 'undefined') __tuff_this.tok_col = tok_col;

let intern_table = vec_new(); if (typeof __tuff_this !== 'undefined') __tuff_this.intern_table = intern_table;

let intern_map = map_new(); if (typeof __tuff_this !== 'undefined') __tuff_this.intern_map = intern_map;

const __tuff_outer_for_intern = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function intern(s) {
  let __tuff_this = { s: s, this: __tuff_outer_for_intern };
  return (((() => { const __recv = intern_map; const __prop = __recv?.["map_has"]; if (typeof __prop === "function") return __prop(s); const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, s) : map_has(__recv, s); })()) ? (() => {
    return (() => { const __recv = intern_map; const __prop = __recv?.["map_get"]; if (typeof __prop === "function") return __prop(s); const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, s) : map_get(__recv, s); })();
  })() : (() => {
    let idx = (() => { const __recv = intern_table; const __prop = __recv?.["vec_length"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })(); if (typeof __tuff_this !== 'undefined') __tuff_this.idx = idx;
    (() => { const __recv = intern_table; const __prop = __recv?.["vec_push"]; if (typeof __prop === "function") return __prop(s); const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, s) : vec_push(__recv, s); })();
    (() => { const __recv = intern_map; const __prop = __recv?.["map_set"]; if (typeof __prop === "function") return __prop(s, idx); const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, s, idx) : map_set(__recv, s, idx); })();
    return idx;
  })());
}
if (typeof __tuff_this !== 'undefined') __tuff_this.intern = intern;

const __tuff_outer_for_get_intern = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function get_intern(idx) {
  let __tuff_this = { idx: idx, this: __tuff_outer_for_get_intern };
  return (() => { const __recv = intern_table; const __prop = __recv?.["vec_get"]; if (typeof __prop === "function") return __prop(idx); const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, idx) : vec_get(__recv, idx); })();
}
if (typeof __tuff_this !== 'undefined') __tuff_this.get_intern = get_intern;

const __tuff_outer_for_get_interned_str = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function get_interned_str(idx) {
  let __tuff_this = { idx: idx, this: __tuff_outer_for_get_interned_str };
  return get_intern(idx);
}
if (typeof __tuff_this !== 'undefined') __tuff_this.get_interned_str = get_interned_str;

let keywords = set_new(); if (typeof __tuff_this !== 'undefined') __tuff_this.keywords = keywords;

const __tuff_outer_for_init_keywords = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function init_keywords() {
  let __tuff_this = { this: __tuff_outer_for_init_keywords };
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("fn"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "fn") : set_add(__recv, "fn"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("let"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "let") : set_add(__recv, "let"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("struct"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "struct") : set_add(__recv, "struct"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("enum"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "enum") : set_add(__recv, "enum"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("type"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "type") : set_add(__recv, "type"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("match"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "match") : set_add(__recv, "match"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("case"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "case") : set_add(__recv, "case"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("if"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "if") : set_add(__recv, "if"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("else"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "else") : set_add(__recv, "else"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("for"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "for") : set_add(__recv, "for"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("while"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "while") : set_add(__recv, "while"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("loop"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "loop") : set_add(__recv, "loop"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("in"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "in") : set_add(__recv, "in"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("return"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "return") : set_add(__recv, "return"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("break"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "break") : set_add(__recv, "break"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("continue"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "continue") : set_add(__recv, "continue"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("is"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "is") : set_add(__recv, "is"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("class"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "class") : set_add(__recv, "class"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("object"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "object") : set_add(__recv, "object"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("contract"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "contract") : set_add(__recv, "contract"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("impl"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "impl") : set_add(__recv, "impl"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("into"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "into") : set_add(__recv, "into"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("with"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "with") : set_add(__recv, "with"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("out"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "out") : set_add(__recv, "out"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("module"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "module") : set_add(__recv, "module"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("extern"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "extern") : set_add(__recv, "extern"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("copy"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "copy") : set_add(__recv, "copy"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("async"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "async") : set_add(__recv, "async"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("mut"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "mut") : set_add(__recv, "mut"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("move"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "move") : set_add(__recv, "move"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("then"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "then") : set_add(__recv, "then"); })();
  (() => { const __recv = keywords; const __prop = __recv?.["set_add"]; if (typeof __prop === "function") return __prop("lifetime"); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "lifetime") : set_add(__recv, "lifetime"); })();
  return 0;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.init_keywords = init_keywords;

const __tuff_outer_for_is_keyword = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function is_keyword(s) {
  let __tuff_this = { s: s, this: __tuff_outer_for_is_keyword };
  return (() => { const __recv = keywords; const __prop = __recv?.["set_has"]; if (typeof __prop === "function") return __prop(s); const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, s) : set_has(__recv, s); })();
}
if (typeof __tuff_this !== 'undefined') __tuff_this.is_keyword = is_keyword;

let lex_source = ""; if (typeof __tuff_this !== 'undefined') __tuff_this.lex_source = lex_source;

let lex_pos = 0; if (typeof __tuff_this !== 'undefined') __tuff_this.lex_pos = lex_pos;

let lex_line = 1; if (typeof __tuff_this !== 'undefined') __tuff_this.lex_line = lex_line;

let lex_col = 1; if (typeof __tuff_this !== 'undefined') __tuff_this.lex_col = lex_col;

let lex_len = 0; if (typeof __tuff_this !== 'undefined') __tuff_this.lex_len = lex_len;

const __tuff_outer_for_lex_init = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function lex_init(source) {
  let __tuff_this = { source: source, this: __tuff_outer_for_lex_init };
  lex_source = source; if (typeof __tuff_this !== 'undefined') __tuff_this.lex_source = lex_source;
  lex_pos = 0; if (typeof __tuff_this !== 'undefined') __tuff_this.lex_pos = lex_pos;
  lex_line = 1; if (typeof __tuff_this !== 'undefined') __tuff_this.lex_line = lex_line;
  lex_col = 1; if (typeof __tuff_this !== 'undefined') __tuff_this.lex_col = lex_col;
  lex_len = (() => { const __recv = source; const __prop = __recv?.["str_length"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })(); if (typeof __tuff_this !== 'undefined') __tuff_this.lex_len = lex_len;
  (() => { const __recv = tok_kinds; const __prop = __recv?.["vec_clear"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.vec_clear; return __dyn ? __dyn(__recv.ref) : vec_clear(__recv); })();
  (() => { const __recv = tok_values; const __prop = __recv?.["vec_clear"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.vec_clear; return __dyn ? __dyn(__recv.ref) : vec_clear(__recv); })();
  (() => { const __recv = tok_lines; const __prop = __recv?.["vec_clear"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.vec_clear; return __dyn ? __dyn(__recv.ref) : vec_clear(__recv); })();
  (() => { const __recv = tok_cols; const __prop = __recv?.["vec_clear"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.vec_clear; return __dyn ? __dyn(__recv.ref) : vec_clear(__recv); })();
  tok_count = 0; if (typeof __tuff_this !== 'undefined') __tuff_this.tok_count = tok_count;
  return 0;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.lex_init = lex_init;

const __tuff_outer_for_lex_peek = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function lex_peek(offset) {
  let __tuff_this = { offset: offset, this: __tuff_outer_for_lex_peek };
  let p = (lex_pos + offset); if (typeof __tuff_this !== 'undefined') __tuff_this.p = p;
  return (((p >= 0)) ? (() => {
    return (((p < (() => { const __recv = lex_source; const __prop = __recv?.["str_length"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })())) ? (() => {
    return (() => { const __recv = lex_source; const __prop = __recv?.["str_char_at"]; if (typeof __prop === "function") return __prop(p); const __dyn = __recv?.table?.str_char_at; return __dyn ? __dyn(__recv.ref, p) : str_char_at(__recv, p); })();
  })() : (() => {
    return 0;
  })());
  })() : (() => {
    return 0;
  })());
}
if (typeof __tuff_this !== 'undefined') __tuff_this.lex_peek = lex_peek;

const __tuff_outer_for_lex_advance = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function lex_advance() {
  let __tuff_this = { this: __tuff_outer_for_lex_advance };
  let ch = lex_peek(0); if (typeof __tuff_this !== 'undefined') __tuff_this.ch = ch;
  lex_pos = (lex_pos + 1); if (typeof __tuff_this !== 'undefined') __tuff_this.lex_pos = lex_pos;
  return (((ch === 10)) ? (() => {
    lex_line = (lex_line + 1); if (typeof __tuff_this !== 'undefined') __tuff_this.lex_line = lex_line;
    lex_col = 1; if (typeof __tuff_this !== 'undefined') __tuff_this.lex_col = lex_col;
    return ch;
  })() : (() => {
    lex_col = (lex_col + 1); if (typeof __tuff_this !== 'undefined') __tuff_this.lex_col = lex_col;
    return ch;
  })());
}
if (typeof __tuff_this !== 'undefined') __tuff_this.lex_advance = lex_advance;

const __tuff_outer_for_is_alpha = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function is_alpha(ch) {
  let __tuff_this = { ch: ch, this: __tuff_outer_for_is_alpha };
  return ((((ch >= 65) && (ch <= 90))) ? (() => {
    return true;
  })() : ((((ch >= 97) && (ch <= 122))) ? (() => {
    return true;
  })() : (((ch === 95)) ? (() => {
    return true;
  })() : (() => {
    return false;
  })())));
}
if (typeof __tuff_this !== 'undefined') __tuff_this.is_alpha = is_alpha;

const __tuff_outer_for_is_digit = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function is_digit(ch) {
  let __tuff_this = { ch: ch, this: __tuff_outer_for_is_digit };
  return ((ch >= 48) && (ch <= 57));
}
if (typeof __tuff_this !== 'undefined') __tuff_this.is_digit = is_digit;

const __tuff_outer_for_is_alnum = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function is_alnum(ch) {
  let __tuff_this = { ch: ch, this: __tuff_outer_for_is_alnum };
  return (is_alpha(ch) || is_digit(ch));
}
if (typeof __tuff_this !== 'undefined') __tuff_this.is_alnum = is_alnum;

const __tuff_outer_for_is_whitespace = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function is_whitespace(ch) {
  let __tuff_this = { ch: ch, this: __tuff_outer_for_is_whitespace };
  return ((((ch === 32) || (ch === 9)) || (ch === 13)) || (ch === 10));
}
if (typeof __tuff_this !== 'undefined') __tuff_this.is_whitespace = is_whitespace;

const __tuff_outer_for_lex_read_ident = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function lex_read_ident() {
  let __tuff_this = { this: __tuff_outer_for_lex_read_ident };
  let sb = sb_new(); if (typeof __tuff_this !== 'undefined') __tuff_this.sb = sb;
  while (is_alnum(lex_peek(0))) {
  sb_append_char(sb, lex_advance());
}
  return sb_build(sb);
}
if (typeof __tuff_this !== 'undefined') __tuff_this.lex_read_ident = lex_read_ident;

const __tuff_outer_for_lex_read_number = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function lex_read_number() {
  let __tuff_this = { this: __tuff_outer_for_lex_read_number };
  let sb = sb_new(); if (typeof __tuff_this !== 'undefined') __tuff_this.sb = sb;
  if ((lex_peek(0) === 48)) {
  let next = lex_peek(1); if (typeof __tuff_this !== 'undefined') __tuff_this.next = next;
  if ((((next === 120) || (next === 98)) || (next === 111))) {
  sb_append_char(sb, lex_advance());
  sb_append_char(sb, lex_advance());
  while ((is_alnum(lex_peek(0)) || (lex_peek(0) === 95))) {
  let ch = lex_advance(); if (typeof __tuff_this !== 'undefined') __tuff_this.ch = ch;
  if ((ch !== 95)) {
  sb_append_char(sb, ch);
}
}
  return sb_build(sb);
}
}
  while ((is_digit(lex_peek(0)) || (lex_peek(0) === 95))) {
  let ch = lex_advance(); if (typeof __tuff_this !== 'undefined') __tuff_this.ch = ch;
  if ((ch !== 95)) {
  sb_append_char(sb, ch);
}
}
  if (((lex_peek(0) === 46) && is_digit(lex_peek(1)))) {
  sb_append_char(sb, lex_advance());
  while ((is_digit(lex_peek(0)) || (lex_peek(0) === 95))) {
  let ch = lex_advance(); if (typeof __tuff_this !== 'undefined') __tuff_this.ch = ch;
  if ((ch !== 95)) {
  sb_append_char(sb, ch);
}
}
}
  while ((is_alnum(lex_peek(0)) || (lex_peek(0) === 95))) {
  let ch = lex_advance(); if (typeof __tuff_this !== 'undefined') __tuff_this.ch = ch;
  if ((ch !== 95)) {
  sb_append_char(sb, ch);
}
}
  return sb_build(sb);
}
if (typeof __tuff_this !== 'undefined') __tuff_this.lex_read_number = lex_read_number;

const __tuff_outer_for_lex_read_string = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function lex_read_string() {
  let __tuff_this = { this: __tuff_outer_for_lex_read_string };
  lex_advance();
  let sb = sb_new(); if (typeof __tuff_this !== 'undefined') __tuff_this.sb = sb;
  while (((lex_pos < lex_len) && (lex_peek(0) !== 34))) {
  if ((lex_peek(0) === 92)) {
  sb_append_char(sb, lex_advance());
  sb_append_char(sb, lex_advance());
} else {
  sb_append_char(sb, lex_advance());
}
}
  if ((lex_peek(0) !== 34)) {
  panic_with_code("E_LEX_UNTERMINATED_STRING", (() => { const __recv = (() => { const __recv = (() => { const __recv = "Unterminated string literal at "; const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(int_to_string(lex_line)); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(lex_line)) : str_concat(__recv, int_to_string(lex_line)); })(); const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(":"); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ":") : str_concat(__recv, ":"); })(); const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(int_to_string(lex_col)); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(lex_col)) : str_concat(__recv, int_to_string(lex_col)); })(), "The lexer reached end-of-line or end-of-file before finding the closing quote delimiter for this string.", "Close the string with a matching quote delimiter, or escape embedded quotes.");
}
  lex_advance();
  return sb_build(sb);
}
if (typeof __tuff_this !== 'undefined') __tuff_this.lex_read_string = lex_read_string;

const __tuff_outer_for_lex_read_char = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function lex_read_char() {
  let __tuff_this = { this: __tuff_outer_for_lex_read_char };
  lex_advance();
  let sb = sb_new(); if (typeof __tuff_this !== 'undefined') __tuff_this.sb = sb;
  while (((lex_pos < lex_len) && (lex_peek(0) !== 39))) {
  sb_append_char(sb, lex_advance());
}
  if ((lex_peek(0) !== 39)) {
  panic_with_code("E_LEX_UNTERMINATED_CHAR", (() => { const __recv = (() => { const __recv = (() => { const __recv = "Unterminated char literal at "; const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(int_to_string(lex_line)); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(lex_line)) : str_concat(__recv, int_to_string(lex_line)); })(); const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(":"); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ":") : str_concat(__recv, ":"); })(); const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(int_to_string(lex_col)); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(lex_col)) : str_concat(__recv, int_to_string(lex_col)); })(), "The lexer reached end-of-line or end-of-file before finding the closing apostrophe delimiter for this char literal.", "Close the char literal with a matching apostrophe and ensure only one character (or valid escape) is inside.");
}
  lex_advance();
  return sb_build(sb);
}
if (typeof __tuff_this !== 'undefined') __tuff_this.lex_read_char = lex_read_char;

const __tuff_outer_for_lex_check_two = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function lex_check_two(a, b) {
  let __tuff_this = { a: a, b: b, this: __tuff_outer_for_lex_check_two };
  return ((lex_peek(0) === a) && (lex_peek(1) === b));
}
if (typeof __tuff_this !== 'undefined') __tuff_this.lex_check_two = lex_check_two;

const __tuff_outer_for_lex_try_consume_bom = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function lex_try_consume_bom(ch) {
  let __tuff_this = { ch: ch, this: __tuff_outer_for_lex_try_consume_bom };
  if (((((lex_pos === 0) && (ch === 239)) && (lex_peek(1) === 187)) && (lex_peek(2) === 191))) {
  lex_advance();
  lex_advance();
  lex_advance();
  return true;
}
  if (((lex_pos === 0) && ((ch === 65279) || (ch === 65534)))) {
  lex_advance();
  return true;
}
  return false;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.lex_try_consume_bom = lex_try_consume_bom;

const __tuff_outer_for_lex_try_skip_whitespace_or_comment = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function lex_try_skip_whitespace_or_comment(ch) {
  let __tuff_this = { ch: ch, this: __tuff_outer_for_lex_try_skip_whitespace_or_comment };
  if (is_whitespace(ch)) {
  lex_advance();
  return true;
}
  if (((ch === 47) && (lex_peek(1) === 47))) {
  while (((lex_pos < lex_len) && (lex_peek(0) !== 10))) {
  lex_advance();
}
  return true;
}
  if (((ch === 47) && (lex_peek(1) === 42))) {
  lex_advance();
  lex_advance();
  while (((lex_pos < lex_len) && (!((lex_peek(0) === 42) && (lex_peek(1) === 47))))) {
  lex_advance();
}
  if ((lex_pos >= lex_len)) {
  panic_with_code("E_LEX_UNTERMINATED_BLOCK_COMMENT", (() => { const __recv = (() => { const __recv = (() => { const __recv = "Unterminated block comment near "; const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(int_to_string(lex_line)); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(lex_line)) : str_concat(__recv, int_to_string(lex_line)); })(); const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(":"); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ":") : str_concat(__recv, ":"); })(); const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(int_to_string(lex_col)); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(lex_col)) : str_concat(__recv, int_to_string(lex_col)); })(), "A block comment started with '/*' but the lexer did not find a matching '*/' before end-of-file.", "Add a closing '*/' for this comment, or remove the unmatched opening '/*'.");
}
  lex_advance();
  lex_advance();
  return true;
}
  return false;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.lex_try_skip_whitespace_or_comment = lex_try_skip_whitespace_or_comment;

const __tuff_outer_for_lex_try_emit_three_char_symbol = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function lex_try_emit_three_char_symbol(start_line, start_col) {
  let __tuff_this = { start_line: start_line, start_col: start_col, this: __tuff_outer_for_lex_try_emit_three_char_symbol };
  if ((((lex_peek(0) === 46) && (lex_peek(1) === 46)) && (lex_peek(2) === 46))) {
  lex_advance();
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern("..."), start_line, start_col);
  return true;
}
  return false;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.lex_try_emit_three_char_symbol = lex_try_emit_three_char_symbol;

const __tuff_outer_for_lex_try_emit_two_char_symbol = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function lex_try_emit_two_char_symbol(start_line, start_col) {
  let __tuff_this = { start_line: start_line, start_col: start_col, this: __tuff_outer_for_lex_try_emit_two_char_symbol };
  if (lex_check_two(61, 62)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern("=>"), start_line, start_col);
  return true;
}
  if (lex_check_two(61, 61)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern("=="), start_line, start_col);
  return true;
}
  if (lex_check_two(33, 61)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern("!="), start_line, start_col);
  return true;
}
  if (lex_check_two(60, 61)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern("<="), start_line, start_col);
  return true;
}
  if (lex_check_two(62, 61)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern(">="), start_line, start_col);
  return true;
}
  if (lex_check_two(38, 38)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern("&&"), start_line, start_col);
  return true;
}
  if (lex_check_two(124, 124)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern("||"), start_line, start_col);
  return true;
}
  if (lex_check_two(58, 58)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern("::"), start_line, start_col);
  return true;
}
  if (lex_check_two(46, 46)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern(".."), start_line, start_col);
  return true;
}
  if (lex_check_two(124, 62)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern("|>"), start_line, start_col);
  return true;
}
  return false;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.lex_try_emit_two_char_symbol = lex_try_emit_two_char_symbol;

const __tuff_outer_for_lex_all = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function lex_all() {
  let __tuff_this = { this: __tuff_outer_for_lex_all };
  init_keywords();
  while ((lex_pos < lex_len)) {
  let ch = lex_peek(0); if (typeof __tuff_this !== 'undefined') __tuff_this.ch = ch;
  if ((lex_try_consume_bom(ch) || lex_try_skip_whitespace_or_comment(ch))) {
  continue;
}
  let start_line = lex_line; if (typeof __tuff_this !== 'undefined') __tuff_this.start_line = start_line;
  let start_col = lex_col; if (typeof __tuff_this !== 'undefined') __tuff_this.start_col = start_col;
  if ((lex_try_emit_three_char_symbol(start_line, start_col) || lex_try_emit_two_char_symbol(start_line, start_col))) {
  continue;
}
  if (is_alpha(ch)) {
  let text = lex_read_ident(); if (typeof __tuff_this !== 'undefined') __tuff_this.text = text;
  if ((() => { const __recv = text; const __prop = __recv?.["str_eq"]; if (typeof __prop === "function") return __prop("true"); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "true") : str_eq(__recv, "true"); })()) {
  tok_add(TK_BOOL, 1, start_line, start_col);
} else { if ((() => { const __recv = text; const __prop = __recv?.["str_eq"]; if (typeof __prop === "function") return __prop("false"); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "false") : str_eq(__recv, "false"); })()) {
  tok_add(TK_BOOL, 0, start_line, start_col);
} else { if (is_keyword(text)) {
  tok_add(TK_KEYWORD, intern(text), start_line, start_col);
} else {
  tok_add(TK_IDENTIFIER, intern(text), start_line, start_col);
} } }
  continue;
}
  if (is_digit(ch)) {
  let text = lex_read_number(); if (typeof __tuff_this !== 'undefined') __tuff_this.text = text;
  tok_add(TK_NUMBER, intern(text), start_line, start_col);
  continue;
}
  if ((ch === 34)) {
  let text = lex_read_string(); if (typeof __tuff_this !== 'undefined') __tuff_this.text = text;
  tok_add(TK_STRING, intern(text), start_line, start_col);
  continue;
}
  if ((ch === 39)) {
  let text = lex_read_char(); if (typeof __tuff_this !== 'undefined') __tuff_this.text = text;
  tok_add(TK_CHAR, intern(text), start_line, start_col);
  continue;
}
  let sym_text = str_from_char_code(ch); if (typeof __tuff_this !== 'undefined') __tuff_this.sym_text = sym_text;
  if ((((() => { const __recv = sym_text; const __prop = __recv?.["str_length"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })() === 1) && (() => { const __recv = "(){}[],:;+-*/%<>=.!?|&"; const __prop = __recv?.["str_includes"]; if (typeof __prop === "function") return __prop(sym_text); const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, sym_text) : str_includes(__recv, sym_text); })())) {
  lex_advance();
  tok_add(TK_SYMBOL, intern(sym_text), start_line, start_col);
  continue;
}
  let display_char = sym_text; if (typeof __tuff_this !== 'undefined') __tuff_this.display_char = display_char;
  if (((() => { const __recv = display_char; const __prop = __recv?.["str_length"]; if (typeof __prop === "function") return __prop(); const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })() === 0)) {
  display_char = "<non-printable>"; if (typeof __tuff_this !== 'undefined') __tuff_this.display_char = display_char;
}
  panic_with_code("E_LEX_UNEXPECTED_CHARACTER", (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "Unexpected character '"; const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(display_char); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, display_char) : str_concat(__recv, display_char); })(); const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop("' (code "); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' (code ") : str_concat(__recv, "' (code "); })(); const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(int_to_string(ch)); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(ch)) : str_concat(__recv, int_to_string(ch)); })(); const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(") at "); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ") at ") : str_concat(__recv, ") at "); })(); const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(int_to_string(start_line)); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(start_line)) : str_concat(__recv, int_to_string(start_line)); })(); const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(":"); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ":") : str_concat(__recv, ":"); })(); const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(int_to_string(start_col)); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(start_col)) : str_concat(__recv, int_to_string(start_col)); })(), "This character is not valid in the current lexical context and cannot be tokenized as part of Tuff syntax.", "Remove/replace the character, save source as UTF-8 without BOM, and use only supported symbols/identifiers in source text.");
}
  tok_add(TK_EOF, intern("<eof>"), lex_line, lex_col);
  return tok_count;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.lex_all = lex_all;

const __tuff_outer_for_count_effective_token_lines = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function count_effective_token_lines() {
  let __tuff_this = { this: __tuff_outer_for_count_effective_token_lines };
  let seen = map_new(); if (typeof __tuff_this !== 'undefined') __tuff_this.seen = seen;
  let count = 0; if (typeof __tuff_this !== 'undefined') __tuff_this.count = count;
  let i = 0; if (typeof __tuff_this !== 'undefined') __tuff_this.i = i;
  while ((i < tok_count)) {
  if ((tok_kind(i) !== TK_EOF)) {
  let line = (() => { const __recv = tok_lines; const __prop = __recv?.["vec_get"]; if (typeof __prop === "function") return __prop(i); const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(); if (typeof __tuff_this !== 'undefined') __tuff_this.line = line;
  if ((!(() => { const __recv = seen; const __prop = __recv?.["map_has"]; if (typeof __prop === "function") return __prop(line); const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, line) : map_has(__recv, line); })())) {
  (() => { const __recv = seen; const __prop = __recv?.["map_set"]; if (typeof __prop === "function") return __prop(line, 1); const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, line, 1) : map_set(__recv, line, 1); })();
  count = (count + 1); if (typeof __tuff_this !== 'undefined') __tuff_this.count = count;
}
}
  i = (i + 1); if (typeof __tuff_this !== 'undefined') __tuff_this.i = i;
}
  return count;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.count_effective_token_lines = count_effective_token_lines;

const __tuff_outer_for_lint_effective_line_count = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function lint_effective_line_count() {
  let __tuff_this = { this: __tuff_outer_for_lint_effective_line_count };
  return count_effective_token_lines();
}
if (typeof __tuff_this !== 'undefined') __tuff_this.lint_effective_line_count = lint_effective_line_count;

const __tuff_outer_for_lint_assert_file_length = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function lint_assert_file_length(filePath, maxEffectiveLines) {
  let __tuff_this = { filePath: filePath, maxEffectiveLines: maxEffectiveLines, this: __tuff_outer_for_lint_assert_file_length };
  let count = count_effective_token_lines(); if (typeof __tuff_this !== 'undefined') __tuff_this.count = count;
  if ((count > maxEffectiveLines)) {
  panic_with_code("E_LINT_FILE_TOO_LONG", (() => { const __recv = (() => { const __recv = "File exceeds "; const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(int_to_string(maxEffectiveLines)); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(maxEffectiveLines)) : str_concat(__recv, int_to_string(maxEffectiveLines)); })(); const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop((() => { const __recv = (() => { const __recv = " effective lines ("; const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(int_to_string(count)); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(count)) : str_concat(__recv, int_to_string(count)); })(); const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(")"); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ")") : str_concat(__recv, ")"); })()); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = (() => { const __recv = " effective lines ("; const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(int_to_string(count)); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(count)) : str_concat(__recv, int_to_string(count)); })(); const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(")"); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ")") : str_concat(__recv, ")"); })()) : str_concat(__recv, (() => { const __recv = (() => { const __recv = " effective lines ("; const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(int_to_string(count)); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(count)) : str_concat(__recv, int_to_string(count)); })(); const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(")"); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ")") : str_concat(__recv, ")"); })()); })(), "Large files are harder to review and maintain; this file exceeds the maximum effective line budget after excluding comments and blank lines.", (() => { const __recv = (() => { const __recv = "Split this file into smaller modules so each file has at most "; const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(int_to_string(maxEffectiveLines)); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(maxEffectiveLines)) : str_concat(__recv, int_to_string(maxEffectiveLines)); })(); const __prop = __recv?.["str_concat"]; if (typeof __prop === "function") return __prop(" non-comment, non-whitespace lines."); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " non-comment, non-whitespace lines.") : str_concat(__recv, " non-comment, non-whitespace lines."); })());
}
  return 0;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.lint_assert_file_length = lint_assert_file_length;

const __tuff_outer_for_selfhost_runtime_lexer_marker = typeof __tuff_this !== 'undefined' ? __tuff_this : undefined;
function selfhost_runtime_lexer_marker() {
  let __tuff_this = { this: __tuff_outer_for_selfhost_runtime_lexer_marker };
  return 0;
}
if (typeof __tuff_this !== 'undefined') __tuff_this.selfhost_runtime_lexer_marker = selfhost_runtime_lexer_marker;

