"use strict";

// extern fn str_length

// extern fn str_char_at

// extern fn str_slice

// extern fn str_concat

// extern fn str_eq

// extern fn str_from_char_code

// extern fn str_index_of

function str_includes(__this_param, needle) { return ((() => { const __recv = __this_param; const __dyn = __recv?.table?.str_index_of; return __dyn ? __dyn(__recv.ref, needle) : str_index_of(__recv, needle); })() >= 0); }

function str_starts_with(__this_param, prefix) {
  let plen = (() => { const __recv = prefix; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })();
  return ((((() => { const __recv = __this_param; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })() < plen)) ? (() => {
  return false;
})() : (() => {
  return (() => { const __recv = (() => { const __recv = __this_param; const __dyn = __recv?.table?.str_slice; return __dyn ? __dyn(__recv.ref, 0, plen) : str_slice(__recv, 0, plen); })(); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, prefix) : str_eq(__recv, prefix); })();
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

// extern fn vec_push

// extern fn vec_pop

function vec_new() { return __vec_new(); }

// extern fn vec_get

// extern fn vec_set

// extern fn vec_length

// extern fn vec_init

// extern fn vec_capacity

// extern fn vec_clear

// extern fn vec_join

// extern fn vec_includes

// extern type Map

// extern fn __map_new

// extern fn map_set

// extern fn map_get

// extern fn map_has

function map_new() { return __map_new(); }

// extern type Set

// extern fn __set_new

// extern fn set_add

// extern fn set_has

// extern fn set_delete

function set_new() { return __set_new(); }

// extern fn read_file

// extern fn write_file

// extern fn path_join

// extern fn path_dirname

// extern fn print

// extern fn print_error

// extern fn panic

// extern fn panic_with_code

let TK_EOF = 0;

let TK_KEYWORD = 1;

let TK_IDENTIFIER = 2;

let TK_NUMBER = 3;

let TK_STRING = 4;

let TK_BOOL = 5;

let TK_SYMBOL = 6;

let TK_CHAR = 7;

let tok_kinds = vec_new();

let tok_values = vec_new();

let tok_lines = vec_new();

let tok_cols = vec_new();

let tok_count = 0;

function tok_add(kind, value, line, col) {
  let idx = tok_count;
  (() => { const __recv = tok_kinds; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, kind) : vec_push(__recv, kind); })();
  (() => { const __recv = tok_values; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, value) : vec_push(__recv, value); })();
  (() => { const __recv = tok_lines; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, line) : vec_push(__recv, line); })();
  (() => { const __recv = tok_cols; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, col) : vec_push(__recv, col); })();
  tok_count = (tok_count + 1);
  return idx;
}

function tok_kind(idx) { return (() => { const __recv = tok_kinds; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, idx) : vec_get(__recv, idx); })(); }

function tok_value(idx) { return (() => { const __recv = tok_values; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, idx) : vec_get(__recv, idx); })(); }

let intern_table = vec_new();

let intern_map = map_new();

function intern(s) {
  return (((() => { const __recv = intern_map; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, s) : map_has(__recv, s); })()) ? (() => {
  return (() => { const __recv = intern_map; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, s) : map_get(__recv, s); })();
})() : (() => {
  let idx = (() => { const __recv = intern_table; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  (() => { const __recv = intern_table; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, s) : vec_push(__recv, s); })();
  (() => { const __recv = intern_map; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, s, idx) : map_set(__recv, s, idx); })();
  return idx;
})());
}

function get_intern(idx) {
  return (() => { const __recv = intern_table; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, idx) : vec_get(__recv, idx); })();
}

function get_interned_str(idx) { return get_intern(idx); }

let keywords = set_new();

function init_keywords() {
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "fn") : set_add(__recv, "fn"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "let") : set_add(__recv, "let"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "struct") : set_add(__recv, "struct"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "enum") : set_add(__recv, "enum"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "type") : set_add(__recv, "type"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "match") : set_add(__recv, "match"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "case") : set_add(__recv, "case"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "if") : set_add(__recv, "if"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "else") : set_add(__recv, "else"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "for") : set_add(__recv, "for"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "while") : set_add(__recv, "while"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "loop") : set_add(__recv, "loop"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "in") : set_add(__recv, "in"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "return") : set_add(__recv, "return"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "break") : set_add(__recv, "break"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "continue") : set_add(__recv, "continue"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "is") : set_add(__recv, "is"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "class") : set_add(__recv, "class"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "object") : set_add(__recv, "object"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "contract") : set_add(__recv, "contract"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "impl") : set_add(__recv, "impl"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "into") : set_add(__recv, "into"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "with") : set_add(__recv, "with"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "out") : set_add(__recv, "out"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "module") : set_add(__recv, "module"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "extern") : set_add(__recv, "extern"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "copy") : set_add(__recv, "copy"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "async") : set_add(__recv, "async"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "mut") : set_add(__recv, "mut"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "move") : set_add(__recv, "move"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "then") : set_add(__recv, "then"); })();
  (() => { const __recv = keywords; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, "lifetime") : set_add(__recv, "lifetime"); })();
  return 0;
}

function is_keyword(s) { return (() => { const __recv = keywords; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, s) : set_has(__recv, s); })(); }

let lex_source = "";

let lex_pos = 0;

let lex_line = 1;

let lex_col = 1;

let lex_len = 0;

function lex_init(source) {
  lex_source = source;
  lex_pos = 0;
  lex_line = 1;
  lex_col = 1;
  lex_len = (() => { const __recv = source; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })();
  (() => { const __recv = tok_kinds; const __dyn = __recv?.table?.vec_clear; return __dyn ? __dyn(__recv.ref) : vec_clear(__recv); })();
  (() => { const __recv = tok_values; const __dyn = __recv?.table?.vec_clear; return __dyn ? __dyn(__recv.ref) : vec_clear(__recv); })();
  (() => { const __recv = tok_lines; const __dyn = __recv?.table?.vec_clear; return __dyn ? __dyn(__recv.ref) : vec_clear(__recv); })();
  (() => { const __recv = tok_cols; const __dyn = __recv?.table?.vec_clear; return __dyn ? __dyn(__recv.ref) : vec_clear(__recv); })();
  tok_count = 0;
  return 0;
}

function lex_peek(offset) {
  let p = (lex_pos + offset);
  return ((((p < 0) || (p >= lex_len))) ? (() => {
  return 0;
})() : (() => {
  let bounded = p;
  return (() => { const __recv = lex_source; const __dyn = __recv?.table?.str_char_at; return __dyn ? __dyn(__recv.ref, bounded) : str_char_at(__recv, bounded); })();
})());
}

function lex_advance() {
  let ch = lex_peek(0);
  lex_pos = (lex_pos + 1);
  return (((ch == 10)) ? (() => {
  lex_line = (lex_line + 1);
  lex_col = 1;
  return ch;
})() : (() => {
  lex_col = (lex_col + 1);
  return ch;
})());
}

function is_alpha(ch) {
  return ((((ch >= 65) && (ch <= 90))) ? (() => {
  return true;
})() : ((((ch >= 97) && (ch <= 122))) ? (() => {
  return true;
})() : (((ch == 95)) ? (() => {
  return true;
})() : (() => {
  return false;
})())));
}

function is_digit(ch) { return ((ch >= 48) && (ch <= 57)); }

function is_alnum(ch) { return (is_alpha(ch) || is_digit(ch)); }

function is_whitespace(ch) {
  return ((((ch == 32) || (ch == 9)) || (ch == 13)) || (ch == 10));
}

function lex_read_ident() {
  let sb = sb_new();
  while (is_alnum(lex_peek(0))) {
  sb_append_char(sb, lex_advance());
}
  return sb_build(sb);
}

function lex_read_number() {
  let sb = sb_new();
  if ((lex_peek(0) == 48)) {
  let next = lex_peek(1);
  if ((((next == 120) || (next == 98)) || (next == 111))) {
  sb_append_char(sb, lex_advance());
  sb_append_char(sb, lex_advance());
  while ((is_alnum(lex_peek(0)) || (lex_peek(0) == 95))) {
  let ch = lex_advance();
  if ((ch != 95)) {
  sb_append_char(sb, ch);
}
}
  return sb_build(sb);
}
}
  while ((is_digit(lex_peek(0)) || (lex_peek(0) == 95))) {
  let ch = lex_advance();
  if ((ch != 95)) {
  sb_append_char(sb, ch);
}
}
  if (((lex_peek(0) == 46) && is_digit(lex_peek(1)))) {
  sb_append_char(sb, lex_advance());
  while ((is_digit(lex_peek(0)) || (lex_peek(0) == 95))) {
  let ch = lex_advance();
  if ((ch != 95)) {
  sb_append_char(sb, ch);
}
}
}
  while ((is_alnum(lex_peek(0)) || (lex_peek(0) == 95))) {
  let ch = lex_advance();
  if ((ch != 95)) {
  sb_append_char(sb, ch);
}
}
  return sb_build(sb);
}

function lex_read_string() {
  lex_advance();
  let sb = sb_new();
  while (((lex_pos < lex_len) && (lex_peek(0) != 34))) {
  if ((lex_peek(0) == 92)) {
  sb_append_char(sb, lex_advance());
  sb_append_char(sb, lex_advance());
} else {
  sb_append_char(sb, lex_advance());
}
}
  if ((lex_peek(0) != 34)) {
  panic("Unterminated string");
}
  lex_advance();
  return sb_build(sb);
}

function lex_read_char() {
  lex_advance();
  let sb = sb_new();
  while (((lex_pos < lex_len) && (lex_peek(0) != 39))) {
  sb_append_char(sb, lex_advance());
}
  if ((lex_peek(0) != 39)) {
  panic("Unterminated char");
}
  lex_advance();
  return sb_build(sb);
}

function lex_check_two(a, b) {
  return ((lex_peek(0) == a) && (lex_peek(1) == b));
}

function lex_all() {
  init_keywords();
  while ((lex_pos < lex_len)) {
  let ch = lex_peek(0);
  if (is_whitespace(ch)) {
  lex_advance();
  continue;
}
  if (((ch == 47) && (lex_peek(1) == 47))) {
  while (((lex_pos < lex_len) && (lex_peek(0) != 10))) {
  lex_advance();
}
  continue;
}
  if (((ch == 47) && (lex_peek(1) == 42))) {
  lex_advance();
  lex_advance();
  while (((lex_pos < lex_len) && (!((lex_peek(0) == 42) && (lex_peek(1) == 47))))) {
  lex_advance();
}
  if ((lex_pos >= lex_len)) {
  panic("Unterminated block comment");
}
  lex_advance();
  lex_advance();
  continue;
}
  let start_line = lex_line;
  let start_col = lex_col;
  if ((((lex_peek(0) == 46) && (lex_peek(1) == 46)) && (lex_peek(2) == 46))) {
  lex_advance();
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern("..."), start_line, start_col);
  continue;
}
  if (lex_check_two(61, 62)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern("=>"), start_line, start_col);
  continue;
}
  if (lex_check_two(61, 61)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern("=="), start_line, start_col);
  continue;
}
  if (lex_check_two(33, 61)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern("!="), start_line, start_col);
  continue;
}
  if (lex_check_two(60, 61)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern("<="), start_line, start_col);
  continue;
}
  if (lex_check_two(62, 61)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern(">="), start_line, start_col);
  continue;
}
  if (lex_check_two(38, 38)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern("&&"), start_line, start_col);
  continue;
}
  if (lex_check_two(124, 124)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern("||"), start_line, start_col);
  continue;
}
  if (lex_check_two(58, 58)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern("::"), start_line, start_col);
  continue;
}
  if (lex_check_two(46, 46)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern(".."), start_line, start_col);
  continue;
}
  if (lex_check_two(124, 62)) {
  lex_advance();
  lex_advance();
  tok_add(TK_SYMBOL, intern("|>"), start_line, start_col);
  continue;
}
  if (is_alpha(ch)) {
  let text = lex_read_ident();
  if ((() => { const __recv = text; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "true") : str_eq(__recv, "true"); })()) {
  tok_add(TK_BOOL, 1, start_line, start_col);
} else { if ((() => { const __recv = text; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "false") : str_eq(__recv, "false"); })()) {
  tok_add(TK_BOOL, 0, start_line, start_col);
} else { if (is_keyword(text)) {
  tok_add(TK_KEYWORD, intern(text), start_line, start_col);
} else {
  tok_add(TK_IDENTIFIER, intern(text), start_line, start_col);
} } }
  continue;
}
  if (is_digit(ch)) {
  let text = lex_read_number();
  tok_add(TK_NUMBER, intern(text), start_line, start_col);
  continue;
}
  if ((ch == 34)) {
  let text = lex_read_string();
  tok_add(TK_STRING, intern(text), start_line, start_col);
  continue;
}
  if ((ch == 39)) {
  let text = lex_read_char();
  tok_add(TK_CHAR, intern(text), start_line, start_col);
  continue;
}
  if ((() => { const __recv = "(){}[],:;+-*/%<>=.!?|&"; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, str_from_char_code(ch)) : str_includes(__recv, str_from_char_code(ch)); })()) {
  lex_advance();
  tok_add(TK_SYMBOL, intern(str_from_char_code(ch)), start_line, start_col);
  continue;
}
  panic((() => { const __recv = "Unexpected character: "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, str_from_char_code(ch)) : str_concat(__recv, str_from_char_code(ch)); })());
}
  tok_add(TK_EOF, intern("<eof>"), lex_line, lex_col);
  return tok_count;
}

function count_effective_token_lines() {
  let seen = map_new();
  let count = 0;
  let i = 0;
  while ((i < tok_count)) {
  if ((tok_kind(i) != TK_EOF)) {
  let line = (() => { const __recv = tok_lines; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  if ((!(() => { const __recv = seen; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, line) : map_has(__recv, line); })())) {
  (() => { const __recv = seen; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, line, 1) : map_set(__recv, line, 1); })();
  count = (count + 1);
}
}
  i = (i + 1);
}
  return count;
}

function lint_effective_line_count() { return count_effective_token_lines(); }

function lint_assert_file_length(filePath, maxEffectiveLines) {
  let count = count_effective_token_lines();
  if ((count > maxEffectiveLines)) {
  panic_with_code("E_LINT_FILE_TOO_LONG", (() => { const __recv = (() => { const __recv = "File exceeds "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(maxEffectiveLines)) : str_concat(__recv, int_to_string(maxEffectiveLines)); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = (() => { const __recv = " effective lines ("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(count)) : str_concat(__recv, int_to_string(count)); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ")") : str_concat(__recv, ")"); })()) : str_concat(__recv, (() => { const __recv = (() => { const __recv = " effective lines ("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(count)) : str_concat(__recv, int_to_string(count)); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ")") : str_concat(__recv, ")"); })()); })(), "Large files are harder to review and maintain; this file exceeds the maximum effective line budget after excluding comments and blank lines.", (() => { const __recv = (() => { const __recv = "Split this file into smaller modules so each file has at most "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(maxEffectiveLines)) : str_concat(__recv, int_to_string(maxEffectiveLines)); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " non-comment, non-whitespace lines.") : str_concat(__recv, " non-comment, non-whitespace lines."); })());
}
  return 0;
}

function selfhost_runtime_lexer_marker() { return 0; }

let NK_PROGRAM = 1;

let NK_FN_DECL = 2;

let NK_STRUCT_DECL = 3;

let NK_TYPE_ALIAS = 4;

let NK_LET_DECL = 5;

let NK_IMPORT_DECL = 6;

let NK_EXPR_STMT = 7;

let NK_RETURN_STMT = 8;

let NK_IF_STMT = 9;

let NK_WHILE_STMT = 10;

let NK_FOR_STMT = 11;

let NK_BLOCK = 12;

let NK_ASSIGN_STMT = 13;

let NK_BREAK_STMT = 14;

let NK_CONTINUE_STMT = 15;

let NK_CLASS_FN_DECL = 16;

let NK_EXTERN_FN_DECL = 17;

let NK_EXTERN_LET_DECL = 18;

let NK_EXTERN_TYPE_DECL = 19;

let NK_EXPECT_FN_DECL = 61;

let NK_ACTUAL_FN_DECL = 62;

let NK_OBJECT_DECL = 63;

let NK_LOOP_STMT = 64;

let NK_CONTRACT_DECL = 65;

let NK_INTO_STMT = 66;

let NK_LIFETIME_STMT = 67;

let NK_ENUM_DECL = 60;

let NK_NUMBER_LIT = 20;

let NK_BOOL_LIT = 21;

let NK_STRING_LIT = 22;

let NK_CHAR_LIT = 23;

let NK_IDENTIFIER = 24;

let NK_BINARY_EXPR = 25;

let NK_UNARY_EXPR = 26;

let NK_CALL_EXPR = 27;

let NK_MEMBER_EXPR = 28;

let NK_INDEX_EXPR = 29;

let NK_STRUCT_INIT = 30;

let NK_IF_EXPR = 31;

let NK_MATCH_EXPR = 32;

let NK_IS_EXPR = 33;

let NK_UNWRAP_EXPR = 34;

let NK_LAMBDA_EXPR = 35;

let NK_FN_EXPR = 36;

let NK_NAMED_TYPE = 40;

let NK_POINTER_TYPE = 41;

let NK_ARRAY_TYPE = 42;

let NK_TUPLE_TYPE = 43;

let NK_REFINEMENT_TYPE = 44;

let NK_UNION_TYPE = 45;

let NK_FUNCTION_TYPE = 46;

let NK_WILDCARD_PAT = 50;

let NK_LITERAL_PAT = 51;

let NK_NAME_PAT = 52;

let NK_STRUCT_PAT = 53;

let node_kinds = vec_new();

let node_data1 = vec_new();

let node_data2 = vec_new();

let node_data3 = vec_new();

let node_data4 = vec_new();

let node_data5 = vec_new();

let node_count = 1;

function node_new(kind) {
  let idx = node_count;
  (() => { const __recv = node_kinds; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, kind) : vec_push(__recv, kind); })();
  (() => { const __recv = node_data1; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, 0) : vec_push(__recv, 0); })();
  (() => { const __recv = node_data2; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, 0) : vec_push(__recv, 0); })();
  (() => { const __recv = node_data3; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, 0) : vec_push(__recv, 0); })();
  (() => { const __recv = node_data4; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, 0) : vec_push(__recv, 0); })();
  (() => { const __recv = node_data5; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, 0) : vec_push(__recv, 0); })();
  node_count = (node_count + 1);
  return idx;
}

function node_kind(idx) { return (() => { const __recv = node_kinds; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, idx) : vec_get(__recv, idx); })(); }

// extern type AnyValue

function node_set_data1(idx, v) {
  (() => { const __recv = node_data1; const __dyn = __recv?.table?.vec_set; return __dyn ? __dyn(__recv.ref, idx, v) : vec_set(__recv, idx, v); })();
  return 0;
}

function node_set_data2(idx, v) {
  (() => { const __recv = node_data2; const __dyn = __recv?.table?.vec_set; return __dyn ? __dyn(__recv.ref, idx, v) : vec_set(__recv, idx, v); })();
  return 0;
}

function node_set_data3(idx, v) {
  (() => { const __recv = node_data3; const __dyn = __recv?.table?.vec_set; return __dyn ? __dyn(__recv.ref, idx, v) : vec_set(__recv, idx, v); })();
  return 0;
}

function node_set_data4(idx, v) {
  (() => { const __recv = node_data4; const __dyn = __recv?.table?.vec_set; return __dyn ? __dyn(__recv.ref, idx, v) : vec_set(__recv, idx, v); })();
  return 0;
}

function node_set_data5(idx, v) {
  (() => { const __recv = node_data5; const __dyn = __recv?.table?.vec_set; return __dyn ? __dyn(__recv.ref, idx, v) : vec_set(__recv, idx, v); })();
  return 0;
}

function node_get_data1(idx) { return (() => { const __recv = node_data1; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, idx) : vec_get(__recv, idx); })(); }

function node_get_data2(idx) { return (() => { const __recv = node_data2; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, idx) : vec_get(__recv, idx); })(); }

function node_get_data3(idx) { return (() => { const __recv = node_data3; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, idx) : vec_get(__recv, idx); })(); }

function node_get_data4(idx) { return (() => { const __recv = node_data4; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, idx) : vec_get(__recv, idx); })(); }

function node_get_data5(idx) { return (() => { const __recv = node_data5; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, idx) : vec_get(__recv, idx); })(); }

let parse_pos = 0;

let parse_exports = set_new();

function parse_init() {
  parse_pos = 0;
  parse_exports = set_new();
  (() => { const __recv = node_kinds; const __dyn = __recv?.table?.vec_clear; return __dyn ? __dyn(__recv.ref) : vec_clear(__recv); })();
  (() => { const __recv = node_data1; const __dyn = __recv?.table?.vec_clear; return __dyn ? __dyn(__recv.ref) : vec_clear(__recv); })();
  (() => { const __recv = node_data2; const __dyn = __recv?.table?.vec_clear; return __dyn ? __dyn(__recv.ref) : vec_clear(__recv); })();
  (() => { const __recv = node_data3; const __dyn = __recv?.table?.vec_clear; return __dyn ? __dyn(__recv.ref) : vec_clear(__recv); })();
  (() => { const __recv = node_data4; const __dyn = __recv?.table?.vec_clear; return __dyn ? __dyn(__recv.ref) : vec_clear(__recv); })();
  (() => { const __recv = node_data5; const __dyn = __recv?.table?.vec_clear; return __dyn ? __dyn(__recv.ref) : vec_clear(__recv); })();
  (() => { const __recv = node_kinds; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, 0) : vec_push(__recv, 0); })();
  (() => { const __recv = node_data1; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, 0) : vec_push(__recv, 0); })();
  (() => { const __recv = node_data2; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, 0) : vec_push(__recv, 0); })();
  (() => { const __recv = node_data3; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, 0) : vec_push(__recv, 0); })();
  (() => { const __recv = node_data4; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, 0) : vec_push(__recv, 0); })();
  (() => { const __recv = node_data5; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, 0) : vec_push(__recv, 0); })();
  node_count = 1;
  return 0;
}

function p_peek(offset) {
  let idx = (parse_pos + offset);
  return (((idx >= tok_count)) ? (() => {
  return (tok_count - 1);
})() : (() => {
  return idx;
})());
}

function p_mark() { return parse_pos; }

function p_restore(mark) {
  parse_pos = mark;
  return 0;
}

function p_at_kind(kind) { return (tok_kind(p_peek(0)) == kind); }

function p_at_value(val) {
  let v = tok_value(p_peek(0));
  return ((() => { const __recv = intern_map; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, val) : map_has(__recv, val); })() && ((() => { const __recv = intern_map; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, val) : map_get(__recv, val); })() == v));
}

function p_at(kind, val) { return (p_at_kind(kind) && p_at_value(val)); }

function p_eat() {
  let t = p_peek(0);
  parse_pos = (parse_pos + 1);
  return t;
}

function p_expect_kind(kind, msg) {
  if ((!p_at_kind(kind))) {
  panic(msg);
}
  return p_eat();
}

function p_expect(kind, val, msg) {
  if ((!p_at(kind, val))) {
  panic(msg);
}
  return p_eat();
}

function p_parse_identifier() {
  let t = p_expect_kind(TK_IDENTIFIER, "Expected identifier");
  return tok_value(t);
}

function p_can_start_type_tok() {
  if (p_at_kind(TK_IDENTIFIER)) {
  return true;
}
  if (p_at(TK_SYMBOL, "*")) {
  return true;
}
  if (p_at(TK_SYMBOL, "[")) {
  return true;
}
  if (p_at(TK_SYMBOL, "(")) {
  return true;
}
  return false;
}

function p_can_start_type_tok_at(offset) {
  let idx = p_peek(offset);
  let k = tok_kind(idx);
  if ((k == TK_IDENTIFIER)) {
  return true;
}
  if ((k == TK_SYMBOL)) {
  let s = get_intern(tok_value(idx));
  if ((((() => { const __recv = s; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "*") : str_eq(__recv, "*"); })() || (() => { const __recv = s; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "[") : str_eq(__recv, "["); })()) || (() => { const __recv = s; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "(") : str_eq(__recv, "("); })())) {
  return true;
}
}
  return false;
}

function p_can_start_type_after_lifetime_tok_at(offset) {
  let idx = p_peek(offset);
  let k = tok_kind(idx);
  if ((k == TK_IDENTIFIER)) {
  return true;
}
  if ((k == TK_SYMBOL)) {
  let s = get_intern(tok_value(idx));
  if ((((() => { const __recv = s; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "*") : str_eq(__recv, "*"); })() || (() => { const __recv = s; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "[") : str_eq(__recv, "["); })()) || (() => { const __recv = s; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "(") : str_eq(__recv, "("); })())) {
  return true;
}
}
  if ((k == TK_KEYWORD)) {
  let kw = get_intern(tok_value(idx));
  if (((((() => { const __recv = kw; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "mut") : str_eq(__recv, "mut"); })() || (() => { const __recv = kw; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "move") : str_eq(__recv, "move"); })()) || (() => { const __recv = kw; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "out") : str_eq(__recv, "out"); })()) || (() => { const __recv = kw; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "uninit") : str_eq(__recv, "uninit"); })())) {
  return true;
}
}
  return false;
}

function p_can_start_refinement_expr() {
  if (p_at_kind(TK_NUMBER)) {
  return true;
}
  if (p_at_kind(TK_IDENTIFIER)) {
  return true;
}
  if (p_at_kind(TK_BOOL)) {
  return true;
}
  if (p_at_kind(TK_STRING)) {
  return true;
}
  if (p_at(TK_SYMBOL, "(")) {
  return true;
}
  if (p_at(TK_SYMBOL, "-")) {
  return true;
}
  if (p_at(TK_SYMBOL, "!")) {
  return true;
}
  return false;
}

function p_can_start_refinement_expr_at(offset) {
  let idx = p_peek(offset);
  let k = tok_kind(idx);
  if ((((((k == TK_NUMBER) || (k == TK_IDENTIFIER)) || (k == TK_BOOL)) || (k == TK_STRING)) || (k == TK_CHAR))) {
  return true;
}
  if ((k == TK_SYMBOL)) {
  let s = get_intern(tok_value(idx));
  if ((((() => { const __recv = s; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "(") : str_eq(__recv, "("); })() || (() => { const __recv = s; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "-") : str_eq(__recv, "-"); })()) || (() => { const __recv = s; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "!") : str_eq(__recv, "!"); })())) {
  return true;
}
}
  return false;
}

function p_parse_type_primary() {
  if (p_at(TK_SYMBOL, "*")) {
  p_eat();
  let mutable = 0;
  let move_ptr = 0;
  let life_name = 0;
  let progressed = true;
  while (progressed) {
  progressed = false;
  if (((mutable == 0) && p_at(TK_KEYWORD, "mut"))) {
  p_eat();
  mutable = 1;
  progressed = true;
} else { if (((move_ptr == 0) && p_at(TK_KEYWORD, "move"))) {
  p_eat();
  move_ptr = 1;
  progressed = true;
} else { if ((((life_name == 0) && p_at_kind(TK_IDENTIFIER)) && p_can_start_type_after_lifetime_tok_at(1))) {
  life_name = tok_value(p_eat());
  progressed = true;
} } }
}
  let inner = p_parse_type_primary();
  let node = node_new(NK_POINTER_TYPE);
  node_set_data1(node, mutable);
  node_set_data2(node, inner);
  node_set_data3(node, move_ptr);
  node_set_data4(node, life_name);
  return node;
}
  if (p_at(TK_SYMBOL, "[")) {
  p_eat();
  let elem = p_parse_type();
  let init = 0;
  let total = 0;
  if (p_at(TK_SYMBOL, ";")) {
  p_eat();
  init = p_parse_expression(0);
  p_expect(TK_SYMBOL, ";", "Expected ';' in array type");
  total = p_parse_expression(0);
}
  p_expect(TK_SYMBOL, "]", "Expected ']'");
  let node = node_new(NK_ARRAY_TYPE);
  node_set_data1(node, elem);
  node_set_data2(node, init);
  node_set_data3(node, total);
  return node;
}
  if (p_at(TK_SYMBOL, "(")) {
  p_eat();
  let members = vec_new();
  if ((!p_at(TK_SYMBOL, ")"))) {
  if (((tok_kind(p_peek(0)) == TK_IDENTIFIER) && (tok_kind(p_peek(1)) == TK_SYMBOL))) {
  let sym0 = get_intern(tok_value(p_peek(1)));
  if ((() => { const __recv = sym0; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, ":") : str_eq(__recv, ":"); })()) {
  p_eat();
  p_eat();
}
}
  (() => { const __recv = members; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_type()) : vec_push(__recv, p_parse_type()); })();
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  if (((tok_kind(p_peek(0)) == TK_IDENTIFIER) && (tok_kind(p_peek(1)) == TK_SYMBOL))) {
  let sym = get_intern(tok_value(p_peek(1)));
  if ((() => { const __recv = sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, ":") : str_eq(__recv, ":"); })()) {
  p_eat();
  p_eat();
}
}
  (() => { const __recv = members; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_type()) : vec_push(__recv, p_parse_type()); })();
}
}
  p_expect(TK_SYMBOL, ")", "Expected ')' in tuple type");
  if (p_at(TK_SYMBOL, "=>")) {
  p_eat();
  let ret = p_parse_type();
  let fnty = node_new(NK_FUNCTION_TYPE);
  node_set_data1(fnty, members);
  node_set_data2(fnty, ret);
  return fnty;
}
  let node = node_new(NK_TUPLE_TYPE);
  node_set_data1(node, members);
  return node;
}
  if (p_at_kind(TK_NUMBER)) {
  let t = p_eat();
  let raw = get_intern(tok_value(t));
  if ((!(() => { const __recv = raw; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "0USize") : str_eq(__recv, "0USize"); })())) {
  panic("Only 0USize is supported as a type-level numeric sentinel");
}
  let base = node_new(NK_NAMED_TYPE);
  node_set_data1(base, intern("USize"));
  node_set_data2(base, vec_new());
  let lit = node_new(NK_NUMBER_LIT);
  node_set_data1(lit, tok_value(t));
  let refine = node_new(NK_REFINEMENT_TYPE);
  node_set_data1(refine, base);
  node_set_data2(refine, intern("=="));
  node_set_data3(refine, lit);
  return refine;
}
  let name = p_parse_identifier();
  let generics = vec_new();
  while (p_at(TK_SYMBOL, "::")) {
  p_eat();
  let part = p_parse_identifier();
}
  let would_be_member_refine = false;
  if (p_at(TK_SYMBOL, "<")) {
  let k1 = tok_kind(p_peek(1));
  let k2 = tok_kind(p_peek(2));
  if (((k1 == TK_IDENTIFIER) && (k2 == TK_SYMBOL))) {
  let s2 = get_intern(tok_value(p_peek(2)));
  if ((() => { const __recv = s2; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, ".") : str_eq(__recv, "."); })()) {
  would_be_member_refine = true;
}
}
}
  if (((p_at(TK_SYMBOL, "<") && p_can_start_type_tok_at(1)) && (!would_be_member_refine))) {
  p_eat();
  if ((!p_at(TK_SYMBOL, ">"))) {
  (() => { const __recv = generics; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_type()) : vec_push(__recv, p_parse_type()); })();
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  (() => { const __recv = generics; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_type()) : vec_push(__recv, p_parse_type()); })();
}
}
  p_expect(TK_SYMBOL, ">", "Expected '>' in generic args");
}
  let type_node = node_new(NK_NAMED_TYPE);
  node_set_data1(type_node, name);
  node_set_data2(type_node, generics);
  return type_node;
}

function p_parse_type() {
  let type_node = p_parse_type_primary();
  let has_refine = ((((p_at(TK_SYMBOL, "!=") || p_at(TK_SYMBOL, "<")) || p_at(TK_SYMBOL, ">")) || p_at(TK_SYMBOL, "<=")) || p_at(TK_SYMBOL, ">="));
  let starts_generic_call_suffix = false;
  if ((p_at(TK_SYMBOL, ">") && (tok_kind(p_peek(1)) == TK_SYMBOL))) {
  let next_sym = get_intern(tok_value(p_peek(1)));
  if ((() => { const __recv = next_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "(") : str_eq(__recv, "("); })()) {
  starts_generic_call_suffix = true;
}
}
  if (((has_refine && p_can_start_refinement_expr_at(1)) && (!starts_generic_call_suffix))) {
  let op = tok_value(p_eat());
  let val_expr = p_parse_expression(0);
  let refine = node_new(NK_REFINEMENT_TYPE);
  node_set_data1(refine, type_node);
  node_set_data2(refine, op);
  node_set_data3(refine, val_expr);
  type_node = refine;
}
  while ((p_at(TK_SYMBOL, "|") || p_at(TK_SYMBOL, "|>"))) {
  let is_extract = 0;
  if (p_at(TK_SYMBOL, "|>")) {
  is_extract = 1;
}
  p_eat();
  let right = p_parse_type_primary();
  let union_node = node_new(NK_UNION_TYPE);
  node_set_data1(union_node, type_node);
  node_set_data2(union_node, right);
  node_set_data3(union_node, is_extract);
  type_node = union_node;
}
  return type_node;
}

function p_parse_pattern() {
  if ((p_at(TK_SYMBOL, "_") || p_at(TK_IDENTIFIER, "_"))) {
  p_eat();
  return node_new(NK_WILDCARD_PAT);
}
  if (p_at_kind(TK_NUMBER)) {
  let t = p_eat();
  let node = node_new(NK_LITERAL_PAT);
  node_set_data1(node, tok_value(t));
  return node;
}
  if (p_at_kind(TK_BOOL)) {
  let t = p_eat();
  let node = node_new(NK_LITERAL_PAT);
  node_set_data1(node, tok_value(t));
  return node;
}
  let name = p_parse_identifier();
  if (p_at(TK_SYMBOL, "{")) {
  p_eat();
  let fields = vec_new();
  if ((!p_at(TK_SYMBOL, "}"))) {
  (() => { const __recv = fields; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_identifier()) : vec_push(__recv, p_parse_identifier()); })();
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  (() => { const __recv = fields; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_identifier()) : vec_push(__recv, p_parse_identifier()); })();
}
}
  p_expect(TK_SYMBOL, "}", "Expected '}' in pattern");
  let node = node_new(NK_STRUCT_PAT);
  node_set_data1(node, name);
  node_set_data2(node, fields);
  return node;
}
  let node = node_new(NK_NAME_PAT);
  node_set_data1(node, name);
  return node;
}

function selfhost_parser_core_marker() { return 0; }

function p_parse_decl_generics(close_message) {
  let generics = vec_new();
  if (p_at(TK_SYMBOL, "<")) {
  p_eat();
  if ((!p_at(TK_SYMBOL, ">"))) {
  while (true) {
  (() => { const __recv = generics; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_identifier()) : vec_push(__recv, p_parse_identifier()); })();
  if (p_at(TK_SYMBOL, ":")) {
  p_eat();
  p_parse_type();
}
  if ((!p_at(TK_SYMBOL, ","))) {
  break;
}
  p_eat();
}
}
  p_expect(TK_SYMBOL, ">", close_message);
}
  return generics;
}

function p_parse_function(is_class, mode) {
  p_expect(TK_KEYWORD, "fn", "Expected 'fn'");
  let name = p_parse_identifier();
  let generics = p_parse_decl_generics("Expected '>'");
  p_expect(TK_SYMBOL, "(", "Expected '('");
  let params = vec_new();
  if ((!p_at(TK_SYMBOL, ")"))) {
  let pname = p_parse_identifier();
  let ptype = 0;
  if (p_at(TK_SYMBOL, ":")) {
  p_eat();
  ptype = p_parse_type();
}
  let param = vec_new();
  (() => { const __recv = param; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, pname) : vec_push(__recv, pname); })();
  (() => { const __recv = param; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, ptype) : vec_push(__recv, ptype); })();
  (() => { const __recv = params; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, param) : vec_push(__recv, param); })();
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  let pname2 = p_parse_identifier();
  let ptype2 = 0;
  if (p_at(TK_SYMBOL, ":")) {
  p_eat();
  ptype2 = p_parse_type();
}
  let param2 = vec_new();
  (() => { const __recv = param2; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, pname2) : vec_push(__recv, pname2); })();
  (() => { const __recv = param2; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, ptype2) : vec_push(__recv, ptype2); })();
  (() => { const __recv = params; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, param2) : vec_push(__recv, param2); })();
}
}
  p_expect(TK_SYMBOL, ")", "Expected ')'");
  let ret_type = 0;
  if (p_at(TK_SYMBOL, ":")) {
  p_eat();
  ret_type = p_parse_type();
}
  let body = 0;
  if ((mode == 1)) {
  p_expect(TK_SYMBOL, ";", "Expected ';' after expect function declaration");
} else {
  p_expect(TK_SYMBOL, "=>", "Expected '=>'");
  body = ((p_at(TK_SYMBOL, "{")) ? (() => {
  return p_parse_block();
})() : (() => {
  return p_parse_expression(0);
})());
  if ((node_kind(body) != NK_BLOCK)) {
  if (((!p_at(TK_SYMBOL, "}")) && (!p_at_kind(TK_EOF)))) {
  p_expect(TK_SYMBOL, ";", "Expected ';'");
}
}
}
  let kind = NK_FN_DECL;
  if ((is_class == 1)) {
  kind = NK_CLASS_FN_DECL;
} else { if ((mode == 1)) {
  kind = NK_EXPECT_FN_DECL;
} else { if ((mode == 2)) {
  kind = NK_ACTUAL_FN_DECL;
} } }
  let node = node_new(kind);
  node_set_data1(node, name);
  node_set_data2(node, generics);
  node_set_data3(node, params);
  node_set_data4(node, ret_type);
  node_set_data5(node, body);
  return node;
}

function p_parse_struct(is_copy) {
  p_expect(TK_KEYWORD, "struct", "Expected 'struct'");
  let name = p_parse_identifier();
  let generics = p_parse_decl_generics("Expected '>'");
  p_expect(TK_SYMBOL, "{", "Expected '{'");
  let fields = vec_new();
  while ((!p_at(TK_SYMBOL, "}"))) {
  let fname = p_parse_identifier();
  p_expect(TK_SYMBOL, ":", "Expected ':'");
  let ftype = p_parse_type();
  let field = vec_new();
  (() => { const __recv = field; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, fname) : vec_push(__recv, fname); })();
  (() => { const __recv = field; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, ftype) : vec_push(__recv, ftype); })();
  (() => { const __recv = fields; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, field) : vec_push(__recv, field); })();
  if ((p_at(TK_SYMBOL, ",") || p_at(TK_SYMBOL, ";"))) {
  p_eat();
}
}
  p_expect(TK_SYMBOL, "}", "Expected '}'");
  let node = node_new(NK_STRUCT_DECL);
  node_set_data1(node, name);
  node_set_data2(node, generics);
  node_set_data3(node, fields);
  node_set_data4(node, is_copy);
  return node;
}

function p_parse_enum() {
  p_expect(TK_KEYWORD, "enum", "Expected 'enum'");
  let name = p_parse_identifier();
  p_expect(TK_SYMBOL, "{", "Expected '{' after enum name");
  let variants = vec_new();
  while ((!p_at(TK_SYMBOL, "}"))) {
  (() => { const __recv = variants; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_identifier()) : vec_push(__recv, p_parse_identifier()); })();
  if ((p_at(TK_SYMBOL, ",") || p_at(TK_SYMBOL, ";"))) {
  p_eat();
}
}
  p_expect(TK_SYMBOL, "}", "Expected '}' after enum body");
  let node = node_new(NK_ENUM_DECL);
  node_set_data1(node, name);
  node_set_data2(node, variants);
  return node;
}

function p_parse_object() {
  p_expect(TK_KEYWORD, "object", "Expected 'object'");
  let name = p_parse_identifier();
  let generics = p_parse_decl_generics("Expected '>'");
  p_expect(TK_SYMBOL, "{", "Expected '{' after object name");
  let inputs = vec_new();
  while ((!p_at(TK_SYMBOL, "}"))) {
  p_expect(TK_KEYWORD, "in", "Expected 'in' in object input declaration");
  p_expect(TK_KEYWORD, "let", "Expected 'let' in object input declaration");
  let input_name = p_parse_identifier();
  p_expect(TK_SYMBOL, ":", "Expected ':' in object input declaration");
  let input_type = p_parse_type();
  p_expect(TK_SYMBOL, ";", "Expected ';' after object input declaration");
  let input_field = vec_new();
  (() => { const __recv = input_field; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, input_name) : vec_push(__recv, input_name); })();
  (() => { const __recv = input_field; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, input_type) : vec_push(__recv, input_type); })();
  (() => { const __recv = inputs; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, input_field) : vec_push(__recv, input_field); })();
}
  p_expect(TK_SYMBOL, "}", "Expected '}' after object body");
  let node = node_new(NK_OBJECT_DECL);
  node_set_data1(node, name);
  node_set_data2(node, generics);
  node_set_data3(node, inputs);
  return node;
}

function p_parse_contract() {
  p_expect(TK_KEYWORD, "contract", "Expected 'contract'");
  let name = p_parse_identifier();
  p_expect(TK_SYMBOL, "{", "Expected '{' after contract name");
  let methods = vec_new();
  while ((!p_at(TK_SYMBOL, "}"))) {
  p_expect(TK_KEYWORD, "fn", "Expected 'fn' in contract declaration");
  let mname = p_parse_identifier();
  let mgenerics = p_parse_decl_generics("Expected '>' after contract method generics");
  p_expect(TK_SYMBOL, "(", "Expected '(' in contract method signature");
  let params = vec_new();
  if ((!p_at(TK_SYMBOL, ")"))) {
  while (true) {
  let pname = 0;
  let ptype = 0;
  let implicit_this = 0;
  if (p_at(TK_SYMBOL, "*")) {
  p_eat();
  if (p_at(TK_KEYWORD, "mut")) {
  p_eat();
}
  pname = p_parse_identifier();
  ptype = 0;
  implicit_this = 1;
} else {
  pname = p_parse_identifier();
  if (p_at(TK_SYMBOL, ":")) {
  p_eat();
  ptype = p_parse_type();
}
}
  let param = vec_new();
  (() => { const __recv = param; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, pname) : vec_push(__recv, pname); })();
  (() => { const __recv = param; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, ptype) : vec_push(__recv, ptype); })();
  (() => { const __recv = param; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, implicit_this) : vec_push(__recv, implicit_this); })();
  (() => { const __recv = params; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, param) : vec_push(__recv, param); })();
  if ((!p_at(TK_SYMBOL, ","))) {
  break;
}
  p_eat();
}
}
  p_expect(TK_SYMBOL, ")", "Expected ')' after contract method params");
  let ret = 0;
  if (p_at(TK_SYMBOL, ":")) {
  p_eat();
  ret = p_parse_type();
}
  p_expect(TK_SYMBOL, ";", "Expected ';' after contract method signature");
  let method = vec_new();
  (() => { const __recv = method; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, mname) : vec_push(__recv, mname); })();
  (() => { const __recv = method; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, mgenerics) : vec_push(__recv, mgenerics); })();
  (() => { const __recv = method; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, params) : vec_push(__recv, params); })();
  (() => { const __recv = method; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, ret) : vec_push(__recv, ret); })();
  (() => { const __recv = methods; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, method) : vec_push(__recv, method); })();
}
  p_expect(TK_SYMBOL, "}", "Expected '}' after contract body");
  let node = node_new(NK_CONTRACT_DECL);
  node_set_data1(node, name);
  node_set_data2(node, methods);
  return node;
}

function p_parse_type_alias(is_copy) {
  p_expect(TK_KEYWORD, "type", "Expected 'type'");
  let name = p_parse_identifier();
  let generics = p_parse_decl_generics("Expected '>'");
  p_expect(TK_SYMBOL, "=", "Expected '='");
  let aliased = p_parse_type();
  let destructor_name = 0;
  if (p_at(TK_KEYWORD, "then")) {
  p_eat();
  destructor_name = p_parse_identifier();
}
  p_expect(TK_SYMBOL, ";", "Expected ';'");
  let node = node_new(NK_TYPE_ALIAS);
  node_set_data1(node, name);
  node_set_data2(node, generics);
  node_set_data3(node, aliased);
  node_set_data4(node, is_copy);
  node_set_data5(node, destructor_name);
  return node;
}

function p_parse_let() {
  p_expect(TK_KEYWORD, "let", "Expected 'let'");
  if (p_at(TK_SYMBOL, "{")) {
  p_eat();
  let names = vec_new();
  if ((!p_at(TK_SYMBOL, "}"))) {
  (() => { const __recv = names; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_identifier()) : vec_push(__recv, p_parse_identifier()); })();
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  (() => { const __recv = names; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_identifier()) : vec_push(__recv, p_parse_identifier()); })();
}
}
  p_expect(TK_SYMBOL, "}", "Expected '}'");
  p_expect(TK_SYMBOL, "=", "Expected '='");
  let parts = vec_new();
  (() => { const __recv = parts; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_identifier()) : vec_push(__recv, p_parse_identifier()); })();
  while (p_at(TK_SYMBOL, "::")) {
  p_eat();
  (() => { const __recv = parts; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_identifier()) : vec_push(__recv, p_parse_identifier()); })();
}
  p_expect(TK_SYMBOL, ";", "Expected ';'");
  let node = node_new(NK_IMPORT_DECL);
  node_set_data1(node, names);
  node_set_data2(node, parts);
  return node;
}
  let name = p_parse_identifier();
  let vtype = 0;
  if (p_at(TK_SYMBOL, ":")) {
  p_eat();
  vtype = p_parse_type();
}
  p_expect(TK_SYMBOL, "=", "Expected '='");
  let value = p_parse_expression(0);
  p_expect(TK_SYMBOL, ";", "Expected ';'");
  let node = node_new(NK_LET_DECL);
  node_set_data1(node, name);
  node_set_data2(node, vtype);
  node_set_data3(node, value);
  return node;
}

function p_parse_for() {
  p_expect(TK_KEYWORD, "for", "Expected 'for'");
  p_expect(TK_SYMBOL, "(", "Expected '('");
  let iter = p_parse_identifier();
  p_expect(TK_KEYWORD, "in", "Expected 'in'");
  let start = p_parse_expression(0);
  p_expect(TK_SYMBOL, "..", "Expected '..'");
  let end = p_parse_expression(0);
  p_expect(TK_SYMBOL, ")", "Expected ')'");
  let body = p_parse_block();
  let node = node_new(NK_FOR_STMT);
  node_set_data1(node, iter);
  node_set_data2(node, start);
  node_set_data3(node, end);
  node_set_data4(node, body);
  return node;
}

function p_parse_lifetime() {
  p_expect(TK_KEYWORD, "lifetime", "Expected 'lifetime'");
  let names = vec_new();
  (() => { const __recv = names; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_identifier()) : vec_push(__recv, p_parse_identifier()); })();
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  (() => { const __recv = names; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_identifier()) : vec_push(__recv, p_parse_identifier()); })();
}
  let body = p_parse_block();
  let node = node_new(NK_LIFETIME_STMT);
  node_set_data1(node, names);
  node_set_data2(node, body);
  return node;
}

function p_parse_extern_decl() {
  if (p_at(TK_KEYWORD, "fn")) {
  p_eat();
  let name = p_parse_identifier();
  let generics = p_parse_decl_generics("Expected '>'");
  p_expect(TK_SYMBOL, "(", "Expected '('");
  let params = vec_new();
  if ((!p_at(TK_SYMBOL, ")"))) {
  let pname = p_parse_identifier();
  let ptype = 0;
  if (p_at(TK_SYMBOL, ":")) {
  p_eat();
  ptype = p_parse_type();
}
  let param = vec_new();
  (() => { const __recv = param; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, pname) : vec_push(__recv, pname); })();
  (() => { const __recv = param; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, ptype) : vec_push(__recv, ptype); })();
  (() => { const __recv = params; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, param) : vec_push(__recv, param); })();
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  let pname2 = p_parse_identifier();
  let ptype2 = 0;
  if (p_at(TK_SYMBOL, ":")) {
  p_eat();
  ptype2 = p_parse_type();
}
  let param2 = vec_new();
  (() => { const __recv = param2; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, pname2) : vec_push(__recv, pname2); })();
  (() => { const __recv = param2; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, ptype2) : vec_push(__recv, ptype2); })();
  (() => { const __recv = params; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, param2) : vec_push(__recv, param2); })();
}
}
  p_expect(TK_SYMBOL, ")", "Expected ')'");
  let ret_type = 0;
  if (p_at(TK_SYMBOL, ":")) {
  p_eat();
  ret_type = p_parse_type();
}
  p_expect(TK_SYMBOL, ";", "Expected ';' after extern fn");
  let node = node_new(NK_EXTERN_FN_DECL);
  node_set_data1(node, name);
  node_set_data2(node, generics);
  node_set_data3(node, params);
  node_set_data4(node, ret_type);
  return node;
}
  if (p_at(TK_KEYWORD, "let")) {
  p_eat();
  let name = p_parse_identifier();
  let typ = 0;
  if (p_at(TK_SYMBOL, ":")) {
  p_eat();
  typ = p_parse_type();
}
  p_expect(TK_SYMBOL, ";", "Expected ';' after extern let");
  let node = node_new(NK_EXTERN_LET_DECL);
  node_set_data1(node, name);
  node_set_data2(node, typ);
  return node;
}
  if (p_at(TK_KEYWORD, "type")) {
  p_eat();
  let name = p_parse_identifier();
  let generics = p_parse_decl_generics("Expected '>' after extern type generics");
  p_expect(TK_SYMBOL, ";", "Expected ';' after extern type");
  let node = node_new(NK_EXTERN_TYPE_DECL);
  node_set_data1(node, name);
  node_set_data2(node, generics);
  return node;
}
  return panic("Expected fn, let, or type after extern");
}

function p_parse_statement() {
  let exported = 0;
  let copy_decl = 0;
  let expect_decl = 0;
  let actual_decl = 0;
  let consumed_modifier = 0;
  while ((((((p_at(TK_KEYWORD, "out") || p_at(TK_KEYWORD, "copy")) || p_at(TK_KEYWORD, "expect")) || p_at(TK_IDENTIFIER, "expect")) || p_at(TK_KEYWORD, "actual")) || p_at(TK_IDENTIFIER, "actual"))) {
  consumed_modifier = 1;
  if (p_at(TK_KEYWORD, "out")) {
  p_eat();
  if ((exported == 1)) {
  panic("Duplicate 'out' modifier");
}
  exported = 1;
} else { if (p_at(TK_KEYWORD, "copy")) {
  p_eat();
  if ((copy_decl == 1)) {
  panic("Duplicate 'copy' modifier");
}
  copy_decl = 1;
} else { if ((p_at(TK_KEYWORD, "expect") || p_at(TK_IDENTIFIER, "expect"))) {
  p_eat();
  if ((expect_decl == 1)) {
  panic("Duplicate 'expect' modifier");
}
  expect_decl = 1;
} else { if ((p_at(TK_KEYWORD, "actual") || p_at(TK_IDENTIFIER, "actual"))) {
  p_eat();
  if ((actual_decl == 1)) {
  panic("Duplicate 'actual' modifier");
}
  actual_decl = 1;
} else {
  panic("Unexpected declaration modifier");
} } } }
}
  if (((expect_decl == 1) && (actual_decl == 1))) {
  panic("Cannot combine 'expect' and 'actual' modifiers");
}
  if ((consumed_modifier == 1)) {
  let out_node = 0;
  if (p_at(TK_KEYWORD, "struct")) {
  out_node = p_parse_struct(copy_decl);
} else { if (p_at(TK_KEYWORD, "enum")) {
  out_node = p_parse_enum();
} else { if (p_at(TK_KEYWORD, "object")) {
  if ((copy_decl == 1)) {
  panic("'copy' is only supported on struct/type declarations");
}
  if (((expect_decl == 1) || (actual_decl == 1))) {
  panic("'expect'/'actual' are currently supported only on fn declarations");
}
  out_node = p_parse_object();
} else { if (p_at(TK_KEYWORD, "contract")) {
  if ((copy_decl == 1)) {
  panic("'copy' is only supported on struct/type declarations");
}
  if (((expect_decl == 1) || (actual_decl == 1))) {
  panic("'expect'/'actual' are currently supported only on fn declarations");
}
  out_node = p_parse_contract();
} else { if (p_at(TK_KEYWORD, "type")) {
  out_node = p_parse_type_alias(copy_decl);
} else { if (p_at(TK_KEYWORD, "fn")) {
  if ((copy_decl == 1)) {
  panic("'copy' is only supported on struct/type declarations");
}
  let mode = 0;
  if ((expect_decl == 1)) {
  mode = 1;
} else { if ((actual_decl == 1)) {
  mode = 2;
} }
  out_node = p_parse_function(0, mode);
} else { if (p_at(TK_KEYWORD, "class")) {
  if ((copy_decl == 1)) {
  panic("'copy' is only supported on struct/type declarations");
}
  if (((expect_decl == 1) || (actual_decl == 1))) {
  panic("'expect'/'actual' are currently supported only on fn declarations");
}
  p_eat();
  out_node = p_parse_function(1, 0);
} else {
  panic("Expected declaration after modifiers");
} } } } } } }
  if ((exported == 1)) {
  (() => { const __recv = parse_exports; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(out_node))) : set_add(__recv, get_interned_str(node_get_data1(out_node))); })();
}
  return out_node;
}
  if (p_at(TK_KEYWORD, "let")) {
  return p_parse_let();
}
  if (p_at(TK_KEYWORD, "struct")) {
  return p_parse_struct(0);
}
  if (p_at(TK_KEYWORD, "enum")) {
  return p_parse_enum();
}
  if (p_at(TK_KEYWORD, "object")) {
  return p_parse_object();
}
  if (p_at(TK_KEYWORD, "contract")) {
  return p_parse_contract();
}
  if (p_at(TK_KEYWORD, "type")) {
  return p_parse_type_alias(0);
}
  if (p_at(TK_KEYWORD, "fn")) {
  return p_parse_function(0, 0);
}
  if (p_at(TK_KEYWORD, "extern")) {
  p_eat();
  return p_parse_extern_decl();
}
  if (p_at(TK_KEYWORD, "class")) {
  p_eat();
  return p_parse_function(1, 0);
}
  if (p_at(TK_KEYWORD, "return")) {
  p_eat();
  let value = 0;
  if ((!p_at(TK_SYMBOL, ";"))) {
  value = p_parse_expression(0);
}
  p_expect(TK_SYMBOL, ";", "Expected ';'");
  let node = node_new(NK_RETURN_STMT);
  node_set_data1(node, value);
  return node;
}
  if (p_at(TK_KEYWORD, "if")) {
  let expr = p_parse_primary();
  if (((node_get_data2(expr) != 0) && (node_kind(node_get_data2(expr)) == NK_BLOCK))) {
  let stmt = node_new(NK_IF_STMT);
  node_set_data1(stmt, node_get_data1(expr));
  node_set_data2(stmt, node_get_data2(expr));
  node_set_data3(stmt, node_get_data3(expr));
  return stmt;
}
  p_expect(TK_SYMBOL, ";", "Expected ';' after if expression");
  let estmt = node_new(NK_EXPR_STMT);
  node_set_data1(estmt, expr);
  return estmt;
}
  if (p_at(TK_KEYWORD, "while")) {
  p_eat();
  p_expect(TK_SYMBOL, "(", "Expected '('");
  let cond = p_parse_expression(0);
  p_expect(TK_SYMBOL, ")", "Expected ')'");
  let body = p_parse_block();
  let node = node_new(NK_WHILE_STMT);
  node_set_data1(node, cond);
  node_set_data2(node, body);
  return node;
}
  if (p_at(TK_KEYWORD, "for")) {
  return p_parse_for();
}
  if (p_at(TK_KEYWORD, "loop")) {
  p_eat();
  let body = p_parse_block();
  let node = node_new(NK_LOOP_STMT);
  node_set_data1(node, body);
  return node;
}
  if (p_at(TK_KEYWORD, "lifetime")) {
  return p_parse_lifetime();
}
  if (p_at(TK_KEYWORD, "into")) {
  p_eat();
  let cname = p_parse_identifier();
  p_expect(TK_SYMBOL, ";", "Expected ';' after into statement");
  let node = node_new(NK_INTO_STMT);
  node_set_data1(node, cname);
  return node;
}
  if (p_at(TK_KEYWORD, "break")) {
  p_eat();
  p_expect(TK_SYMBOL, ";", "Expected ';'");
  return node_new(NK_BREAK_STMT);
}
  if (p_at(TK_KEYWORD, "continue")) {
  p_eat();
  p_expect(TK_SYMBOL, ";", "Expected ';'");
  return node_new(NK_CONTINUE_STMT);
}
  if (p_at(TK_SYMBOL, "{")) {
  return p_parse_block();
}
  let expr = p_parse_expression(0);
  if (p_at(TK_SYMBOL, "=")) {
  p_eat();
  let value = p_parse_expression(0);
  p_expect(TK_SYMBOL, ";", "Expected ';'");
  let node = node_new(NK_ASSIGN_STMT);
  node_set_data1(node, expr);
  node_set_data2(node, value);
  return node;
}
  if (p_at(TK_SYMBOL, ";")) {
  p_eat();
} else { if ((!p_at(TK_SYMBOL, "}"))) {
  p_expect(TK_SYMBOL, ";", "Expected ';'");
} }
  let node = node_new(NK_EXPR_STMT);
  node_set_data1(node, expr);
  return node;
}

function p_parse_program() {
  let stmts = vec_new();
  while ((!p_at_kind(TK_EOF))) {
  (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_statement()) : vec_push(__recv, p_parse_statement()); })();
}
  let node = node_new(NK_PROGRAM);
  node_set_data1(node, stmts);
  return node;
}

function desugar(program) { return program; }

function selfhost_parser_decls_marker() { return 0; }

let resolve_lifetime_scopes = vec_new();

function lifetime_scope_has(name) {
  let i = ((() => { const __recv = resolve_lifetime_scopes; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() - 1);
  while ((i >= 0)) {
  if ((() => { const __recv = (() => { const __recv = resolve_lifetime_scopes; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(); const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })()) {
  return true;
}
  i = (i - 1);
}
  return false;
}

function resolve_type_lifetimes(t) {
  if ((t == 0)) {
  return 0;
}
  let k = node_kind(t);
  if ((k == NK_POINTER_TYPE)) {
  let life_idx = node_get_data4(t);
  if ((life_idx != 0)) {
  let lname = get_interned_str(life_idx);
  if ((!lifetime_scope_has(lname))) {
  panic_with_code("E_RESOLVE_UNDEFINED_LIFETIME", (() => { const __recv = (() => { const __recv = "Undefined lifetime '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, lname) : str_concat(__recv, lname); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "'") : str_concat(__recv, "'"); })(), "A pointer type annotation references a lifetime name that is not declared in any active lifetime block.", "Declare the lifetime in an enclosing `lifetime ... { ... }` block before using it in pointer types.");
}
}
  resolve_type_lifetimes(node_get_data2(t));
  return 0;
}
  if ((k == NK_ARRAY_TYPE)) {
  resolve_type_lifetimes(node_get_data1(t));
  return 0;
}
  if ((k == NK_REFINEMENT_TYPE)) {
  resolve_type_lifetimes(node_get_data1(t));
  return 0;
}
  if ((k == NK_UNION_TYPE)) {
  resolve_type_lifetimes(node_get_data1(t));
  resolve_type_lifetimes(node_get_data2(t));
  return 0;
}
  if ((k == NK_TUPLE_TYPE)) {
  let members = node_get_data1(t);
  let i = 0;
  let len = (() => { const __recv = members; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  resolve_type_lifetimes((() => { const __recv = members; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })());
  i = (i + 1);
}
  return 0;
}
  if ((k == NK_FUNCTION_TYPE)) {
  let ps = node_get_data1(t);
  let i = 0;
  while ((i < (() => { const __recv = ps; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })())) {
  resolve_type_lifetimes((() => { const __recv = ps; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })());
  i = (i + 1);
}
  resolve_type_lifetimes(node_get_data2(t));
  return 0;
}
  return 0;
}

function fn_type_sig(t) {
  if ((t == 0)) {
  return "_";
}
  let k = node_kind(t);
  if ((k == NK_NAMED_TYPE)) {
  return get_interned_str(node_get_data1(t));
}
  if ((k == NK_POINTER_TYPE)) {
  let mutv = node_get_data1(t);
  let inner = fn_type_sig(node_get_data2(t));
  let life_idx = node_get_data4(t);
  let life_prefix = "";
  if ((life_idx != 0)) {
  life_prefix = (() => { const __recv = get_interned_str(life_idx); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " ") : str_concat(__recv, " "); })();
}
  if ((mutv == 1)) {
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = "*"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, life_prefix) : str_concat(__recv, life_prefix); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "mut ") : str_concat(__recv, "mut "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, inner) : str_concat(__recv, inner); })();
}
  return (() => { const __recv = (() => { const __recv = "*"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, life_prefix) : str_concat(__recv, life_prefix); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, inner) : str_concat(__recv, inner); })();
}
  if ((k == NK_ARRAY_TYPE)) {
  return "Array";
}
  if ((k == NK_TUPLE_TYPE)) {
  return "Tuple";
}
  if ((k == NK_REFINEMENT_TYPE)) {
  return (() => { const __recv = (() => { const __recv = "Ref<"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, fn_type_sig(node_get_data1(t))) : str_concat(__recv, fn_type_sig(node_get_data1(t))); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ">") : str_concat(__recv, ">"); })();
}
  if ((k == NK_UNION_TYPE)) {
  return (() => { const __recv = (() => { const __recv = fn_type_sig(node_get_data1(t)); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "|") : str_concat(__recv, "|"); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, fn_type_sig(node_get_data2(t))) : str_concat(__recv, fn_type_sig(node_get_data2(t))); })();
}
  if ((k == NK_FUNCTION_TYPE)) {
  let parts = vec_new();
  let ps = node_get_data1(t);
  let i = 0;
  while ((i < (() => { const __recv = ps; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })())) {
  (() => { const __recv = parts; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, fn_type_sig((() => { const __recv = ps; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })())) : vec_push(__recv, fn_type_sig((() => { const __recv = ps; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })())); })();
  i = (i + 1);
}
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = "("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = parts; const __dyn = __recv?.table?.vec_join; return __dyn ? __dyn(__recv.ref, ",") : vec_join(__recv, ","); })()) : str_concat(__recv, (() => { const __recv = parts; const __dyn = __recv?.table?.vec_join; return __dyn ? __dyn(__recv.ref, ",") : vec_join(__recv, ","); })()); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ")=>") : str_concat(__recv, ")=>"); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, fn_type_sig(node_get_data2(t))) : str_concat(__recv, fn_type_sig(node_get_data2(t))); })();
}
  return "Unknown";
}

function fn_decl_sig(n) {
  let gens = node_get_data2(n);
  let params = node_get_data3(n);
  let ret = node_get_data4(n);
  let pparts = vec_new();
  let i = 0;
  while ((i < (() => { const __recv = params; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })())) {
  let p = (() => { const __recv = params; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let pname = get_interned_str((() => { const __recv = p; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })());
  let ptype = fn_type_sig((() => { const __recv = p; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })());
  (() => { const __recv = pparts; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, (() => { const __recv = (() => { const __recv = pname; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ":") : str_concat(__recv, ":"); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ptype) : str_concat(__recv, ptype); })()) : vec_push(__recv, (() => { const __recv = (() => { const __recv = pname; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ":") : str_concat(__recv, ":"); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ptype) : str_concat(__recv, ptype); })()); })();
  i = (i + 1);
}
  let gcount = int_to_string((() => { const __recv = gens; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })());
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "g="; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, gcount) : str_concat(__recv, gcount); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ";p=") : str_concat(__recv, ";p="); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = pparts; const __dyn = __recv?.table?.vec_join; return __dyn ? __dyn(__recv.ref, ",") : vec_join(__recv, ","); })()) : str_concat(__recv, (() => { const __recv = pparts; const __dyn = __recv?.table?.vec_join; return __dyn ? __dyn(__recv.ref, ",") : vec_join(__recv, ","); })()); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ";r=") : str_concat(__recv, ";r="); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, fn_type_sig(ret)) : str_concat(__recv, fn_type_sig(ret)); })();
}

function validate_expect_actual_pairs(body) {
  let i = 0;
  let len = (() => { const __recv = body; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let stmt = (() => { const __recv = body; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let kind = node_kind(stmt);
  if (((kind == NK_EXPECT_FN_DECL) || (kind == NK_ACTUAL_FN_DECL))) {
  let name = get_interned_str(node_get_data1(stmt));
  let expect_count = 0;
  let actual_count = 0;
  let expect_node = 0;
  let actual_node = 0;
  let j = 0;
  while ((j < len)) {
  let cand = (() => { const __recv = body; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, j) : vec_get(__recv, j); })();
  let ck = node_kind(cand);
  if ((((ck == NK_EXPECT_FN_DECL) || (ck == NK_ACTUAL_FN_DECL)) && (() => { const __recv = get_interned_str(node_get_data1(cand)); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, name) : str_eq(__recv, name); })())) {
  if ((ck == NK_EXPECT_FN_DECL)) {
  expect_count = (expect_count + 1);
  expect_node = cand;
} else {
  actual_count = (actual_count + 1);
  actual_node = cand;
}
}
  j = (j + 1);
}
  if (((expect_count != 1) || (actual_count != 1))) {
  panic_with_code("E_EXPECT_ACTUAL_PAIRING", (() => { const __recv = (() => { const __recv = "expect/actual pairing requires exactly one expect and one actual for '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "'") : str_concat(__recv, "'"); })(), "Platform declarations require exactly one expect and one actual declaration for each symbol.", "Declare exactly one 'expect fn' and one matching 'actual fn' for each platform symbol.");
}
  if ((!(() => { const __recv = fn_decl_sig(expect_node); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, fn_decl_sig(actual_node)) : str_eq(__recv, fn_decl_sig(actual_node)); })())) {
  panic_with_code("E_EXPECT_ACTUAL_SIGNATURE_MISMATCH", (() => { const __recv = (() => { const __recv = "expect/actual signatures do not match for '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "'") : str_concat(__recv, "'"); })(), "An expect declaration and its actual implementation have different signatures.", "Make generic params, parameter list, and return type identical between expect and actual declarations.");
}
}
  i = (i + 1);
}
  return 0;
}

function scope_define(scopes, depth, name) {
  let scope = (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, depth) : vec_get(__recv, depth); })();
  if ((() => { const __recv = scope; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })()) {
  panic_with_code("E_RESOLVE_SHADOWING", (() => { const __recv = "Variable shadowing/redeclaration is not allowed: "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })(), "A name was declared multiple times in the same lexical scope.", "Rename one of the bindings or move it to a different scope.");
}
  (() => { const __recv = scope; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, name) : set_add(__recv, name); })();
  return 0;
}

function scope_has(scopes, depth, name) {
  let i = depth;
  while ((i >= 0)) {
  if ((() => { const __recv = (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(); const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })()) {
  return true;
}
  i = (i - 1);
}
  return false;
}

function resolve_expr(n, globals, scopes, depth) {
  if ((n == 0)) {
  return 0;
}
  let kind = node_kind(n);
  if ((kind == NK_IDENTIFIER)) {
  let name = get_interned_str(node_get_data1(n));
  if (((!scope_has(scopes, depth, name)) && (!(() => { const __recv = globals; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })()))) {
  panic_with_code("E_RESOLVE_UNKNOWN_IDENTIFIER", (() => { const __recv = "Unknown identifier: "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })(), "The identifier is not declared in local scope, global declarations, or imports.", "Declare the identifier before use or import it from the correct module.");
}
  return 0;
}
  if ((kind == NK_BINARY_EXPR)) {
  resolve_expr(node_get_data2(n), globals, scopes, depth);
  resolve_expr(node_get_data3(n), globals, scopes, depth);
  return 0;
}
  if (((kind == NK_UNARY_EXPR) || (kind == NK_UNWRAP_EXPR))) {
  resolve_expr(node_get_data2(n), globals, scopes, depth);
  if ((kind == NK_UNWRAP_EXPR)) {
  resolve_expr(node_get_data1(n), globals, scopes, depth);
}
  return 0;
}
  if ((kind == NK_CALL_EXPR)) {
  let callee = node_get_data1(n);
  if (((node_kind(callee) == NK_IDENTIFIER) && (() => { const __recv = get_interned_str(node_get_data1(callee)); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "drop") : str_eq(__recv, "drop"); })())) {
  let args = node_get_data2(n);
  if (((() => { const __recv = args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() != 1)) {
  panic_with_code("E_RESOLVE_UNKNOWN_IDENTIFIER", "drop expects exactly one argument", "Built-in drop requires exactly one receiver value.", "Use drop(value) or value.drop() with exactly one receiver value.");
}
  resolve_expr((() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })(), globals, scopes, depth);
  return 0;
}
  if ((((node_kind(callee) == NK_IDENTIFIER) && (() => { const __recv = get_interned_str(node_get_data1(callee)); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "into") : str_eq(__recv, "into"); })()) && (node_get_data3(n) == 1))) {
  let args = node_get_data2(n);
  if (((() => { const __recv = args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() < 1)) {
  panic_with_code("E_RESOLVE_UNKNOWN_IDENTIFIER", "into conversion requires a receiver", "Method-sugar into conversion requires a source value as receiver.", "Use value.into<Contract>(...) with a receiver value.");
}
  let type_args = node_get_data4(n);
  let contract_name = "";
  if ((((() => { const __recv = type_args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() == 1) && (node_kind((() => { const __recv = type_args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })()) == NK_NAMED_TYPE))) {
  contract_name = get_interned_str(node_get_data1((() => { const __recv = type_args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })()));
}
  if (((() => { const __recv = contract_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "") : str_eq(__recv, ""); })() || (!(() => { const __recv = globals; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, contract_name) : set_has(__recv, contract_name); })()))) {
  panic_with_code("E_RESOLVE_UNKNOWN_IDENTIFIER", (() => { const __recv = (() => { const __recv = "Unknown contract '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (((() => { const __recv = contract_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "") : str_eq(__recv, ""); })()) ? (() => {
  return "<missing>";
})() : (() => {
  return contract_name;
})())) : str_concat(__recv, (((() => { const __recv = contract_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "") : str_eq(__recv, ""); })()) ? (() => {
  return "<missing>";
})() : (() => {
  return contract_name;
})())); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "'") : str_concat(__recv, "'"); })(), "An into conversion referenced a contract that is not declared in scope.", "Use value.into<Contract>(...) with a declared contract name.");
}
  resolve_expr((() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })(), globals, scopes, depth);
  let i = 1;
  let len = (() => { const __recv = args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  resolve_expr((() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(), globals, scopes, depth);
  i = (i + 1);
}
  return 0;
}
  resolve_expr(node_get_data1(n), globals, scopes, depth);
  let args = node_get_data2(n);
  let i = 0;
  let len = (() => { const __recv = args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  resolve_expr((() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(), globals, scopes, depth);
  i = (i + 1);
}
  return 0;
}
  if ((kind == NK_MEMBER_EXPR)) {
  resolve_expr(node_get_data1(n), globals, scopes, depth);
  return 0;
}
  if ((kind == NK_INDEX_EXPR)) {
  resolve_expr(node_get_data1(n), globals, scopes, depth);
  resolve_expr(node_get_data2(n), globals, scopes, depth);
  return 0;
}
  if ((kind == NK_STRUCT_INIT)) {
  let type_name = get_interned_str(node_get_data1(n));
  if ((!(() => { const __recv = globals; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, type_name) : set_has(__recv, type_name); })())) {
  panic_with_code("E_RESOLVE_UNKNOWN_STRUCT", (() => { const __recv = "Unknown struct/type in initializer: "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, type_name) : str_concat(__recv, type_name); })(), "A struct initializer referenced a type that is not declared in the merged module scope.", "Declare the struct/type first or import the module that defines it.");
}
  let fields = node_get_data2(n);
  let i = 0;
  let len = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let field = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  resolve_expr((() => { const __recv = field; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })(), globals, scopes, depth);
  i = (i + 1);
}
  return 0;
}
  if ((kind == NK_IF_EXPR)) {
  resolve_expr(node_get_data1(n), globals, scopes, depth);
  resolve_stmt(node_get_data2(n), globals, scopes, depth);
  if ((node_get_data3(n) != 0)) {
  resolve_stmt(node_get_data3(n), globals, scopes, depth);
}
  return 0;
}
  if ((kind == NK_MATCH_EXPR)) {
  resolve_expr(node_get_data1(n), globals, scopes, depth);
  let cases = node_get_data2(n);
  let i = 0;
  let len = (() => { const __recv = cases; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let case_node = (() => { const __recv = cases; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let pat = (() => { const __recv = case_node; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })();
  let body = (() => { const __recv = case_node; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })();
  let next_depth = (depth + 1);
  (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, set_new()) : vec_push(__recv, set_new()); })();
  if ((node_kind(pat) == NK_STRUCT_PAT)) {
  let fields = node_get_data2(pat);
  let j = 0;
  let fLen = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((j < fLen)) {
  scope_define(scopes, next_depth, get_interned_str((() => { const __recv = fields; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, j) : vec_get(__recv, j); })()));
  j = (j + 1);
}
} else { if ((node_kind(pat) == NK_NAME_PAT)) {
  let pat_name = get_interned_str(node_get_data1(pat));
  if ((!(() => { const __recv = globals; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, pat_name) : set_has(__recv, pat_name); })())) {
  scope_define(scopes, next_depth, pat_name);
}
} }
  resolve_stmt(body, globals, scopes, next_depth);
  (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_pop; return __dyn ? __dyn(__recv.ref) : vec_pop(__recv); })();
  i = (i + 1);
}
  return 0;
}
  if ((kind == NK_IS_EXPR)) {
  resolve_expr(node_get_data1(n), globals, scopes, depth);
  return 0;
}
  if ((kind == NK_LAMBDA_EXPR)) {
  let next_depth = (depth + 1);
  (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, set_new()) : vec_push(__recv, set_new()); })();
  let params = node_get_data1(n);
  let i = 0;
  let len = (() => { const __recv = params; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let param = (() => { const __recv = params; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  scope_define(scopes, next_depth, get_interned_str((() => { const __recv = param; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })()));
  i = (i + 1);
}
  resolve_stmt(node_get_data2(n), globals, scopes, next_depth);
  (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_pop; return __dyn ? __dyn(__recv.ref) : vec_pop(__recv); })();
  return 0;
}
  if ((kind == NK_FN_EXPR)) {
  let next_depth = (depth + 1);
  (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, set_new()) : vec_push(__recv, set_new()); })();
  let fname_idx = node_get_data1(n);
  if ((fname_idx != 0)) {
  scope_define(scopes, next_depth, get_interned_str(fname_idx));
}
  let params = node_get_data3(n);
  let i = 0;
  let len = (() => { const __recv = params; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let param = (() => { const __recv = params; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  scope_define(scopes, next_depth, get_interned_str((() => { const __recv = param; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })()));
  i = (i + 1);
}
  resolve_stmt(node_get_data5(n), globals, scopes, next_depth);
  (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_pop; return __dyn ? __dyn(__recv.ref) : vec_pop(__recv); })();
  return 0;
}
  return 0;
}

function resolve_stmt(n, globals, scopes, depth) {
  if ((n == 0)) {
  return 0;
}
  let kind = node_kind(n);
  if ((kind == NK_BLOCK)) {
  let next_depth = (depth + 1);
  (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, set_new()) : vec_push(__recv, set_new()); })();
  let stmts = node_get_data1(n);
  let i = 0;
  let len = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  resolve_stmt((() => { const __recv = stmts; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(), globals, scopes, next_depth);
  i = (i + 1);
}
  (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_pop; return __dyn ? __dyn(__recv.ref) : vec_pop(__recv); })();
  return 0;
}
  if ((kind == NK_EXPECT_FN_DECL)) {
  return 0;
}
  if ((kind == NK_CONTRACT_DECL)) {
  return 0;
}
  if ((((kind == NK_FN_DECL) || (kind == NK_CLASS_FN_DECL)) || (kind == NK_ACTUAL_FN_DECL))) {
  let fnScopes = vec_new();
  (() => { const __recv = fnScopes; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, set_new()) : vec_push(__recv, set_new()); })();
  let params = node_get_data3(n);
  let i = 0;
  let len = (() => { const __recv = params; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let param = (() => { const __recv = params; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  scope_define(fnScopes, 0, get_interned_str((() => { const __recv = param; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })()));
  resolve_type_lifetimes((() => { const __recv = param; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })());
  i = (i + 1);
}
  resolve_type_lifetimes(node_get_data4(n));
  resolve_stmt(node_get_data5(n), globals, fnScopes, 0);
  return 0;
}
  if ((kind == NK_LET_DECL)) {
  if ((node_get_data2(n) != 0)) {
  resolve_type_lifetimes(node_get_data2(n));
}
  resolve_expr(node_get_data3(n), globals, scopes, depth);
  scope_define(scopes, depth, get_interned_str(node_get_data1(n)));
  return 0;
}
  if ((kind == NK_IMPORT_DECL)) {
  let names = node_get_data1(n);
  let i = 0;
  let len = (() => { const __recv = names; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  scope_define(scopes, depth, get_interned_str((() => { const __recv = names; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })()));
  i = (i + 1);
}
  return 0;
}
  if ((kind == NK_EXPR_STMT)) {
  resolve_expr(node_get_data1(n), globals, scopes, depth);
  return 0;
}
  if ((kind == NK_ASSIGN_STMT)) {
  resolve_expr(node_get_data1(n), globals, scopes, depth);
  resolve_expr(node_get_data2(n), globals, scopes, depth);
  return 0;
}
  if ((kind == NK_RETURN_STMT)) {
  resolve_expr(node_get_data1(n), globals, scopes, depth);
  return 0;
}
  if ((kind == NK_IF_STMT)) {
  resolve_expr(node_get_data1(n), globals, scopes, depth);
  resolve_stmt(node_get_data2(n), globals, scopes, depth);
  if ((node_get_data3(n) != 0)) {
  resolve_stmt(node_get_data3(n), globals, scopes, depth);
}
  return 0;
}
  if ((kind == NK_FOR_STMT)) {
  let next_depth = (depth + 1);
  (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, set_new()) : vec_push(__recv, set_new()); })();
  scope_define(scopes, next_depth, get_interned_str(node_get_data1(n)));
  resolve_expr(node_get_data2(n), globals, scopes, next_depth);
  resolve_expr(node_get_data3(n), globals, scopes, next_depth);
  resolve_stmt(node_get_data4(n), globals, scopes, next_depth);
  (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_pop; return __dyn ? __dyn(__recv.ref) : vec_pop(__recv); })();
  return 0;
}
  if ((kind == NK_WHILE_STMT)) {
  resolve_expr(node_get_data1(n), globals, scopes, depth);
  resolve_stmt(node_get_data2(n), globals, scopes, depth);
  return 0;
}
  if ((kind == NK_LOOP_STMT)) {
  resolve_stmt(node_get_data1(n), globals, scopes, depth);
  return 0;
}
  if ((kind == NK_LIFETIME_STMT)) {
  let next_depth = (depth + 1);
  (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, set_new()) : vec_push(__recv, set_new()); })();
  let lifetime_names = node_get_data1(n);
  let lifetime_scope = set_new();
  let i = 0;
  let len = (() => { const __recv = lifetime_names; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let lname = get_interned_str((() => { const __recv = lifetime_names; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })());
  if ((() => { const __recv = lifetime_scope; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, lname) : set_has(__recv, lname); })()) {
  panic_with_code("E_RESOLVE_DUPLICATE_LIFETIME", (() => { const __recv = (() => { const __recv = "Duplicate lifetime name '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, lname) : str_concat(__recv, lname); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' in lifetime block") : str_concat(__recv, "' in lifetime block"); })(), "A lifetime block contains duplicate lifetime names.", "Use unique lifetime names within a lifetime declaration block.");
}
  (() => { const __recv = lifetime_scope; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, lname) : set_add(__recv, lname); })();
  scope_define(scopes, next_depth, lname);
  i = (i + 1);
}
  (() => { const __recv = resolve_lifetime_scopes; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, lifetime_scope) : vec_push(__recv, lifetime_scope); })();
  resolve_stmt(node_get_data2(n), globals, scopes, next_depth);
  (() => { const __recv = resolve_lifetime_scopes; const __dyn = __recv?.table?.vec_pop; return __dyn ? __dyn(__recv.ref) : vec_pop(__recv); })();
  (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_pop; return __dyn ? __dyn(__recv.ref) : vec_pop(__recv); })();
  return 0;
}
  if ((kind == NK_INTO_STMT)) {
  let cname = get_interned_str(node_get_data1(n));
  if ((!(() => { const __recv = globals; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, cname) : set_has(__recv, cname); })())) {
  panic_with_code("E_RESOLVE_UNKNOWN_IDENTIFIER", (() => { const __recv = "Unknown contract: "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, cname) : str_concat(__recv, cname); })(), "An into statement referenced a contract that is not declared in scope.", "Declare the contract before using 'into'.");
}
  return 0;
}
  resolve_expr(n, globals, scopes, depth);
  return 0;
}

function resolve_names(program) {
  (() => { const __recv = resolve_lifetime_scopes; const __dyn = __recv?.table?.vec_clear; return __dyn ? __dyn(__recv.ref) : vec_clear(__recv); })();
  let globals = set_new();
  let body = node_get_data1(program);
  validate_expect_actual_pairs(body);
  let i = 0;
  let len = (() => { const __recv = body; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let stmt = (() => { const __recv = body; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let kind = node_kind(stmt);
  if (((((((((((((kind == NK_FN_DECL) || (kind == NK_CLASS_FN_DECL)) || (kind == NK_ACTUAL_FN_DECL)) || (kind == NK_STRUCT_DECL)) || (kind == NK_ENUM_DECL)) || (kind == NK_OBJECT_DECL)) || (kind == NK_CONTRACT_DECL)) || (kind == NK_TYPE_ALIAS)) || (kind == NK_LET_DECL)) || (kind == NK_EXTERN_FN_DECL)) || (kind == NK_EXTERN_LET_DECL)) || (kind == NK_EXTERN_TYPE_DECL))) {
  let gname = get_interned_str(node_get_data1(stmt));
  if ((() => { const __recv = globals; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, gname) : set_has(__recv, gname); })()) {
  panic_with_code("E_RESOLVE_SHADOWING", (() => { const __recv = "Variable shadowing/redeclaration is not allowed: "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, gname) : str_concat(__recv, gname); })(), "A global declaration with the same name already exists.", "Rename one of the global declarations or split conflicting declarations into separate modules.");
}
  (() => { const __recv = globals; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, gname) : set_add(__recv, gname); })();
}
  i = (i + 1);
}
  let topScopes = vec_new();
  (() => { const __recv = topScopes; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, set_new()) : vec_push(__recv, set_new()); })();
  i = 0;
  while ((i < len)) {
  resolve_stmt((() => { const __recv = body; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(), globals, topScopes, 0);
  i = (i + 1);
}
  return program;
}

function selfhost_resolver_marker() { return 0; }

function type_name_from_type_node(t) {
  if ((t == 0)) {
  return "Unknown";
}
  let k = node_kind(t);
  if ((k == 40)) {
  return get_interned_str(node_get_data1(t));
}
  if ((k == 41)) {
  let mutable = node_get_data1(t);
  let inner = type_name_from_type_node(node_get_data2(t));
  let move_ptr = node_get_data3(t);
  let life_idx = node_get_data4(t);
  let life_prefix = "";
  if ((life_idx != 0)) {
  life_prefix = (() => { const __recv = get_interned_str(life_idx); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " ") : str_concat(__recv, " "); })();
}
  if ((move_ptr == 1)) {
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = "*"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, life_prefix) : str_concat(__recv, life_prefix); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "move ") : str_concat(__recv, "move "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, inner) : str_concat(__recv, inner); })();
}
  if ((mutable == 1)) {
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = "*"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, life_prefix) : str_concat(__recv, life_prefix); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "mut ") : str_concat(__recv, "mut "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, inner) : str_concat(__recv, inner); })();
}
  return (() => { const __recv = (() => { const __recv = "*"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, life_prefix) : str_concat(__recv, life_prefix); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, inner) : str_concat(__recv, inner); })();
}
  if ((k == 44)) {
  return type_name_from_type_node(node_get_data1(t));
}
  if ((k == 45)) {
  let left = type_name_from_type_node(node_get_data1(t));
  let right = type_name_from_type_node(node_get_data2(t));
  return (() => { const __recv = (() => { const __recv = left; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "|") : str_concat(__recv, "|"); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, right) : str_concat(__recv, right); })();
}
  return "Unknown";
}

function pointer_types_compatible(expected, actual) {
  if ((() => { const __recv = expected; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, actual) : str_eq(__recv, actual); })()) {
  return true;
}
  if ((() => { const __recv = expected; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, "|") : str_includes(__recv, "|"); })()) {
  if ((((() => { const __recv = expected; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, (() => { const __recv = actual; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "|") : str_concat(__recv, "|"); })()) : str_starts_with(__recv, (() => { const __recv = actual; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "|") : str_concat(__recv, "|"); })()); })() || str_ends_with_local(expected, (() => { const __recv = "|"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, actual) : str_concat(__recv, actual); })())) || (() => { const __recv = expected; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, (() => { const __recv = (() => { const __recv = "|"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, actual) : str_concat(__recv, actual); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "|") : str_concat(__recv, "|"); })()) : str_includes(__recv, (() => { const __recv = (() => { const __recv = "|"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, actual) : str_concat(__recv, actual); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "|") : str_concat(__recv, "|"); })()); })())) {
  return true;
}
}
  if (((() => { const __recv = expected; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, "*") : str_starts_with(__recv, "*"); })() && (() => { const __recv = actual; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, "*") : str_starts_with(__recv, "*"); })())) {
  let expected_body = (() => { const __recv = expected; const __dyn = __recv?.table?.str_slice; return __dyn ? __dyn(__recv.ref, 1, (() => { const __recv = expected; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })()) : str_slice(__recv, 1, (() => { const __recv = expected; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })()); })();
  let actual_body = (() => { const __recv = actual; const __dyn = __recv?.table?.str_slice; return __dyn ? __dyn(__recv.ref, 1, (() => { const __recv = actual; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })()) : str_slice(__recv, 1, (() => { const __recv = actual; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })()); })();
  let expected_has_life = (((!(() => { const __recv = expected_body; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, "mut ") : str_starts_with(__recv, "mut "); })()) && (!(() => { const __recv = expected_body; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, "move ") : str_starts_with(__recv, "move "); })())) && (() => { const __recv = expected_body; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, " ") : str_includes(__recv, " "); })());
  let actual_has_life = (((!(() => { const __recv = actual_body; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, "mut ") : str_starts_with(__recv, "mut "); })()) && (!(() => { const __recv = actual_body; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, "move ") : str_starts_with(__recv, "move "); })())) && (() => { const __recv = actual_body; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, " ") : str_includes(__recv, " "); })());
  if (expected_has_life) {
  let i = 0;
  let n = (() => { const __recv = expected_body; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })();
  while (((i < n) && ((() => { const __recv = expected_body; const __dyn = __recv?.table?.str_char_at; return __dyn ? __dyn(__recv.ref, i) : str_char_at(__recv, i); })() != 32))) {
  i = (i + 1);
}
  if ((i < n)) {
  expected_body = (() => { const __recv = expected_body; const __dyn = __recv?.table?.str_slice; return __dyn ? __dyn(__recv.ref, (i + 1), n) : str_slice(__recv, (i + 1), n); })();
}
}
  if (actual_has_life) {
  let j = 0;
  let m = (() => { const __recv = actual_body; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })();
  while (((j < m) && ((() => { const __recv = actual_body; const __dyn = __recv?.table?.str_char_at; return __dyn ? __dyn(__recv.ref, j) : str_char_at(__recv, j); })() != 32))) {
  j = (j + 1);
}
  if ((j < m)) {
  actual_body = (() => { const __recv = actual_body; const __dyn = __recv?.table?.str_slice; return __dyn ? __dyn(__recv.ref, (j + 1), m) : str_slice(__recv, (j + 1), m); })();
}
}
  if (((!(() => { const __recv = expected_body; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, "mut ") : str_starts_with(__recv, "mut "); })()) && (() => { const __recv = actual_body; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, "mut ") : str_starts_with(__recv, "mut "); })())) {
  let expected_inner = expected_body;
  let actual_inner = (() => { const __recv = actual_body; const __dyn = __recv?.table?.str_slice; return __dyn ? __dyn(__recv.ref, 4, (() => { const __recv = actual_body; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })()) : str_slice(__recv, 4, (() => { const __recv = actual_body; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })()); })();
  return (() => { const __recv = expected_inner; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, actual_inner) : str_eq(__recv, actual_inner); })();
}
  if (((() => { const __recv = expected_body; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, "mut ") : str_starts_with(__recv, "mut "); })() && (!(() => { const __recv = actual_body; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, "mut ") : str_starts_with(__recv, "mut "); })()))) {
  return false;
}
  return (() => { const __recv = expected_body; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, actual_body) : str_eq(__recv, actual_body); })();
}
  return false;
}

function str_ends_with_local(s, suffix) {
  let ns = (() => { const __recv = s; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })();
  let nf = (() => { const __recv = suffix; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })();
  if ((nf > ns)) {
  return false;
}
  return (() => { const __recv = (() => { const __recv = s; const __dyn = __recv?.table?.str_slice; return __dyn ? __dyn(__recv.ref, (ns - nf), ns) : str_slice(__recv, (ns - nf), ns); })(); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, suffix) : str_eq(__recv, suffix); })();
}

function is_number_literal_with_suffix(n, suffix) {
  if (((n == 0) || (node_kind(n) != NK_NUMBER_LIT))) {
  return false;
}
  let text = get_interned_str(node_get_data1(n));
  return str_ends_with_local(text, suffix);
}

function is_usize_zero_literal_node(n) {
  if ((!is_number_literal_with_suffix(n, "USize"))) {
  return false;
}
  return (() => { const __recv = get_interned_str(node_get_data1(n)); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "0USize") : str_eq(__recv, "0USize"); })();
}

function is_nullable_pointer_type_name(name) {
  if ((!(() => { const __recv = name; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, "|") : str_includes(__recv, "|"); })())) {
  return false;
}
  if (((() => { const __recv = name; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, "*") : str_starts_with(__recv, "*"); })() && str_ends_with_local(name, "|USize"))) {
  return true;
}
  if (((() => { const __recv = name; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, "USize|*") : str_starts_with(__recv, "USize|*"); })() && (() => { const __recv = name; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, "*") : str_includes(__recv, "*"); })())) {
  return true;
}
  return false;
}

function numeric_types_compatible(expected, actual, rhs) {
  if ((() => { const __recv = expected; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, actual) : str_eq(__recv, actual); })()) {
  return true;
}
  if (((((() => { const __recv = expected; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "USize") : str_eq(__recv, "USize"); })() && (() => { const __recv = actual; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "I32") : str_eq(__recv, "I32"); })()) && (rhs != 0)) && (node_kind(rhs) == NK_NUMBER_LIT))) {
  let lit = get_interned_str(node_get_data1(rhs));
  return (!(() => { const __recv = lit; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, "-") : str_starts_with(__recv, "-"); })());
}
  return false;
}

function is_type_variable_name(name) {
  if (((() => { const __recv = name; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })() != 1)) {
  return false;
}
  let ch = char_code(name);
  return ((ch >= 65) && (ch <= 90));
}

function type_names_compatible(expected, actual, rhs) {
  if (((() => { const __recv = expected; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Unknown") : str_eq(__recv, "Unknown"); })() || (() => { const __recv = actual; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Unknown") : str_eq(__recv, "Unknown"); })())) {
  return true;
}
  if (((() => { const __recv = expected; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "AnyValue") : str_eq(__recv, "AnyValue"); })() || (() => { const __recv = actual; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "AnyValue") : str_eq(__recv, "AnyValue"); })())) {
  return true;
}
  if ((() => { const __recv = expected; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, actual) : str_eq(__recv, actual); })()) {
  return true;
}
  if ((is_type_variable_name(expected) || is_type_variable_name(actual))) {
  return true;
}
  if (pointer_types_compatible(expected, actual)) {
  return true;
}
  if (numeric_types_compatible(expected, actual, rhs)) {
  return true;
}
  return false;
}

function infer_expr_type_name(n, fn_return_types, local_types) {
  if ((n == 0)) {
  return "Unknown";
}
  let kind = node_kind(n);
  if ((kind == 20)) {
  let text = get_interned_str(node_get_data1(n));
  if (str_ends_with_local(text, "USize")) {
  return "USize";
}
  return "I32";
}
  if ((kind == 21)) {
  return "Bool";
}
  if ((kind == 22)) {
  return "*Str";
}
  if ((kind == 23)) {
  return "Char";
}
  if ((kind == 24)) {
  let name = get_interned_str(node_get_data1(n));
  if ((() => { const __recv = local_types; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, name) : map_has(__recv, name); })()) {
  return (() => { const __recv = local_types; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, name) : map_get(__recv, name); })();
}
  if ((() => { const __recv = tc_global_value_types; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, name) : map_has(__recv, name); })()) {
  return (() => { const __recv = tc_global_value_types; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, name) : map_get(__recv, name); })();
}
  return "Unknown";
}
  if ((kind == 26)) {
  let op = get_interned_str(node_get_data1(n));
  let inner = infer_expr_type_name(node_get_data2(n), fn_return_types, local_types);
  if ((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "&") : str_eq(__recv, "&"); })()) {
  return (() => { const __recv = "*"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, inner) : str_concat(__recv, inner); })();
}
  if ((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "&mut") : str_eq(__recv, "&mut"); })()) {
  return (() => { const __recv = "*mut "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, inner) : str_concat(__recv, inner); })();
}
  if ((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "!") : str_eq(__recv, "!"); })()) {
  return "Bool";
}
  return inner;
}
  if ((kind == 25)) {
  let op = get_interned_str(node_get_data1(n));
  if (((((((((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "==") : str_eq(__recv, "=="); })() || (() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "!=") : str_eq(__recv, "!="); })()) || (() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "<") : str_eq(__recv, "<"); })()) || (() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "<=") : str_eq(__recv, "<="); })()) || (() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, ">") : str_eq(__recv, ">"); })()) || (() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, ">=") : str_eq(__recv, ">="); })()) || (() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "&&") : str_eq(__recv, "&&"); })()) || (() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "||") : str_eq(__recv, "||"); })())) {
  return "Bool";
}
  return infer_expr_type_name(node_get_data2(n), fn_return_types, local_types);
}
  if ((kind == 27)) {
  let callee = node_get_data1(n);
  if ((node_kind(callee) == 24)) {
  let fname = get_interned_str(node_get_data1(callee));
  if (((() => { const __recv = fname; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "into") : str_eq(__recv, "into"); })() && (node_get_data3(n) == 1))) {
  let type_args = node_get_data4(n);
  if ((((() => { const __recv = type_args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() == 1) && (node_kind((() => { const __recv = type_args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })()) == NK_NAMED_TYPE))) {
  let cname = get_interned_str(node_get_data1((() => { const __recv = type_args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })()));
  return (() => { const __recv = "__dyn_"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, cname) : str_concat(__recv, cname); })();
}
  return "Unknown";
}
  if ((() => { const __recv = fn_return_types; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, fname) : map_has(__recv, fname); })()) {
  return (() => { const __recv = fn_return_types; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, fname) : map_get(__recv, fname); })();
}
}
}
  return "Unknown";
}

function expr_is_number_literal_nonzero(n) {
  if (((n == 0) || (node_kind(n) != NK_NUMBER_LIT))) {
  return false;
}
  return (!(() => { const __recv = get_interned_str(node_get_data1(n)); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "0") : str_eq(__recv, "0"); })());
}

function is_decimal_digits(s) {
  let i = 0;
  let n = (() => { const __recv = s; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })();
  if ((n == 0)) {
  return false;
}
  while ((i < n)) {
  let ch = (() => { const __recv = s; const __dyn = __recv?.table?.str_char_at; return __dyn ? __dyn(__recv.ref, i) : str_char_at(__recv, i); })();
  if (((ch < 48) || (ch > 57))) {
  return false;
}
  i = (i + 1);
}
  return true;
}

function try_get_decimal_literal_value(n) {
  if (((n == 0) || (node_kind(n) != NK_NUMBER_LIT))) {
  return 0;
}
  let text = get_interned_str(node_get_data1(n));
  if ((!is_decimal_digits(text))) {
  return 0;
}
  return parse_int(text);
}

function is_decimal_zero_literal(n) {
  if (((n == 0) || (node_kind(n) != NK_NUMBER_LIT))) {
  return false;
}
  return (() => { const __recv = get_interned_str(node_get_data1(n)); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "0") : str_eq(__recv, "0"); })();
}

let tc_array_init_bounds = map_new();

let tc_index_upper_bounds = map_new();

let tc_global_value_types = map_new();

let tc_alias_union_tags = map_new();

let tc_type_alias_names = set_new();

let tc_contract_names = set_new();

let tc_destructor_alias_by_alias = map_new();

let tc_destructor_alias_names = vec_new();

function type_node_is_move_pointer_to_alias(t, alias_name) {
  if (((t == 0) || (node_kind(t) != NK_POINTER_TYPE))) {
  return false;
}
  if ((node_get_data3(t) != 1)) {
  return false;
}
  return (() => { const __recv = type_name_from_type_node(node_get_data2(t)); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, alias_name) : str_eq(__recv, alias_name); })();
}

function collect_union_named_tags(type_node, tags) {
  if ((type_node == 0)) {
  return 0;
}
  let kind = node_kind(type_node);
  if ((kind == NK_UNION_TYPE)) {
  collect_union_named_tags(node_get_data1(type_node), tags);
  collect_union_named_tags(node_get_data2(type_node), tags);
  return 0;
}
  if ((kind == NK_NAMED_TYPE)) {
  (() => { const __recv = tags; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(type_node))) : vec_push(__recv, get_interned_str(node_get_data1(type_node))); })();
  return 0;
}
  if ((kind == NK_REFINEMENT_TYPE)) {
  collect_union_named_tags(node_get_data1(type_node), tags);
}
  return 0;
}

function try_get_nonnegative_integer_literal(n) {
  if (((n == 0) || (node_kind(n) != NK_NUMBER_LIT))) {
  return (-1);
}
  let text = get_interned_str(node_get_data1(n));
  if (str_ends_with_local(text, "USize")) {
  let len = (() => { const __recv = text; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })();
  let raw = (() => { const __recv = text; const __dyn = __recv?.table?.str_slice; return __dyn ? __dyn(__recv.ref, 0, (len - 5)) : str_slice(__recv, 0, (len - 5)); })();
  if ((!is_decimal_digits(raw))) {
  return (-1);
}
  return parse_int(raw);
}
  if ((!is_decimal_digits(text))) {
  return (-1);
}
  return parse_int(text);
}

function try_get_array_init_bound_from_type_node(t) {
  if ((t == 0)) {
  return (-1);
}
  let k = node_kind(t);
  if ((k == NK_REFINEMENT_TYPE)) {
  return try_get_array_init_bound_from_type_node(node_get_data1(t));
}
  if ((k == NK_POINTER_TYPE)) {
  return try_get_array_init_bound_from_type_node(node_get_data2(t));
}
  if ((k == NK_ARRAY_TYPE)) {
  return try_get_nonnegative_integer_literal(node_get_data2(t));
}
  return (-1);
}

function try_get_index_upper_bound_from_type_node(t) {
  if (((t == 0) || (node_kind(t) != NK_REFINEMENT_TYPE))) {
  return (-1);
}
  let base = node_get_data1(t);
  if (((base == 0) || (node_kind(base) != NK_NAMED_TYPE))) {
  return (-1);
}
  let base_name = get_interned_str(node_get_data1(base));
  if ((!(() => { const __recv = base_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "USize") : str_eq(__recv, "USize"); })())) {
  return (-1);
}
  let lit = try_get_nonnegative_integer_literal(node_get_data3(t));
  if ((lit < 0)) {
  return (-1);
}
  let op = get_interned_str(node_get_data2(t));
  if ((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "<") : str_eq(__recv, "<"); })()) {
  return (lit - 1);
}
  if ((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "<=") : str_eq(__recv, "<="); })()) {
  return lit;
}
  return (-1);
}

function is_zero_numeric_literal_node(n) {
  if (((n == 0) || (node_kind(n) != NK_NUMBER_LIT))) {
  return false;
}
  let text = get_interned_str(node_get_data1(n));
  return ((() => { const __recv = text; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "0") : str_eq(__recv, "0"); })() || (() => { const __recv = text; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "0USize") : str_eq(__recv, "0USize"); })());
}

function expr_is_proven_nonzero(n, nonnull_ptrs) {
  if (expr_is_number_literal_nonzero(n)) {
  return true;
}
  if (((n != 0) && (node_kind(n) == NK_IDENTIFIER))) {
  let name = get_interned_str(node_get_data1(n));
  return (() => { const __recv = nonnull_ptrs; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, name) : map_has(__recv, name); })();
}
  return false;
}

function type_node_proves_nonzero(t) {
  if (((t == 0) || (node_kind(t) != NK_REFINEMENT_TYPE))) {
  return false;
}
  let op = get_interned_str(node_get_data2(t));
  if ((!(() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "!=") : str_eq(__recv, "!="); })())) {
  return false;
}
  return is_zero_numeric_literal_node(node_get_data3(t));
}

function typecheck_expr(n, fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety) {
  if ((n == 0)) {
  return 0;
}
  let kind = node_kind(n);
  if ((kind == NK_BINARY_EXPR)) {
  typecheck_expr(node_get_data2(n), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  typecheck_expr(node_get_data3(n), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  let op = get_interned_str(node_get_data1(n));
  if (((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "/") : str_eq(__recv, "/"); })() && (!expr_is_proven_nonzero(node_get_data3(n), nonnull_ptrs)))) {
  panic_with_code("E_SAFETY_DIV_BY_ZERO", "Division by zero cannot be ruled out at compile time", "The denominator is not proven non-zero under safety checks.", "Prove denominator != 0 via refinement type or control-flow guard.");
}
  if (((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "%") : str_eq(__recv, "%"); })() && (!expr_is_proven_nonzero(node_get_data3(n), nonnull_ptrs)))) {
  panic_with_code("E_SAFETY_MOD_BY_ZERO", "Modulo by zero cannot be ruled out at compile time", "The modulo denominator is not proven non-zero under safety checks.", "Prove denominator != 0 via refinement type or control-flow guard.");
}
  if ((((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "+") : str_eq(__recv, "+"); })() || (() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "-") : str_eq(__recv, "-"); })()) || (() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "*") : str_eq(__recv, "*"); })())) {
  let lnode = node_get_data2(n);
  let rnode = node_get_data3(n);
  let left = try_get_decimal_literal_value(lnode);
  let right = try_get_decimal_literal_value(rnode);
  if (((left != 0) || is_decimal_zero_literal(lnode))) {
  if (((right != 0) || is_decimal_zero_literal(rnode))) {
  let result = 0;
  if ((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "+") : str_eq(__recv, "+"); })()) {
  result = (left + right);
} else { if ((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "-") : str_eq(__recv, "-"); })()) {
  result = (left - right);
} else {
  result = (left * right);
} }
  if (((result < (-2147483648)) || (result > 2147483647))) {
  panic_with_code("E_SAFETY_OVERFLOW", (() => { const __recv = (() => { const __recv = "Integer overflow/underflow proven possible for '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, op) : str_concat(__recv, op); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "'") : str_concat(__recv, "'"); })(), "Arithmetic is proven to exceed I32 range under safety checks.", "Constrain operands or use a wider intermediate type before narrowing.");
}
}
}
}
  return 0;
}
  if (((kind == NK_UNARY_EXPR) || (kind == NK_UNWRAP_EXPR))) {
  if ((kind == NK_UNARY_EXPR)) {
  typecheck_expr(node_get_data2(n), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
} else {
  typecheck_expr(node_get_data1(n), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
}
  return 0;
}
  if ((kind == NK_CALL_EXPR)) {
  let callee = node_get_data1(n);
  let args = node_get_data2(n);
  let arg_count = (() => { const __recv = args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  let fname = "";
  if ((node_kind(callee) == NK_IDENTIFIER)) {
  fname = get_interned_str(node_get_data1(callee));
  if ((() => { const __recv = fname; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "drop") : str_eq(__recv, "drop"); })()) {
  if ((arg_count != 1)) {
  panic_with_code("E_TYPE_ARG_COUNT", "drop expects exactly one argument", "The drop builtin requires one argument representing the value to drop.", "Call drop(value) with exactly one argument.");
}
  let target = (() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })();
  let target_name = infer_expr_type_name(target, fn_return_types, local_types);
  if ((!(() => { const __recv = tc_destructor_alias_by_alias; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, target_name) : map_has(__recv, target_name); })())) {
  panic_with_code("E_TYPE_DESTRUCTOR_NOT_FOUND", (() => { const __recv = (() => { const __recv = "Type '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, target_name) : str_concat(__recv, target_name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' does not have an associated destructor") : str_concat(__recv, "' does not have an associated destructor"); })(), "drop can only be called for values whose alias type declares a destructor.", "Define `type Alias = Base then destructorName;` and use that alias for dropped values.");
}
  return 0;
}
  if (((() => { const __recv = fname; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "into") : str_eq(__recv, "into"); })() && (node_get_data3(n) == 1))) {
  if ((arg_count < 1)) {
  panic_with_code("E_TYPE_ARG_COUNT", "into conversion requires a receiver", "Method-sugar into conversion requires a source value as receiver.", "Use value.into<Contract>(...) with a receiver value.");
}
  let type_args = node_get_data4(n);
  let cname = "";
  if ((((() => { const __recv = type_args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() == 1) && (node_kind((() => { const __recv = type_args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })()) == NK_NAMED_TYPE))) {
  cname = get_interned_str(node_get_data1((() => { const __recv = type_args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })()));
}
  if (((() => { const __recv = cname; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "") : str_eq(__recv, ""); })() || (!(() => { const __recv = tc_contract_names; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, cname) : set_has(__recv, cname); })()))) {
  panic_with_code("E_TYPE_INTO_UNKNOWN_CONTRACT", (() => { const __recv = (() => { const __recv = "Unknown contract '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (((() => { const __recv = cname; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "") : str_eq(__recv, ""); })()) ? (() => {
  return "<missing>";
})() : (() => {
  return cname;
})())) : str_concat(__recv, (((() => { const __recv = cname; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "") : str_eq(__recv, ""); })()) ? (() => {
  return "<missing>";
})() : (() => {
  return cname;
})())); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' in into conversion") : str_concat(__recv, "' in into conversion"); })(), "An into conversion referenced a contract that is not declared.", "Declare the contract before converting with into.");
}
  typecheck_expr((() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })(), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  let j = 1;
  while ((j < arg_count)) {
  typecheck_expr((() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, j) : vec_get(__recv, j); })(), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  j = (j + 1);
}
  return 0;
}
  if ((() => { const __recv = fn_arities; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, fname) : map_has(__recv, fname); })()) {
  let expected = (() => { const __recv = fn_arities; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, fname) : map_get(__recv, fname); })();
  if ((expected != arg_count)) {
  let msg = (() => { const __recv = (() => { const __recv = (() => { const __recv = "Function "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, fname) : str_concat(__recv, fname); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = " expects "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(expected)) : str_concat(__recv, int_to_string(expected)); })()) : str_concat(__recv, (() => { const __recv = " expects "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(expected)) : str_concat(__recv, int_to_string(expected)); })()); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = " args, got "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(arg_count)) : str_concat(__recv, int_to_string(arg_count)); })()) : str_concat(__recv, (() => { const __recv = " args, got "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(arg_count)) : str_concat(__recv, int_to_string(arg_count)); })()); })();
  panic_with_code("E_TYPE_ARG_COUNT", msg, "A function call provided a different number of arguments than the function signature requires.", "Pass exactly the number of parameters declared by the function.");
}
}
  if ((() => { const __recv = fn_param_types; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, fname) : map_has(__recv, fname); })()) {
  let expected_types = (() => { const __recv = fn_param_types; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, fname) : map_get(__recv, fname); })();
  let j = 0;
  while ((j < arg_count)) {
  let arg_node = (() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, j) : vec_get(__recv, j); })();
  let arg_name = infer_expr_type_name(arg_node, fn_return_types, local_types);
  let expected_name = (() => { const __recv = expected_types; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, j) : vec_get(__recv, j); })();
  if (((() => { const __recv = expected_name; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, "*") : str_starts_with(__recv, "*"); })() && is_nullable_pointer_type_name(arg_name))) {
  panic_with_code("E_SAFETY_NULLABLE_POINTER_GUARD", "Call requires nullable pointer guard", "A nullable pointer argument must be proven non-null before pointer-consuming calls.", "Guard pointer use with if (p != 0USize) or if (0USize != p) before the call.");
}
  if ((!type_names_compatible(expected_name, arg_name, arg_node))) {
  let msg = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "Type mismatch in call to "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, fname) : str_concat(__recv, fname); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " arg ") : str_concat(__recv, " arg "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string((j + 1))) : str_concat(__recv, int_to_string((j + 1))); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ": expected ") : str_concat(__recv, ": expected "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, expected_name) : str_concat(__recv, expected_name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ", got ") : str_concat(__recv, ", got "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, arg_name) : str_concat(__recv, arg_name); })();
  panic_with_code("E_TYPE_ARG_MISMATCH", msg, "A function argument type does not match the corresponding parameter type.", "Update the call argument or function parameter type so both sides are compatible.");
}
  j = (j + 1);
}
}
}
  typecheck_expr(callee, fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  let i = 0;
  while ((i < arg_count)) {
  typecheck_expr((() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  i = (i + 1);
}
  return 0;
}
  if ((kind == NK_MEMBER_EXPR)) {
  let obj = node_get_data1(n);
  let obj_name = infer_expr_type_name(obj, fn_return_types, local_types);
  if (is_nullable_pointer_type_name(obj_name)) {
  let guarded = false;
  if ((node_kind(obj) == NK_IDENTIFIER)) {
  let oname = get_interned_str(node_get_data1(obj));
  guarded = (() => { const __recv = nonnull_ptrs; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, oname) : map_has(__recv, oname); })();
}
  if ((!guarded)) {
  panic_with_code("E_SAFETY_NULLABLE_POINTER_GUARD", "Nullable pointer access requires guard", "A nullable pointer must be proven non-null before pointer-consuming operations.", "Guard with if (p != 0USize) or if (0USize != p) before member access.");
}
}
  typecheck_expr(node_get_data1(n), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  return 0;
}
  if ((kind == NK_INDEX_EXPR)) {
  let target_node = node_get_data1(n);
  let target_name = infer_expr_type_name(target_node, fn_return_types, local_types);
  if (is_nullable_pointer_type_name(target_name)) {
  let guarded = false;
  if ((node_kind(target_node) == NK_IDENTIFIER)) {
  let tname = get_interned_str(node_get_data1(target_node));
  guarded = (() => { const __recv = nonnull_ptrs; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, tname) : map_has(__recv, tname); })();
}
  if ((!guarded)) {
  panic_with_code("E_SAFETY_NULLABLE_POINTER_GUARD", "Nullable pointer indexing requires guard", "A nullable pointer must be proven non-null before pointer-consuming operations.", "Guard with if (p != 0USize) or if (0USize != p) before indexing.");
}
}
  if (((strict_safety == 1) && (node_kind(target_node) == NK_IDENTIFIER))) {
  let tname = get_interned_str(node_get_data1(target_node));
  if ((() => { const __recv = tc_array_init_bounds; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, tname) : map_has(__recv, tname); })()) {
  let bound = (() => { const __recv = tc_array_init_bounds; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, tname) : map_get(__recv, tname); })();
  if ((bound >= 0)) {
  let index_node = node_get_data2(n);
  let index_max = (-1);
  if ((node_kind(index_node) == NK_IDENTIFIER)) {
  let iname = get_interned_str(node_get_data1(index_node));
  if ((() => { const __recv = tc_index_upper_bounds; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, iname) : map_has(__recv, iname); })()) {
  index_max = (() => { const __recv = tc_index_upper_bounds; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, iname) : map_get(__recv, iname); })();
}
}
  if ((index_max < 0)) {
  index_max = try_get_nonnegative_integer_literal(index_node);
}
  if ((index_max < 0)) {
  panic_with_code("E_SAFETY_ARRAY_BOUNDS_UNPROVEN", "Cannot prove array index bound safety", "The array index does not have a proven upper bound under strict safety checks.", "Guard index with 'if (i < arr.length)' before indexing.");
}
  if ((index_max >= bound)) {
  panic_with_code("E_SAFETY_ARRAY_BOUNDS", "Array index may be out of bounds", "The proven index upper bound can exceed initialized array length.", "Ensure 0 <= index < initialized length.");
}
}
}
}
  typecheck_expr(node_get_data1(n), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  typecheck_expr(node_get_data2(n), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  return 0;
}
  if ((kind == NK_STRUCT_INIT)) {
  let fields = node_get_data2(n);
  let i = 0;
  let len = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let field = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  typecheck_expr((() => { const __recv = field; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })(), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  i = (i + 1);
}
  return 0;
}
  if ((kind == NK_IF_EXPR)) {
  let cond = node_get_data1(n);
  typecheck_expr(cond, fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  let cond_name = infer_expr_type_name(cond, fn_return_types, local_types);
  if (((!(() => { const __recv = cond_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Bool") : str_eq(__recv, "Bool"); })()) && (!(() => { const __recv = cond_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Unknown") : str_eq(__recv, "Unknown"); })()))) {
  panic_with_code("E_TYPE_IF_CONDITION", "if condition must be Bool", "Conditional branches require a boolean predicate.", "Return or compute a Bool expression in the if condition.");
}
  typecheck_stmt(node_get_data2(n), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety, "Unknown");
  if ((node_get_data3(n) != 0)) {
  typecheck_stmt(node_get_data3(n), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety, "Unknown");
}
  return 0;
}
  if ((kind == NK_MATCH_EXPR)) {
  let target = node_get_data1(n);
  typecheck_expr(target, fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  let target_name = infer_expr_type_name(target, fn_return_types, local_types);
  let expected_tags = vec_new();
  if ((() => { const __recv = tc_alias_union_tags; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, target_name) : map_has(__recv, target_name); })()) {
  expected_tags = (() => { const __recv = tc_alias_union_tags; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, target_name) : map_get(__recv, target_name); })();
}
  let cases = node_get_data2(n);
  let i = 0;
  let len = (() => { const __recv = cases; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  let seen_tags = set_new();
  let has_wildcard = false;
  while ((i < len)) {
  let case_node = (() => { const __recv = cases; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let pat = (() => { const __recv = case_node; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })();
  if ((node_kind(pat) == NK_WILDCARD_PAT)) {
  has_wildcard = true;
}
  if (((node_kind(pat) == NK_NAME_PAT) || (node_kind(pat) == NK_STRUCT_PAT))) {
  (() => { const __recv = seen_tags; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(pat))) : set_add(__recv, get_interned_str(node_get_data1(pat))); })();
}
  typecheck_stmt((() => { const __recv = case_node; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })(), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety, "Unknown");
  i = (i + 1);
}
  if ((((strict_safety == 1) && ((() => { const __recv = expected_tags; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() > 0)) && (!has_wildcard))) {
  let j = 0;
  let jlen = (() => { const __recv = expected_tags; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((j < jlen)) {
  let tag = (() => { const __recv = expected_tags; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, j) : vec_get(__recv, j); })();
  if ((!(() => { const __recv = seen_tags; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, tag) : set_has(__recv, tag); })())) {
  panic_with_code("E_MATCH_NON_EXHAUSTIVE", (() => { const __recv = "Non-exhaustive match: missing case for "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, tag) : str_concat(__recv, tag); })(), "A match expression over a known union type does not handle all variants.", "Add missing case arms or include a wildcard case '_'.");
}
  j = (j + 1);
}
}
  return 0;
}
  if ((kind == NK_IS_EXPR)) {
  typecheck_expr(node_get_data1(n), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  return 0;
}
  return 0;
}

function typecheck_stmt(n, fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety, expected_return_type) {
  if ((n == 0)) {
  return 0;
}
  let kind = node_kind(n);
  if ((kind == NK_BLOCK)) {
  let stmts = node_get_data1(n);
  let i = 0;
  let len = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  typecheck_stmt((() => { const __recv = stmts; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety, expected_return_type);
  i = (i + 1);
}
  return 0;
}
  if ((kind == NK_EXPECT_FN_DECL)) {
  return 0;
}
  if ((kind == NK_CONTRACT_DECL)) {
  return 0;
}
  if ((((kind == NK_FN_DECL) || (kind == NK_CLASS_FN_DECL)) || (kind == NK_ACTUAL_FN_DECL))) {
  let prev_array_bounds = tc_array_init_bounds;
  let prev_index_bounds = tc_index_upper_bounds;
  tc_array_init_bounds = map_new();
  tc_index_upper_bounds = map_new();
  let fn_local_types = map_new();
  let fn_nonnull_ptrs = map_new();
  let params = node_get_data3(n);
  let i = 0;
  let len = (() => { const __recv = params; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let p = (() => { const __recv = params; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let pname = get_interned_str((() => { const __recv = p; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })());
  let ptype = (() => { const __recv = p; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })();
  if ((ptype != 0)) {
  (() => { const __recv = fn_local_types; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, pname, type_name_from_type_node(ptype)) : map_set(__recv, pname, type_name_from_type_node(ptype)); })();
  let arr_init_bound = try_get_array_init_bound_from_type_node(ptype);
  if ((arr_init_bound >= 0)) {
  (() => { const __recv = tc_array_init_bounds; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, pname, arr_init_bound) : map_set(__recv, pname, arr_init_bound); })();
}
  let index_upper_bound = try_get_index_upper_bound_from_type_node(ptype);
  if ((index_upper_bound >= 0)) {
  (() => { const __recv = tc_index_upper_bounds; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, pname, index_upper_bound) : map_set(__recv, pname, index_upper_bound); })();
}
  if (type_node_proves_nonzero(ptype)) {
  (() => { const __recv = fn_nonnull_ptrs; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, pname, 1) : map_set(__recv, pname, 1); })();
}
}
  i = (i + 1);
}
  let expected_name = type_name_from_type_node(node_get_data4(n));
  typecheck_stmt(node_get_data5(n), fn_arities, fn_param_types, fn_return_types, fn_local_types, fn_nonnull_ptrs, strict_safety, expected_name);
  let body = node_get_data5(n);
  if ((node_kind(body) != NK_BLOCK)) {
  let body_name = infer_expr_type_name(body, fn_return_types, fn_local_types);
  if ((!type_names_compatible(expected_name, body_name, body))) {
  let fname = get_interned_str(node_get_data1(n));
  panic_with_code("E_TYPE_RETURN_MISMATCH", (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "Function "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, fname) : str_concat(__recv, fname); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " return type mismatch: expected ") : str_concat(__recv, " return type mismatch: expected "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, expected_name) : str_concat(__recv, expected_name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ", got ") : str_concat(__recv, ", got "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, body_name) : str_concat(__recv, body_name); })(), "The function body expression type does not match the declared return type.", "Update the function return type annotation or adjust the returned expression.");
}
}
  tc_array_init_bounds = prev_array_bounds;
  tc_index_upper_bounds = prev_index_bounds;
  return 0;
}
  if ((kind == NK_LET_DECL)) {
  let declared_type = node_get_data2(n);
  let rhs = node_get_data3(n);
  typecheck_expr(rhs, fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  let rhs_name = infer_expr_type_name(rhs, fn_return_types, local_types);
  if ((declared_type != 0)) {
  let declared_name = type_name_from_type_node(declared_type);
  if ((((((!(() => { const __recv = declared_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Unknown") : str_eq(__recv, "Unknown"); })()) && (!(() => { const __recv = rhs_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Unknown") : str_eq(__recv, "Unknown"); })())) && (!pointer_types_compatible(declared_name, rhs_name))) && (!numeric_types_compatible(declared_name, rhs_name, rhs))) && (!(() => { const __recv = tc_type_alias_names; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, declared_name) : set_has(__recv, declared_name); })()))) {
  let vname = get_interned_str(node_get_data1(n));
  let msg = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "Type mismatch for let "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, vname) : str_concat(__recv, vname); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ": expected ") : str_concat(__recv, ": expected "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, declared_name) : str_concat(__recv, declared_name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ", got ") : str_concat(__recv, ", got "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, rhs_name) : str_concat(__recv, rhs_name); })();
  panic_with_code("E_TYPE_LET_MISMATCH", msg, "An explicit let type annotation does not match the assigned RHS expression type.", "Update the explicit type annotation or change the RHS expression to match.");
}
  let lname = get_interned_str(node_get_data1(n));
  (() => { const __recv = local_types; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, lname, declared_name) : map_set(__recv, lname, declared_name); })();
  let arr_init_bound = try_get_array_init_bound_from_type_node(declared_type);
  if ((arr_init_bound >= 0)) {
  (() => { const __recv = tc_array_init_bounds; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, lname, arr_init_bound) : map_set(__recv, lname, arr_init_bound); })();
}
  let index_upper_bound = try_get_index_upper_bound_from_type_node(declared_type);
  if ((index_upper_bound >= 0)) {
  (() => { const __recv = tc_index_upper_bounds; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, lname, index_upper_bound) : map_set(__recv, lname, index_upper_bound); })();
}
} else { if ((!(() => { const __recv = rhs_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Unknown") : str_eq(__recv, "Unknown"); })())) {
  (() => { const __recv = local_types; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(n)), rhs_name) : map_set(__recv, get_interned_str(node_get_data1(n)), rhs_name); })();
} }
  return 0;
}
  if ((kind == NK_EXPR_STMT)) {
  typecheck_expr(node_get_data1(n), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  return 0;
}
  if ((kind == NK_ASSIGN_STMT)) {
  let target = node_get_data1(n);
  let value = node_get_data2(n);
  typecheck_expr(target, fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  typecheck_expr(value, fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  if ((node_kind(target) == NK_IDENTIFIER)) {
  let tname = get_interned_str(node_get_data1(target));
  if ((() => { const __recv = local_types; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, tname) : map_has(__recv, tname); })()) {
  let expected_name = (() => { const __recv = local_types; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, tname) : map_get(__recv, tname); })();
  let value_name = infer_expr_type_name(value, fn_return_types, local_types);
  if (((!type_names_compatible(expected_name, value_name, value)) && (!(() => { const __recv = tc_type_alias_names; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, expected_name) : set_has(__recv, expected_name); })()))) {
  panic_with_code("E_TYPE_ASSIGN_MISMATCH", (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "Assignment mismatch for "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, tname) : str_concat(__recv, tname); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ": expected ") : str_concat(__recv, ": expected "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, expected_name) : str_concat(__recv, expected_name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ", got ") : str_concat(__recv, ", got "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, value_name) : str_concat(__recv, value_name); })(), "The assigned value type is incompatible with the declared variable type.", "Assign a compatible value or change the variable type declaration.");
}
}
}
  return 0;
}
  if ((kind == NK_RETURN_STMT)) {
  let value = node_get_data1(n);
  typecheck_expr(value, fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  if ((!(() => { const __recv = expected_return_type; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Unknown") : str_eq(__recv, "Unknown"); })())) {
  let value_name = infer_expr_type_name(value, fn_return_types, local_types);
  if ((!type_names_compatible(expected_return_type, value_name, value))) {
  panic_with_code("E_TYPE_RETURN_MISMATCH", (() => { const __recv = (() => { const __recv = (() => { const __recv = "Return type mismatch: expected "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, expected_return_type) : str_concat(__recv, expected_return_type); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ", got ") : str_concat(__recv, ", got "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, value_name) : str_concat(__recv, value_name); })(), "A return statement produced a value incompatible with the function's declared return type.", "Return a value of the declared type or adjust the function return annotation.");
}
}
  return 0;
}
  if ((kind == NK_IF_STMT)) {
  let cond = node_get_data1(n);
  typecheck_expr(cond, fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  let cond_name = infer_expr_type_name(cond, fn_return_types, local_types);
  if (((!(() => { const __recv = cond_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Bool") : str_eq(__recv, "Bool"); })()) && (!(() => { const __recv = cond_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Unknown") : str_eq(__recv, "Unknown"); })()))) {
  panic_with_code("E_TYPE_IF_CONDITION", "if condition must be Bool", "Conditional branches require a boolean predicate.", "Return or compute a Bool expression in the if condition.");
}
  let then_nonnull = map_new();
  let else_nonnull = map_new();
  let copied_then = false;
  let copied_else = false;
  if ((node_kind(cond) == NK_BINARY_EXPR)) {
  let op = get_interned_str(node_get_data1(cond));
  let left = node_get_data2(cond);
  let right = node_get_data3(cond);
  if ((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "!=") : str_eq(__recv, "!="); })()) {
  if (((node_kind(left) == NK_IDENTIFIER) && is_usize_zero_literal_node(right))) {
  (() => { const __recv = then_nonnull; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(left)), 1) : map_set(__recv, get_interned_str(node_get_data1(left)), 1); })();
  copied_then = true;
}
  if (((node_kind(right) == NK_IDENTIFIER) && is_usize_zero_literal_node(left))) {
  (() => { const __recv = then_nonnull; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(right)), 1) : map_set(__recv, get_interned_str(node_get_data1(right)), 1); })();
  copied_then = true;
}
  if (((node_kind(left) == NK_IDENTIFIER) && is_zero_numeric_literal_node(right))) {
  (() => { const __recv = then_nonnull; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(left)), 1) : map_set(__recv, get_interned_str(node_get_data1(left)), 1); })();
  copied_then = true;
}
  if (((node_kind(right) == NK_IDENTIFIER) && is_zero_numeric_literal_node(left))) {
  (() => { const __recv = then_nonnull; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(right)), 1) : map_set(__recv, get_interned_str(node_get_data1(right)), 1); })();
  copied_then = true;
}
}
  if ((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "==") : str_eq(__recv, "=="); })()) {
  if (((node_kind(left) == NK_IDENTIFIER) && is_zero_numeric_literal_node(right))) {
  (() => { const __recv = else_nonnull; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(left)), 1) : map_set(__recv, get_interned_str(node_get_data1(left)), 1); })();
  copied_else = true;
}
  if (((node_kind(right) == NK_IDENTIFIER) && is_zero_numeric_literal_node(left))) {
  (() => { const __recv = else_nonnull; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(right)), 1) : map_set(__recv, get_interned_str(node_get_data1(right)), 1); })();
  copied_else = true;
}
}
}
  if ((!copied_then)) {
  then_nonnull = nonnull_ptrs;
}
  if ((!copied_else)) {
  else_nonnull = nonnull_ptrs;
}
  typecheck_stmt(node_get_data2(n), fn_arities, fn_param_types, fn_return_types, local_types, then_nonnull, strict_safety, expected_return_type);
  if ((node_get_data3(n) != 0)) {
  typecheck_stmt(node_get_data3(n), fn_arities, fn_param_types, fn_return_types, local_types, else_nonnull, strict_safety, expected_return_type);
}
  return 0;
}
  if ((kind == NK_FOR_STMT)) {
  typecheck_expr(node_get_data2(n), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  typecheck_expr(node_get_data3(n), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  typecheck_stmt(node_get_data4(n), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety, expected_return_type);
  return 0;
}
  if ((kind == NK_WHILE_STMT)) {
  let cond = node_get_data1(n);
  typecheck_expr(cond, fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  let cond_name = infer_expr_type_name(cond, fn_return_types, local_types);
  if (((!(() => { const __recv = cond_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Bool") : str_eq(__recv, "Bool"); })()) && (!(() => { const __recv = cond_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Unknown") : str_eq(__recv, "Unknown"); })()))) {
  panic_with_code("E_TYPE_IF_CONDITION", "if condition must be Bool", "Conditional branches require a boolean predicate.", "Return or compute a Bool expression in the condition.");
}
  typecheck_stmt(node_get_data2(n), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety, expected_return_type);
  return 0;
}
  if ((kind == NK_LOOP_STMT)) {
  typecheck_stmt(node_get_data1(n), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety, expected_return_type);
  return 0;
}
  if ((kind == NK_LIFETIME_STMT)) {
  typecheck_stmt(node_get_data2(n), fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety, expected_return_type);
  return 0;
}
  if ((kind == NK_INTO_STMT)) {
  let cname = get_interned_str(node_get_data1(n));
  if ((!(() => { const __recv = tc_contract_names; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, cname) : set_has(__recv, cname); })())) {
  panic_with_code("E_TYPE_UNKNOWN_CONTRACT", (() => { const __recv = (() => { const __recv = "Unknown contract '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, cname) : str_concat(__recv, cname); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' in into statement") : str_concat(__recv, "' in into statement"); })(), "An into statement referenced a contract that is not declared.", "Declare the contract before using 'into'.");
}
  return 0;
}
  typecheck_expr(n, fn_arities, fn_param_types, fn_return_types, local_types, nonnull_ptrs, strict_safety);
  return 0;
}

function typecheck_program_with_options(program, strict_safety) {
  let fn_arities = map_new();
  let fn_param_types = map_new();
  let fn_return_types = map_new();
  let fn_nodes = map_new();
  let local_types = map_new();
  tc_global_value_types = map_new();
  tc_alias_union_tags = map_new();
  tc_type_alias_names = set_new();
  tc_contract_names = set_new();
  tc_destructor_alias_by_alias = map_new();
  tc_destructor_alias_names = vec_new();
  let body = node_get_data1(program);
  let i = 0;
  let len = (() => { const __recv = body; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let stmt = (() => { const __recv = body; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let kind = node_kind(stmt);
  if (((((kind == NK_FN_DECL) || (kind == NK_CLASS_FN_DECL)) || (kind == NK_EXTERN_FN_DECL)) || (kind == NK_ACTUAL_FN_DECL))) {
  let name = get_interned_str(node_get_data1(stmt));
  (() => { const __recv = fn_nodes; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, name, stmt) : map_set(__recv, name, stmt); })();
  let params = node_get_data3(stmt);
  (() => { const __recv = fn_arities; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, name, (() => { const __recv = params; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })()) : map_set(__recv, name, (() => { const __recv = params; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })()); })();
  let param_types = vec_new();
  let p = 0;
  while ((p < (() => { const __recv = params; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })())) {
  let param = (() => { const __recv = params; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, p) : vec_get(__recv, p); })();
  let param_type_node = (() => { const __recv = param; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })();
  (() => { const __recv = param_types; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, type_name_from_type_node(param_type_node)) : vec_push(__recv, type_name_from_type_node(param_type_node)); })();
  p = (p + 1);
}
  (() => { const __recv = fn_param_types; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, name, param_types) : map_set(__recv, name, param_types); })();
  let ret_type = node_get_data4(stmt);
  (() => { const __recv = fn_return_types; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, name, type_name_from_type_node(ret_type)) : map_set(__recv, name, type_name_from_type_node(ret_type)); })();
}
  if ((kind == NK_EXTERN_LET_DECL)) {
  let vname = get_interned_str(node_get_data1(stmt));
  let vtype = node_get_data2(stmt);
  let tname = type_name_from_type_node(vtype);
  (() => { const __recv = local_types; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, vname, tname) : map_set(__recv, vname, tname); })();
  (() => { const __recv = tc_global_value_types; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, vname, tname) : map_set(__recv, vname, tname); })();
}
  if ((kind == NK_TYPE_ALIAS)) {
  let alias_name = get_interned_str(node_get_data1(stmt));
  (() => { const __recv = tc_type_alias_names; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, alias_name) : set_add(__recv, alias_name); })();
  let alias_type = node_get_data3(stmt);
  let tags = vec_new();
  collect_union_named_tags(alias_type, tags);
  if (((() => { const __recv = tags; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() > 0)) {
  (() => { const __recv = tc_alias_union_tags; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, alias_name, tags) : map_set(__recv, alias_name, tags); })();
}
  let destructor_name_idx = node_get_data5(stmt);
  if ((destructor_name_idx != 0)) {
  let destructor_name = get_interned_str(destructor_name_idx);
  (() => { const __recv = tc_destructor_alias_by_alias; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, alias_name, destructor_name) : map_set(__recv, alias_name, destructor_name); })();
  (() => { const __recv = tc_destructor_alias_names; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, alias_name) : vec_push(__recv, alias_name); })();
}
}
  if ((kind == NK_EXTERN_TYPE_DECL)) {
  (() => { const __recv = tc_type_alias_names; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(stmt))) : set_add(__recv, get_interned_str(node_get_data1(stmt))); })();
}
  if ((kind == NK_CONTRACT_DECL)) {
  (() => { const __recv = tc_contract_names; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(stmt))) : set_add(__recv, get_interned_str(node_get_data1(stmt))); })();
}
  if ((kind == NK_LET_DECL)) {
  let vname = get_interned_str(node_get_data1(stmt));
  let vtype = node_get_data2(stmt);
  if ((vtype != 0)) {
  (() => { const __recv = tc_global_value_types; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, vname, type_name_from_type_node(vtype)) : map_set(__recv, vname, type_name_from_type_node(vtype)); })();
}
}
  i = (i + 1);
}
  i = 0;
  let destructor_alias_count = (() => { const __recv = tc_destructor_alias_names; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < destructor_alias_count)) {
  let alias_name = (() => { const __recv = tc_destructor_alias_names; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let destructor_name = (() => { const __recv = tc_destructor_alias_by_alias; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, alias_name) : map_get(__recv, alias_name); })();
  if ((!(() => { const __recv = fn_nodes; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, destructor_name) : map_has(__recv, destructor_name); })())) {
  panic_with_code("E_TYPE_DESTRUCTOR_NOT_FOUND", (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "Destructor '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, destructor_name) : str_concat(__recv, destructor_name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' for alias '") : str_concat(__recv, "' for alias '"); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, alias_name) : str_concat(__recv, alias_name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' was not found") : str_concat(__recv, "' was not found"); })(), "A type alias referenced a destructor function that does not exist.", "Declare the destructor function before using it in 'type Alias = ... then destructor'.");
}
  let fn_node = (() => { const __recv = fn_nodes; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, destructor_name) : map_get(__recv, destructor_name); })();
  let params = node_get_data3(fn_node);
  let valid = true;
  if (((() => { const __recv = params; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() != 1)) {
  valid = false;
} else {
  let p0 = (() => { const __recv = params; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })();
  let pname = get_interned_str((() => { const __recv = p0; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })());
  let ptype = (() => { const __recv = p0; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })();
  if ((!(() => { const __recv = pname; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "this") : str_eq(__recv, "this"); })())) {
  valid = false;
}
  if ((!type_node_is_move_pointer_to_alias(ptype, alias_name))) {
  valid = false;
}
}
  let ret_name = type_name_from_type_node(node_get_data4(fn_node));
  if ((!(() => { const __recv = ret_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Void") : str_eq(__recv, "Void"); })())) {
  valid = false;
}
  if ((!valid)) {
  panic_with_code("E_TYPE_DESTRUCTOR_SIGNATURE", (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "Destructor '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, destructor_name) : str_concat(__recv, destructor_name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' must have signature fn ") : str_concat(__recv, "' must have signature fn "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, destructor_name) : str_concat(__recv, destructor_name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "(this : *move ") : str_concat(__recv, "(this : *move "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, alias_name) : str_concat(__recv, alias_name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ") : Void") : str_concat(__recv, ") : Void"); })(), "Destructor signatures must follow the required receiver and return type contract.", "Use exactly one receiver parameter named 'this' with type '*move AliasType' and return Void.");
}
  i = (i + 1);
}
  if ((strict_safety != 1)) {
  return program;
}
  i = 0;
  while ((i < len)) {
  typecheck_stmt((() => { const __recv = body; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(), fn_arities, fn_param_types, fn_return_types, local_types, map_new(), strict_safety, "Unknown");
  i = (i + 1);
}
  return program;
}

function typecheck_program(program) {
  return typecheck_program_with_options(program, 1);
}

function selfhost_typecheck_marker() { return 0; }

let bc_global_value_types = map_new();

let bc_copy_types = set_new();

let bc_copy_alias_types = map_new();

let bc_copy_alias_names = vec_new();

let bc_destructor_aliases = map_new();

let bc_destructor_alias_names = vec_new();

function bc_str_ends_with_local(s, suffix) {
  let ns = (() => { const __recv = s; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })();
  let nf = (() => { const __recv = suffix; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })();
  if ((nf > ns)) {
  return false;
}
  return (() => { const __recv = (() => { const __recv = s; const __dyn = __recv?.table?.str_slice; return __dyn ? __dyn(__recv.ref, (ns - nf), ns) : str_slice(__recv, (ns - nf), ns); })(); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, suffix) : str_eq(__recv, suffix); })();
}

function bc_type_name_from_type_node(t) {
  if ((t == 0)) {
  return "Unknown";
}
  let k = node_kind(t);
  if ((k == NK_NAMED_TYPE)) {
  return get_interned_str(node_get_data1(t));
}
  if ((k == NK_REFINEMENT_TYPE)) {
  return bc_type_name_from_type_node(node_get_data1(t));
}
  if ((k == NK_POINTER_TYPE)) {
  let mutable = node_get_data1(t);
  let inner = bc_type_name_from_type_node(node_get_data2(t));
  let move_ptr = node_get_data3(t);
  let life_idx = node_get_data4(t);
  let life_prefix = "";
  if ((life_idx != 0)) {
  life_prefix = (() => { const __recv = get_interned_str(life_idx); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " ") : str_concat(__recv, " "); })();
}
  if ((move_ptr == 1)) {
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = "*"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, life_prefix) : str_concat(__recv, life_prefix); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "move ") : str_concat(__recv, "move "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, inner) : str_concat(__recv, inner); })();
}
  if ((mutable == 1)) {
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = "*"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, life_prefix) : str_concat(__recv, life_prefix); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "mut ") : str_concat(__recv, "mut "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, inner) : str_concat(__recv, inner); })();
}
  return (() => { const __recv = (() => { const __recv = "*"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, life_prefix) : str_concat(__recv, life_prefix); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, inner) : str_concat(__recv, inner); })();
}
  if ((k == NK_UNION_TYPE)) {
  let left = bc_type_name_from_type_node(node_get_data1(t));
  let right = bc_type_name_from_type_node(node_get_data2(t));
  return (() => { const __recv = (() => { const __recv = left; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "|") : str_concat(__recv, "|"); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, right) : str_concat(__recv, right); })();
}
  return "Unknown";
}

function is_copy_primitive(name) {
  return ((((((((((((((((() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "I8") : str_eq(__recv, "I8"); })() || (() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "I16") : str_eq(__recv, "I16"); })()) || (() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "I32") : str_eq(__recv, "I32"); })()) || (() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "I64") : str_eq(__recv, "I64"); })()) || (() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "I128") : str_eq(__recv, "I128"); })()) || (() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "U8") : str_eq(__recv, "U8"); })()) || (() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "U16") : str_eq(__recv, "U16"); })()) || (() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "U32") : str_eq(__recv, "U32"); })()) || (() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "U64") : str_eq(__recv, "U64"); })()) || (() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "U128") : str_eq(__recv, "U128"); })()) || (() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "USize") : str_eq(__recv, "USize"); })()) || (() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "ISize") : str_eq(__recv, "ISize"); })()) || (() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "F32") : str_eq(__recv, "F32"); })()) || (() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "F64") : str_eq(__recv, "F64"); })()) || (() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Bool") : str_eq(__recv, "Bool"); })()) || (() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Char") : str_eq(__recv, "Char"); })());
}

function is_copy_type(type_name, extern_type_names) {
  if ((() => { const __recv = type_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Unknown") : str_eq(__recv, "Unknown"); })()) {
  return false;
}
  if ((() => { const __recv = type_name; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, "*") : str_starts_with(__recv, "*"); })()) {
  return true;
}
  if (is_copy_primitive(type_name)) {
  return true;
}
  if ((((() => { const __recv = type_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Vec") : str_eq(__recv, "Vec"); })() || (() => { const __recv = type_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Map") : str_eq(__recv, "Map"); })()) || (() => { const __recv = type_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Set") : str_eq(__recv, "Set"); })())) {
  return true;
}
  if ((() => { const __recv = bc_copy_types; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, type_name) : set_has(__recv, type_name); })()) {
  return true;
}
  if ((() => { const __recv = extern_type_names; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, type_name) : set_has(__recv, type_name); })()) {
  return false;
}
  return false;
}

function bc_find_copy_alias_type(name) {
  if ((() => { const __recv = bc_copy_alias_types; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, name) : map_has(__recv, name); })()) {
  return (() => { const __recv = bc_copy_alias_types; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, name) : map_get(__recv, name); })();
}
  return 0;
}

function bc_type_node_is_copyable(t, extern_type_names, visiting_aliases) {
  if ((t == 0)) {
  return false;
}
  let k = node_kind(t);
  if ((k == NK_NAMED_TYPE)) {
  let name = get_interned_str(node_get_data1(t));
  if (is_copy_primitive(name)) {
  return true;
}
  if ((((() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Vec") : str_eq(__recv, "Vec"); })() || (() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Map") : str_eq(__recv, "Map"); })()) || (() => { const __recv = name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Set") : str_eq(__recv, "Set"); })())) {
  return true;
}
  if ((() => { const __recv = bc_copy_types; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })()) {
  return true;
}
  if ((() => { const __recv = extern_type_names; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })()) {
  return false;
}
  let alias_type = bc_find_copy_alias_type(name);
  if ((alias_type != 0)) {
  if ((() => { const __recv = visiting_aliases; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })()) {
  return false;
}
  (() => { const __recv = visiting_aliases; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, name) : set_add(__recv, name); })();
  let ok = bc_type_node_is_copyable(alias_type, extern_type_names, visiting_aliases);
  (() => { const __recv = visiting_aliases; const __dyn = __recv?.table?.set_delete; return __dyn ? __dyn(__recv.ref, name) : set_delete(__recv, name); })();
  return ok;
}
  return false;
}
  if ((k == NK_REFINEMENT_TYPE)) {
  return bc_type_node_is_copyable(node_get_data1(t), extern_type_names, visiting_aliases);
}
  if ((k == NK_POINTER_TYPE)) {
  return true;
}
  if ((k == NK_UNION_TYPE)) {
  return (bc_type_node_is_copyable(node_get_data1(t), extern_type_names, visiting_aliases) && bc_type_node_is_copyable(node_get_data2(t), extern_type_names, visiting_aliases));
}
  if ((k == NK_TUPLE_TYPE)) {
  let members = node_get_data1(t);
  let i = 0;
  let len = (() => { const __recv = members; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  if ((!bc_type_node_is_copyable((() => { const __recv = members; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(), extern_type_names, visiting_aliases))) {
  return false;
}
  i = (i + 1);
}
  return true;
}
  return false;
}

function bc_infer_expr_type_name(n, env_types, fn_return_types) {
  if ((n == 0)) {
  return "Unknown";
}
  let kind = node_kind(n);
  if ((kind == NK_NUMBER_LIT)) {
  let text = get_interned_str(node_get_data1(n));
  if (bc_str_ends_with_local(text, "USize")) {
  return "USize";
}
  return "I32";
}
  if ((kind == NK_BOOL_LIT)) {
  return "Bool";
}
  if ((kind == NK_STRING_LIT)) {
  return "*Str";
}
  if ((kind == NK_CHAR_LIT)) {
  return "Char";
}
  if ((kind == NK_IDENTIFIER)) {
  let name = get_interned_str(node_get_data1(n));
  if ((() => { const __recv = env_types; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, name) : map_has(__recv, name); })()) {
  return (() => { const __recv = env_types; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, name) : map_get(__recv, name); })();
}
  if ((() => { const __recv = bc_global_value_types; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, name) : map_has(__recv, name); })()) {
  return (() => { const __recv = bc_global_value_types; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, name) : map_get(__recv, name); })();
}
  return "Unknown";
}
  if ((kind == NK_UNARY_EXPR)) {
  let op = get_interned_str(node_get_data1(n));
  let inner = bc_infer_expr_type_name(node_get_data2(n), env_types, fn_return_types);
  if ((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "&") : str_eq(__recv, "&"); })()) {
  return (() => { const __recv = "*"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, inner) : str_concat(__recv, inner); })();
}
  if ((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "&mut") : str_eq(__recv, "&mut"); })()) {
  return (() => { const __recv = "*mut "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, inner) : str_concat(__recv, inner); })();
}
  if ((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "!") : str_eq(__recv, "!"); })()) {
  return "Bool";
}
  return inner;
}
  if ((kind == NK_BINARY_EXPR)) {
  let op = get_interned_str(node_get_data1(n));
  if (((((((((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "==") : str_eq(__recv, "=="); })() || (() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "!=") : str_eq(__recv, "!="); })()) || (() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "<") : str_eq(__recv, "<"); })()) || (() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "<=") : str_eq(__recv, "<="); })()) || (() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, ">") : str_eq(__recv, ">"); })()) || (() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, ">=") : str_eq(__recv, ">="); })()) || (() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "&&") : str_eq(__recv, "&&"); })()) || (() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "||") : str_eq(__recv, "||"); })())) {
  return "Bool";
}
  return bc_infer_expr_type_name(node_get_data2(n), env_types, fn_return_types);
}
  if ((kind == NK_CALL_EXPR)) {
  let callee = node_get_data1(n);
  if ((node_kind(callee) == NK_IDENTIFIER)) {
  let fname = get_interned_str(node_get_data1(callee));
  if ((() => { const __recv = fn_return_types; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, fname) : map_has(__recv, fname); })()) {
  return (() => { const __recv = fn_return_types; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, fname) : map_get(__recv, fname); })();
}
}
}
  if ((kind == NK_STRUCT_INIT)) {
  return get_interned_str(node_get_data1(n));
}
  return "Unknown";
}

function place_new(base, path) {
  let p = vec_new();
  (() => { const __recv = p; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, base) : vec_push(__recv, base); })();
  (() => { const __recv = p; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, path) : vec_push(__recv, path); })();
  return p;
}

function place_is_valid(p) { return ((() => { const __recv = p; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() == 2); }

function place_base(p) { return (() => { const __recv = p; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })(); }

function place_path(p) { return (() => { const __recv = p; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })(); }

function canonical_place(n) {
  if ((n == 0)) {
  return vec_new();
}
  let kind = node_kind(n);
  if ((kind == NK_IDENTIFIER)) {
  let name = get_interned_str(node_get_data1(n));
  return place_new(name, name);
}
  if ((kind == NK_MEMBER_EXPR)) {
  let base = canonical_place(node_get_data1(n));
  if ((!place_is_valid(base))) {
  return vec_new();
}
  let prop = get_interned_str(node_get_data2(n));
  return place_new(place_base(base), (() => { const __recv = (() => { const __recv = place_path(base); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ".") : str_concat(__recv, "."); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, prop) : str_concat(__recv, prop); })());
}
  if ((kind == NK_INDEX_EXPR)) {
  let base = canonical_place(node_get_data1(n));
  if ((!place_is_valid(base))) {
  return vec_new();
}
  return place_new(place_base(base), (() => { const __recv = place_path(base); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "[]") : str_concat(__recv, "[]"); })());
}
  return vec_new();
}

function places_conflict(a_base, a_path, b_base, b_path) {
  if ((!(() => { const __recv = a_base; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, b_base) : str_eq(__recv, b_base); })())) {
  return false;
}
  if ((() => { const __recv = a_path; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, b_path) : str_eq(__recv, b_path); })()) {
  return true;
}
  if (((() => { const __recv = a_path; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, "[]") : str_includes(__recv, "[]"); })() || (() => { const __recv = b_path; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, "[]") : str_includes(__recv, "[]"); })())) {
  return true;
}
  return ((() => { const __recv = a_path; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, (() => { const __recv = b_path; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ".") : str_concat(__recv, "."); })()) : str_starts_with(__recv, (() => { const __recv = b_path; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ".") : str_concat(__recv, "."); })()); })() || (() => { const __recv = b_path; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, (() => { const __recv = a_path; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ".") : str_concat(__recv, "."); })()) : str_starts_with(__recv, (() => { const __recv = a_path; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ".") : str_concat(__recv, "."); })()); })());
}

function state_new() {
  let s = vec_new();
  (() => { const __recv = s; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, set_new()) : vec_push(__recv, set_new()); })();
  (() => { const __recv = s; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, vec_new()) : vec_push(__recv, vec_new()); })();
  (() => { const __recv = s; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, vec_new()) : vec_push(__recv, vec_new()); })();
  (() => { const __recv = s; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, vec_new()) : vec_push(__recv, vec_new()); })();
  (() => { const __recv = s; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, set_new()) : vec_push(__recv, set_new()); })();
  (() => { const __recv = s; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, vec_new()) : vec_push(__recv, vec_new()); })();
  return s;
}

function state_moved_set(state) { return (() => { const __recv = state; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })(); }

function state_moved_vec(state) { return (() => { const __recv = state; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })(); }

function state_loans(state) { return (() => { const __recv = state; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 2) : vec_get(__recv, 2); })(); }

function state_scope_starts(state) { return (() => { const __recv = state; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 3) : vec_get(__recv, 3); })(); }

function state_dropped_set(state) { return (() => { const __recv = state; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 4) : vec_get(__recv, 4); })(); }

function state_dropped_vec(state) { return (() => { const __recv = state; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 5) : vec_get(__recv, 5); })(); }

function state_moved_has(state, name) { return (() => { const __recv = state_moved_set(state); const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })(); }

function state_dropped_has(state, name) { return (() => { const __recv = state_dropped_set(state); const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })(); }

function state_moved_add(state, name) {
  if ((!(() => { const __recv = state_moved_set(state); const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })())) {
  (() => { const __recv = state_moved_set(state); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, name) : set_add(__recv, name); })();
  (() => { const __recv = state_moved_vec(state); const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, name) : vec_push(__recv, name); })();
}
  return 0;
}

function state_moved_delete(state, name) {
  (() => { const __recv = state_moved_set(state); const __dyn = __recv?.table?.set_delete; return __dyn ? __dyn(__recv.ref, name) : set_delete(__recv, name); })();
  return 0;
}

function state_dropped_add(state, name) {
  if ((!(() => { const __recv = state_dropped_set(state); const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })())) {
  (() => { const __recv = state_dropped_set(state); const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, name) : set_add(__recv, name); })();
  (() => { const __recv = state_dropped_vec(state); const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, name) : vec_push(__recv, name); })();
}
  return 0;
}

function state_dropped_delete(state, name) {
  (() => { const __recv = state_dropped_set(state); const __dyn = __recv?.table?.set_delete; return __dyn ? __dyn(__recv.ref, name) : set_delete(__recv, name); })();
  return 0;
}

function state_begin_scope(state) {
  (() => { const __recv = state_scope_starts(state); const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, (() => { const __recv = state_loans(state); const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })()) : vec_push(__recv, (() => { const __recv = state_loans(state); const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })()); })();
  return 0;
}

function state_end_scope(state) {
  let starts = state_scope_starts(state);
  if (((() => { const __recv = starts; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() == 0)) {
  return 0;
}
  let start = (() => { const __recv = starts; const __dyn = __recv?.table?.vec_pop; return __dyn ? __dyn(__recv.ref) : vec_pop(__recv); })();
  let loans = state_loans(state);
  while (((() => { const __recv = loans; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() > start)) {
  (() => { const __recv = loans; const __dyn = __recv?.table?.vec_pop; return __dyn ? __dyn(__recv.ref) : vec_pop(__recv); })();
}
  return 0;
}

function state_add_loan(state, kind, base, path) {
  let entry = vec_new();
  (() => { const __recv = entry; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, kind) : vec_push(__recv, kind); })();
  (() => { const __recv = entry; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, base) : vec_push(__recv, base); })();
  (() => { const __recv = entry; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, path) : vec_push(__recv, path); })();
  (() => { const __recv = state_loans(state); const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, entry) : vec_push(__recv, entry); })();
  return 0;
}

function state_any_conflicting_loan(state, base, path) {
  let loans = state_loans(state);
  let i = 0;
  let len = (() => { const __recv = loans; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let e = (() => { const __recv = loans; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let eb = (() => { const __recv = e; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })();
  let ep = (() => { const __recv = e; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 2) : vec_get(__recv, 2); })();
  if (places_conflict(base, path, eb, ep)) {
  return true;
}
  i = (i + 1);
}
  return false;
}

function state_conflicting_mut_loan(state, base, path) {
  let loans = state_loans(state);
  let i = 0;
  let len = (() => { const __recv = loans; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let e = (() => { const __recv = loans; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  if (((() => { const __recv = e; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })() == 2)) {
  let eb = (() => { const __recv = e; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })();
  let ep = (() => { const __recv = e; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 2) : vec_get(__recv, 2); })();
  if (places_conflict(base, path, eb, ep)) {
  return true;
}
}
  i = (i + 1);
}
  return false;
}

function state_conflicting_immut_loan(state, base, path) {
  let loans = state_loans(state);
  let i = 0;
  let len = (() => { const __recv = loans; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let e = (() => { const __recv = loans; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  if (((() => { const __recv = e; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })() == 1)) {
  let eb = (() => { const __recv = e; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })();
  let ep = (() => { const __recv = e; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 2) : vec_get(__recv, 2); })();
  if (places_conflict(base, path, eb, ep)) {
  return true;
}
}
  i = (i + 1);
}
  return false;
}

function state_clone(src) {
  let dst = state_new();
  let srcMoved = state_moved_vec(src);
  let i = 0;
  let len = (() => { const __recv = srcMoved; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  state_moved_add(dst, (() => { const __recv = srcMoved; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })());
  i = (i + 1);
}
  let srcLoans = state_loans(src);
  i = 0;
  len = (() => { const __recv = srcLoans; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let e = (() => { const __recv = srcLoans; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  state_add_loan(dst, (() => { const __recv = e; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })(), (() => { const __recv = e; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })(), (() => { const __recv = e; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 2) : vec_get(__recv, 2); })());
  i = (i + 1);
}
  let srcScopes = state_scope_starts(src);
  i = 0;
  len = (() => { const __recv = srcScopes; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  (() => { const __recv = state_scope_starts(dst); const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, (() => { const __recv = srcScopes; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })()) : vec_push(__recv, (() => { const __recv = srcScopes; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })()); })();
  i = (i + 1);
}
  let srcDropped = state_dropped_vec(src);
  i = 0;
  len = (() => { const __recv = srcDropped; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  state_dropped_add(dst, (() => { const __recv = srcDropped; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })());
  i = (i + 1);
}
  return dst;
}

function state_merge_moved_from_branches(dst, a, b) {
  let newSet = set_new();
  let newVec = vec_new();
  let av = state_moved_vec(a);
  let i = 0;
  let len = (() => { const __recv = av; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let n = (() => { const __recv = av; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  if (((() => { const __recv = state_moved_set(a); const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, n) : set_has(__recv, n); })() && (!(() => { const __recv = newSet; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, n) : set_has(__recv, n); })()))) {
  (() => { const __recv = newSet; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, n) : set_add(__recv, n); })();
  (() => { const __recv = newVec; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, n) : vec_push(__recv, n); })();
}
  i = (i + 1);
}
  let bv = state_moved_vec(b);
  i = 0;
  len = (() => { const __recv = bv; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let n = (() => { const __recv = bv; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  if (((() => { const __recv = state_moved_set(b); const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, n) : set_has(__recv, n); })() && (!(() => { const __recv = newSet; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, n) : set_has(__recv, n); })()))) {
  (() => { const __recv = newSet; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, n) : set_add(__recv, n); })();
  (() => { const __recv = newVec; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, n) : vec_push(__recv, n); })();
}
  i = (i + 1);
}
  (() => { const __recv = dst; const __dyn = __recv?.table?.vec_set; return __dyn ? __dyn(__recv.ref, 0, newSet) : vec_set(__recv, 0, newSet); })();
  (() => { const __recv = dst; const __dyn = __recv?.table?.vec_set; return __dyn ? __dyn(__recv.ref, 1, newVec) : vec_set(__recv, 1, newVec); })();
  let droppedSet = set_new();
  let droppedVec = vec_new();
  let adv = state_dropped_vec(a);
  i = 0;
  len = (() => { const __recv = adv; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let n = (() => { const __recv = adv; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  if (((() => { const __recv = state_dropped_set(a); const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, n) : set_has(__recv, n); })() && (!(() => { const __recv = droppedSet; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, n) : set_has(__recv, n); })()))) {
  (() => { const __recv = droppedSet; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, n) : set_add(__recv, n); })();
  (() => { const __recv = droppedVec; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, n) : vec_push(__recv, n); })();
}
  i = (i + 1);
}
  let bdv = state_dropped_vec(b);
  i = 0;
  len = (() => { const __recv = bdv; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let n = (() => { const __recv = bdv; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  if (((() => { const __recv = state_dropped_set(b); const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, n) : set_has(__recv, n); })() && (!(() => { const __recv = droppedSet; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, n) : set_has(__recv, n); })()))) {
  (() => { const __recv = droppedSet; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, n) : set_add(__recv, n); })();
  (() => { const __recv = droppedVec; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, n) : vec_push(__recv, n); })();
}
  i = (i + 1);
}
  (() => { const __recv = dst; const __dyn = __recv?.table?.vec_set; return __dyn ? __dyn(__recv.ref, 4, droppedSet) : vec_set(__recv, 4, droppedSet); })();
  (() => { const __recv = dst; const __dyn = __recv?.table?.vec_set; return __dyn ? __dyn(__recv.ref, 5, droppedVec) : vec_set(__recv, 5, droppedVec); })();
  return 0;
}

function panic_borrow(code, message, fix) {
  return panic_with_code(code, message, "Borrowing and ownership rules require exclusive mutable access or shared immutable access, and disallow use-after-move.", fix);
}

function ensure_readable(expr, state) {
  let p = canonical_place(expr);
  if ((!place_is_valid(p))) {
  return 0;
}
  let base = place_base(p);
  if ((() => { const __recv = bc_global_value_types; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, base) : map_has(__recv, base); })()) {
  return 0;
}
  if (state_dropped_has(state, base)) {
  panic_borrow("E_BORROW_USE_AFTER_DROP", (() => { const __recv = (() => { const __recv = "Use of dropped value '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, base) : str_concat(__recv, base); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "'") : str_concat(__recv, "'"); })(), "Do not use a value after explicit or implicit drop; move/copy before dropping if needed.");
}
  if (state_moved_has(state, base)) {
  panic_borrow("E_BORROW_USE_AFTER_MOVE", (() => { const __recv = (() => { const __recv = "Use of moved value '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, base) : str_concat(__recv, base); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "'") : str_concat(__recv, "'"); })(), "Reinitialize the value before use, or borrow it before moving.");
}
  return 0;
}

function consume_place(expr, state, env_types, fn_return_types, extern_type_names) {
  let p = canonical_place(expr);
  if ((!place_is_valid(p))) {
  return 0;
}
  let base = place_base(p);
  let path = place_path(p);
  if ((() => { const __recv = bc_global_value_types; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, base) : map_has(__recv, base); })()) {
  return 0;
}
  if (state_dropped_has(state, base)) {
  panic_borrow("E_BORROW_USE_AFTER_DROP", (() => { const __recv = (() => { const __recv = "Use of dropped value '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, base) : str_concat(__recv, base); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "'") : str_concat(__recv, "'"); })(), "Do not use a value after explicit or implicit drop; move/copy before dropping if needed.");
}
  if (state_moved_has(state, base)) {
  panic_borrow("E_BORROW_USE_AFTER_MOVE", (() => { const __recv = (() => { const __recv = "Use of moved value '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, base) : str_concat(__recv, base); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "'") : str_concat(__recv, "'"); })(), "Reinitialize the value before use, or borrow it with '&' / '&mut' instead of moving.");
}
  if (state_any_conflicting_loan(state, base, path)) {
  panic_borrow("E_BORROW_MOVE_WHILE_BORROWED", (() => { const __recv = (() => { const __recv = "Cannot move '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, base) : str_concat(__recv, base); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' while it is borrowed") : str_concat(__recv, "' while it is borrowed"); })(), "Ensure all borrows end before moving, or pass a borrow (&/&mut) instead.");
}
  let ty = bc_infer_expr_type_name(expr, env_types, fn_return_types);
  if ((!is_copy_type(ty, extern_type_names))) {
  state_moved_add(state, base);
}
  return 0;
}

function check_expr(expr, state, env_types, fn_return_types, extern_type_names, global_fn_names, mode) {
  if ((expr == 0)) {
  return 0;
}
  if (((() => { const __recv = mode; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "move") : str_eq(__recv, "move"); })() && (node_kind(expr) == NK_IDENTIFIER))) {
  let nm = get_interned_str(node_get_data1(expr));
  if ((() => { const __recv = global_fn_names; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, nm) : set_has(__recv, nm); })()) {
  return 0;
}
}
  if ((node_kind(expr) == NK_UNARY_EXPR)) {
  let op = get_interned_str(node_get_data1(expr));
  if (((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "&") : str_eq(__recv, "&"); })() || (() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "&mut") : str_eq(__recv, "&mut"); })())) {
  let target = node_get_data2(expr);
  let p = canonical_place(target);
  if ((!place_is_valid(p))) {
  if ((node_kind(target) == NK_STRUCT_INIT)) {
  check_expr(target, state, env_types, fn_return_types, extern_type_names, global_fn_names, "read");
  return 0;
}
  panic_borrow("E_BORROW_INVALID_TARGET", "Borrow target is not a place expression", "Borrow only identifiers, fields, or index places (e.g. &x, &obj.f, &arr[i]).");
}
  ensure_readable(target, state);
  let base = place_base(p);
  let path = place_path(p);
  if ((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "&") : str_eq(__recv, "&"); })()) {
  if (state_conflicting_mut_loan(state, base, path)) {
  panic_borrow("E_BORROW_IMMUT_WHILE_MUT", (() => { const __recv = (() => { const __recv = "Cannot immutably borrow '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, base) : str_concat(__recv, base); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' because it is mutably borrowed") : str_concat(__recv, "' because it is mutably borrowed"); })(), "End the mutable borrow first, or borrow mutably in a non-overlapping scope.");
}
  state_add_loan(state, 1, base, path);
} else {
  if ((state_conflicting_mut_loan(state, base, path) || state_conflicting_immut_loan(state, base, path))) {
  panic_borrow("E_BORROW_MUT_CONFLICT", (() => { const __recv = (() => { const __recv = "Cannot mutably borrow '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, base) : str_concat(__recv, base); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' because it is already borrowed") : str_concat(__recv, "' because it is already borrowed"); })(), "Ensure no active borrows overlap this place before taking '&mut'.");
}
  state_add_loan(state, 2, base, path);
}
  return 0;
}
}
  let kind = node_kind(expr);
  if ((((kind == NK_IDENTIFIER) || (kind == NK_MEMBER_EXPR)) || (kind == NK_INDEX_EXPR))) {
  if ((() => { const __recv = mode; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "read") : str_eq(__recv, "read"); })()) {
  ensure_readable(expr, state);
  return 0;
}
  consume_place(expr, state, env_types, fn_return_types, extern_type_names);
  return 0;
}
  if (((((kind == NK_NUMBER_LIT) || (kind == NK_BOOL_LIT)) || (kind == NK_STRING_LIT)) || (kind == NK_CHAR_LIT))) {
  return 0;
}
  if ((kind == NK_UNARY_EXPR)) {
  check_expr(node_get_data2(expr), state, env_types, fn_return_types, extern_type_names, global_fn_names, "read");
  return 0;
}
  if ((kind == NK_BINARY_EXPR)) {
  check_expr(node_get_data2(expr), state, env_types, fn_return_types, extern_type_names, global_fn_names, "read");
  check_expr(node_get_data3(expr), state, env_types, fn_return_types, extern_type_names, global_fn_names, "read");
  return 0;
}
  if ((kind == NK_CALL_EXPR)) {
  let callee = node_get_data1(expr);
  if (((node_kind(callee) == NK_IDENTIFIER) && (() => { const __recv = get_interned_str(node_get_data1(callee)); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "drop") : str_eq(__recv, "drop"); })())) {
  let args = node_get_data2(expr);
  if (((() => { const __recv = args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() != 1)) {
  panic_borrow("E_BORROW_INVALID_TARGET", "drop expects exactly one argument", "Call drop with exactly one local/place value such as drop(x) or x.drop().");
}
  let target = (() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })();
  let p = canonical_place(target);
  if ((!place_is_valid(p))) {
  panic_borrow("E_BORROW_INVALID_TARGET", "drop target must be a place expression", "Call drop with a local/place value such as drop(x) or x.drop().");
}
  let base = place_base(p);
  let path = place_path(p);
  if (state_dropped_has(state, base)) {
  panic_borrow("E_BORROW_DOUBLE_DROP", (() => { const __recv = (() => { const __recv = "Double drop of '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, base) : str_concat(__recv, base); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "'") : str_concat(__recv, "'"); })(), "Ensure each owned value is dropped exactly once.");
}
  let target_type = bc_infer_expr_type_name(target, env_types, fn_return_types);
  if ((!(() => { const __recv = bc_destructor_aliases; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, target_type) : map_has(__recv, target_type); })())) {
  panic_borrow("E_BORROW_DROP_MISSING_DESTRUCTOR", (() => { const __recv = (() => { const __recv = "Type '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, target_type) : str_concat(__recv, target_type); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' has no associated destructor") : str_concat(__recv, "' has no associated destructor"); })(), "Associate a destructor via 'type Alias = Base then destructorName;' and use that alias type.");
}
  ensure_readable(target, state);
  if (state_any_conflicting_loan(state, base, path)) {
  panic_borrow("E_BORROW_MOVE_WHILE_BORROWED", (() => { const __recv = (() => { const __recv = "Cannot drop '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, base) : str_concat(__recv, base); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' while it is borrowed") : str_concat(__recv, "' while it is borrowed"); })(), "Ensure all borrows end before dropping the value.");
}
  state_dropped_add(state, base);
  state_moved_add(state, base);
  return 0;
}
  if ((((node_kind(callee) == NK_IDENTIFIER) && (() => { const __recv = get_interned_str(node_get_data1(callee)); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "into") : str_eq(__recv, "into"); })()) && (node_get_data3(expr) == 1))) {
  let args = node_get_data2(expr);
  if (((() => { const __recv = args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() >= 1)) {
  let receiver = (() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })();
  let receiver_mode = "read";
  if (place_is_valid(canonical_place(receiver))) {
  receiver_mode = "move";
}
  check_expr(receiver, state, env_types, fn_return_types, extern_type_names, global_fn_names, receiver_mode);
}
  let i = 1;
  let len = (() => { const __recv = args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  check_expr((() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(), state, env_types, fn_return_types, extern_type_names, global_fn_names, "read");
  i = (i + 1);
}
  return 0;
}
  if ((!((node_kind(callee) == NK_IDENTIFIER) && (() => { const __recv = global_fn_names; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(callee))) : set_has(__recv, get_interned_str(node_get_data1(callee))); })()))) {
  check_expr(callee, state, env_types, fn_return_types, extern_type_names, global_fn_names, "read");
}
  let args = node_get_data2(expr);
  let i = 0;
  let len = (() => { const __recv = args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  check_expr((() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(), state, env_types, fn_return_types, extern_type_names, global_fn_names, "read");
  i = (i + 1);
}
  return 0;
}
  if ((kind == NK_STRUCT_INIT)) {
  let fields = node_get_data2(expr);
  let i = 0;
  let len = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let f = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  check_expr((() => { const __recv = f; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })(), state, env_types, fn_return_types, extern_type_names, global_fn_names, "read");
  i = (i + 1);
}
  return 0;
}
  if ((kind == NK_IF_EXPR)) {
  check_expr(node_get_data1(expr), state, env_types, fn_return_types, extern_type_names, global_fn_names, "read");
  let then_state = state_clone(state);
  check_stmt(node_get_data2(expr), then_state, env_types, fn_return_types, extern_type_names, global_fn_names);
  if ((node_get_data3(expr) != 0)) {
  let else_state = state_clone(state);
  check_stmt(node_get_data3(expr), else_state, env_types, fn_return_types, extern_type_names, global_fn_names);
  state_merge_moved_from_branches(state, then_state, else_state);
} else {
  state_merge_moved_from_branches(state, then_state, state);
}
  return 0;
}
  if ((kind == NK_MATCH_EXPR)) {
  check_expr(node_get_data1(expr), state, env_types, fn_return_types, extern_type_names, global_fn_names, "read");
  let cases = node_get_data2(expr);
  let merged = state_clone(state);
  let i = 0;
  let len = (() => { const __recv = cases; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let c = (() => { const __recv = cases; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let branch = state_clone(state);
  check_stmt((() => { const __recv = c; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })(), branch, env_types, fn_return_types, extern_type_names, global_fn_names);
  state_merge_moved_from_branches(merged, merged, branch);
  i = (i + 1);
}
  state_merge_moved_from_branches(state, merged, state);
  return 0;
}
  if ((kind == NK_IS_EXPR)) {
  check_expr(node_get_data1(expr), state, env_types, fn_return_types, extern_type_names, global_fn_names, "read");
  return 0;
}
  if ((kind == NK_UNWRAP_EXPR)) {
  check_expr(node_get_data1(expr), state, env_types, fn_return_types, extern_type_names, global_fn_names, "read");
  return 0;
}
  return 0;
}

function check_block(block, state, env_types, fn_return_types, extern_type_names, global_fn_names) {
  state_begin_scope(state);
  let stmts = node_get_data1(block);
  let i = 0;
  let len = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  check_stmt((() => { const __recv = stmts; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(), state, env_types, fn_return_types, extern_type_names, global_fn_names);
  i = (i + 1);
}
  return state_end_scope(state);
}

function check_stmt(stmt, state, env_types, fn_return_types, extern_type_names, global_fn_names) {
  if ((stmt == 0)) {
  return 0;
}
  let kind = node_kind(stmt);
  if ((kind == NK_LET_DECL)) {
  let rhs = node_get_data3(stmt);
  let mode = "read";
  let p = canonical_place(rhs);
  if (place_is_valid(p)) {
  mode = "move";
}
  check_expr(rhs, state, env_types, fn_return_types, extern_type_names, global_fn_names, mode);
  let name = get_interned_str(node_get_data1(stmt));
  let tnode = node_get_data2(stmt);
  if ((tnode != 0)) {
  (() => { const __recv = env_types; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, name, bc_type_name_from_type_node(tnode)) : map_set(__recv, name, bc_type_name_from_type_node(tnode)); })();
} else {
  (() => { const __recv = env_types; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, name, bc_infer_expr_type_name(rhs, env_types, fn_return_types)) : map_set(__recv, name, bc_infer_expr_type_name(rhs, env_types, fn_return_types)); })();
}
  state_moved_delete(state, name);
  state_dropped_delete(state, name);
  return 0;
}
  if ((kind == NK_ASSIGN_STMT)) {
  let target = node_get_data1(stmt);
  let tplace = canonical_place(target);
  if (place_is_valid(tplace)) {
  let base = place_base(tplace);
  let path = place_path(tplace);
  if (state_any_conflicting_loan(state, base, path)) {
  panic_borrow("E_BORROW_ASSIGN_WHILE_BORROWED", (() => { const __recv = (() => { const __recv = "Cannot assign to '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, base) : str_concat(__recv, base); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' while it is borrowed") : str_concat(__recv, "' while it is borrowed"); })(), "End active borrows before assignment, or assign in a non-overlapping scope.");
}
}
  let rhs = node_get_data2(stmt);
  let mode = "read";
  let rhs_place = canonical_place(rhs);
  if (place_is_valid(rhs_place)) {
  mode = "move";
}
  check_expr(rhs, state, env_types, fn_return_types, extern_type_names, global_fn_names, mode);
  if ((node_kind(target) == NK_IDENTIFIER)) {
  let target_name = get_interned_str(node_get_data1(target));
  state_moved_delete(state, target_name);
  state_dropped_delete(state, target_name);
}
  return 0;
}
  if ((kind == NK_EXPR_STMT)) {
  check_expr(node_get_data1(stmt), state, env_types, fn_return_types, extern_type_names, global_fn_names, "move");
  return 0;
}
  if ((kind == NK_RETURN_STMT)) {
  let v = node_get_data1(stmt);
  if ((v != 0)) {
  let mode = "read";
  if (place_is_valid(canonical_place(v))) {
  mode = "move";
}
  check_expr(v, state, env_types, fn_return_types, extern_type_names, global_fn_names, mode);
}
  return 0;
}
  if ((kind == NK_IF_STMT)) {
  check_expr(node_get_data1(stmt), state, env_types, fn_return_types, extern_type_names, global_fn_names, "read");
  let then_state = state_clone(state);
  check_stmt(node_get_data2(stmt), then_state, env_types, fn_return_types, extern_type_names, global_fn_names);
  if ((node_get_data3(stmt) != 0)) {
  let else_state = state_clone(state);
  check_stmt(node_get_data3(stmt), else_state, env_types, fn_return_types, extern_type_names, global_fn_names);
  state_merge_moved_from_branches(state, then_state, else_state);
} else {
  state_merge_moved_from_branches(state, then_state, state);
}
  return 0;
}
  if ((kind == NK_FOR_STMT)) {
  check_expr(node_get_data2(stmt), state, env_types, fn_return_types, extern_type_names, global_fn_names, "read");
  check_expr(node_get_data3(stmt), state, env_types, fn_return_types, extern_type_names, global_fn_names, "read");
  state_begin_scope(state);
  (() => { const __recv = env_types; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(stmt)), "I32") : map_set(__recv, get_interned_str(node_get_data1(stmt)), "I32"); })();
  check_stmt(node_get_data4(stmt), state, env_types, fn_return_types, extern_type_names, global_fn_names);
  state_end_scope(state);
  return 0;
}
  if ((kind == NK_WHILE_STMT)) {
  check_expr(node_get_data1(stmt), state, env_types, fn_return_types, extern_type_names, global_fn_names, "read");
  state_begin_scope(state);
  check_stmt(node_get_data2(stmt), state, env_types, fn_return_types, extern_type_names, global_fn_names);
  state_end_scope(state);
  return 0;
}
  if ((kind == NK_LOOP_STMT)) {
  state_begin_scope(state);
  check_stmt(node_get_data1(stmt), state, env_types, fn_return_types, extern_type_names, global_fn_names);
  state_end_scope(state);
  return 0;
}
  if ((kind == NK_BLOCK)) {
  check_block(stmt, state, env_types, fn_return_types, extern_type_names, global_fn_names);
  return 0;
}
  if ((kind == NK_LIFETIME_STMT)) {
  check_stmt(node_get_data2(stmt), state, env_types, fn_return_types, extern_type_names, global_fn_names);
  return 0;
}
  if (((kind == NK_CONTRACT_DECL) || (kind == NK_INTO_STMT))) {
  return 0;
}
  if ((kind == NK_FN_DECL)) {
  let fn_state = state_new();
  let fn_env = map_new();
  let params = node_get_data3(stmt);
  let i = 0;
  let len = (() => { const __recv = params; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let p = (() => { const __recv = params; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let pname = get_interned_str((() => { const __recv = p; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })());
  let ptype = (() => { const __recv = p; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })();
  (() => { const __recv = fn_env; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, pname, bc_type_name_from_type_node(ptype)) : map_set(__recv, pname, bc_type_name_from_type_node(ptype)); })();
  i = (i + 1);
}
  let body = node_get_data5(stmt);
  if ((node_kind(body) == NK_BLOCK)) {
  check_block(body, fn_state, fn_env, fn_return_types, extern_type_names, global_fn_names);
} else {
  check_expr(body, fn_state, fn_env, fn_return_types, extern_type_names, global_fn_names, "move");
}
  return 0;
}
  check_expr(stmt, state, env_types, fn_return_types, extern_type_names, global_fn_names, "move");
  return 0;
}

function borrowcheck_program(program) {
  let fn_return_types = map_new();
  let extern_type_names = set_new();
  let global_type_by_name = map_new();
  let global_fn_names = set_new();
  let body = node_get_data1(program);
  bc_copy_types = set_new();
  bc_copy_alias_types = map_new();
  bc_copy_alias_names = vec_new();
  bc_destructor_aliases = map_new();
  bc_destructor_alias_names = vec_new();
  let i = 0;
  let len = (() => { const __recv = body; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let stmt = (() => { const __recv = body; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let kind = node_kind(stmt);
  if ((kind == NK_EXTERN_TYPE_DECL)) {
  (() => { const __recv = extern_type_names; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(stmt))) : set_add(__recv, get_interned_str(node_get_data1(stmt))); })();
}
  if (((kind == NK_FN_DECL) || (kind == NK_EXTERN_FN_DECL))) {
  let fname = get_interned_str(node_get_data1(stmt));
  (() => { const __recv = global_fn_names; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, fname) : set_add(__recv, fname); })();
  (() => { const __recv = fn_return_types; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, fname, bc_type_name_from_type_node(node_get_data4(stmt))) : map_set(__recv, fname, bc_type_name_from_type_node(node_get_data4(stmt))); })();
}
  if (((kind == NK_LET_DECL) || (kind == NK_EXTERN_LET_DECL))) {
  (() => { const __recv = global_type_by_name; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(stmt)), bc_type_name_from_type_node(node_get_data2(stmt))) : map_set(__recv, get_interned_str(node_get_data1(stmt)), bc_type_name_from_type_node(node_get_data2(stmt))); })();
}
  if ((kind == NK_ENUM_DECL)) {
  (() => { const __recv = bc_copy_types; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(stmt))) : set_add(__recv, get_interned_str(node_get_data1(stmt))); })();
}
  if (((kind == NK_STRUCT_DECL) && (node_get_data4(stmt) == 1))) {
  (() => { const __recv = bc_copy_types; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(stmt))) : set_add(__recv, get_interned_str(node_get_data1(stmt))); })();
}
  if (((kind == NK_TYPE_ALIAS) && (node_get_data4(stmt) == 1))) {
  let alias_name = get_interned_str(node_get_data1(stmt));
  (() => { const __recv = bc_copy_alias_names; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, alias_name) : vec_push(__recv, alias_name); })();
  (() => { const __recv = bc_copy_alias_types; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, alias_name, node_get_data3(stmt)) : map_set(__recv, alias_name, node_get_data3(stmt)); })();
}
  if (((kind == NK_TYPE_ALIAS) && (node_get_data5(stmt) != 0))) {
  let alias_name = get_interned_str(node_get_data1(stmt));
  let destructor_name = get_interned_str(node_get_data5(stmt));
  (() => { const __recv = bc_destructor_aliases; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, alias_name, destructor_name) : map_set(__recv, alias_name, destructor_name); })();
  (() => { const __recv = bc_destructor_alias_names; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, alias_name) : vec_push(__recv, alias_name); })();
}
  i = (i + 1);
}
  i = 0;
  let dlen = (() => { const __recv = bc_destructor_alias_names; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < dlen)) {
  let alias_name = (() => { const __recv = bc_destructor_alias_names; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let destructor_name = (() => { const __recv = bc_destructor_aliases; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, alias_name) : map_get(__recv, alias_name); })();
  let found = false;
  let j = 0;
  while ((j < len)) {
  let stmt = (() => { const __recv = body; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, j) : vec_get(__recv, j); })();
  if (((node_kind(stmt) == NK_FN_DECL) && (() => { const __recv = get_interned_str(node_get_data1(stmt)); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, destructor_name) : str_eq(__recv, destructor_name); })())) {
  found = true;
  let valid = true;
  let params = node_get_data3(stmt);
  if (((() => { const __recv = params; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() != 1)) {
  valid = false;
} else {
  let p0 = (() => { const __recv = params; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })();
  let pname = get_interned_str((() => { const __recv = p0; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })());
  let ptype = (() => { const __recv = p0; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })();
  if ((!(() => { const __recv = pname; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "this") : str_eq(__recv, "this"); })())) {
  valid = false;
}
  if (((((ptype == 0) || (node_kind(ptype) != NK_POINTER_TYPE)) || (node_get_data3(ptype) != 1)) || (!(() => { const __recv = bc_type_name_from_type_node(node_get_data2(ptype)); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, alias_name) : str_eq(__recv, alias_name); })()))) {
  valid = false;
}
}
  if ((!(() => { const __recv = bc_type_name_from_type_node(node_get_data4(stmt)); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "Void") : str_eq(__recv, "Void"); })())) {
  valid = false;
}
  if ((!valid)) {
  panic_with_code("E_TYPE_DESTRUCTOR_SIGNATURE", (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "Destructor '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, destructor_name) : str_concat(__recv, destructor_name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' must have signature fn ") : str_concat(__recv, "' must have signature fn "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, destructor_name) : str_concat(__recv, destructor_name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "(this : *move ") : str_concat(__recv, "(this : *move "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, alias_name) : str_concat(__recv, alias_name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ") : Void") : str_concat(__recv, ") : Void"); })(), "Destructor signatures must use a move receiver of the alias type and return Void.", "Use exactly one receiver parameter named 'this' with type '*move AliasType' and return Void.");
}
  break;
}
  j = (j + 1);
}
  if ((!found)) {
  panic_with_code("E_TYPE_DESTRUCTOR_NOT_FOUND", (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "Destructor '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, destructor_name) : str_concat(__recv, destructor_name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' for alias '") : str_concat(__recv, "' for alias '"); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, alias_name) : str_concat(__recv, alias_name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' was not found") : str_concat(__recv, "' was not found"); })(), "A type alias referenced a destructor function that does not exist.", "Declare the destructor function before using it in 'type Alias = ... then destructor'.");
}
  i = (i + 1);
}
  i = 0;
  let copy_alias_count = (() => { const __recv = bc_copy_alias_names; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < copy_alias_count)) {
  let alias_name = (() => { const __recv = bc_copy_alias_names; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let alias_type = (() => { const __recv = bc_copy_alias_types; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, alias_name) : map_get(__recv, alias_name); })();
  let visiting = set_new();
  (() => { const __recv = visiting; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, alias_name) : set_add(__recv, alias_name); })();
  if ((!bc_type_node_is_copyable(alias_type, extern_type_names, visiting))) {
  panic_with_code("E_BORROW_INVALID_COPY_ALIAS", (() => { const __recv = (() => { const __recv = "copy type "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, alias_name) : str_concat(__recv, alias_name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " must alias a copy-compatible type") : str_concat(__recv, " must alias a copy-compatible type"); })(), "A type alias marked 'copy' resolved to a non-copy type under move semantics.", "Only mark aliases as 'copy' when the aliased type is copy-compatible (primitives, pointers, enums, copy structs, or other copy aliases).");
}
  (() => { const __recv = bc_copy_types; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, alias_name) : set_add(__recv, alias_name); })();
  i = (i + 1);
}
  let state = state_new();
  let env = global_type_by_name;
  bc_global_value_types = global_type_by_name;
  i = 0;
  while ((i < len)) {
  check_stmt((() => { const __recv = body; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(), state, env, fn_return_types, extern_type_names, global_fn_names);
  i = (i + 1);
}
  return program;
}

function selfhost_borrowcheck_marker() { return 0; }

function emit_stmt(n) {
  let kind = node_kind(n);
  if ((kind == NK_LET_DECL)) {
  let name_idx = node_get_data1(n);
  let name = get_interned_str(name_idx);
  let value = emit_expr(node_get_data3(n));
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = "let "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " = ") : str_concat(__recv, " = "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = value; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ";") : str_concat(__recv, ";"); })()) : str_concat(__recv, (() => { const __recv = value; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ";") : str_concat(__recv, ";"); })()); })();
}
  if ((kind == NK_IMPORT_DECL)) {
  return "// import placeholder";
}
  if ((kind == NK_EXPR_STMT)) {
  return (() => { const __recv = emit_expr(node_get_data1(n)); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ";") : str_concat(__recv, ";"); })();
}
  if ((kind == NK_ASSIGN_STMT)) {
  let target = emit_expr(node_get_data1(n));
  let value = emit_expr(node_get_data2(n));
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = target; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " = ") : str_concat(__recv, " = "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, value) : str_concat(__recv, value); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ";") : str_concat(__recv, ";"); })();
}
  if ((kind == NK_RETURN_STMT)) {
  let value = node_get_data1(n);
  if ((value == 0)) {
  return "return;";
}
  return (() => { const __recv = "return "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = emit_expr(value); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ";") : str_concat(__recv, ";"); })()) : str_concat(__recv, (() => { const __recv = emit_expr(value); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ";") : str_concat(__recv, ";"); })()); })();
}
  if ((kind == NK_IF_STMT)) {
  let cond = emit_expr(node_get_data1(n));
  let then_b = emit_block(node_get_data2(n));
  let else_b = node_get_data3(n);
  if ((else_b == 0)) {
  return (() => { const __recv = (() => { const __recv = "if ("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, cond) : str_concat(__recv, cond); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = ") "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, then_b) : str_concat(__recv, then_b); })()) : str_concat(__recv, (() => { const __recv = ") "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, then_b) : str_concat(__recv, then_b); })()); })();
}
  return str_concat((() => { const __recv = (() => { const __recv = (() => { const __recv = "if ("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, cond) : str_concat(__recv, cond); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ") ") : str_concat(__recv, ") "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, then_b) : str_concat(__recv, then_b); })(), (() => { const __recv = " else "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, emit_stmt_or_block(else_b)) : str_concat(__recv, emit_stmt_or_block(else_b)); })());
}
  if ((kind == NK_IF_EXPR)) {
  let cond = emit_expr(node_get_data1(n));
  let then_b = node_get_data2(n);
  let else_b = node_get_data3(n);
  let then_str = emit_stmt_or_block(then_b);
  if ((else_b == 0)) {
  return (() => { const __recv = (() => { const __recv = "if ("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, cond) : str_concat(__recv, cond); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = ") "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, then_str) : str_concat(__recv, then_str); })()) : str_concat(__recv, (() => { const __recv = ") "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, then_str) : str_concat(__recv, then_str); })()); })();
}
  return str_concat((() => { const __recv = (() => { const __recv = (() => { const __recv = "if ("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, cond) : str_concat(__recv, cond); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ") ") : str_concat(__recv, ") "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, then_str) : str_concat(__recv, then_str); })(), (() => { const __recv = " else "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, emit_stmt_or_block(else_b)) : str_concat(__recv, emit_stmt_or_block(else_b)); })());
}
  if ((kind == NK_WHILE_STMT)) {
  let cond = emit_expr(node_get_data1(n));
  let body = emit_block(node_get_data2(n));
  return (() => { const __recv = (() => { const __recv = "while ("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, cond) : str_concat(__recv, cond); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = ") "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, body) : str_concat(__recv, body); })()) : str_concat(__recv, (() => { const __recv = ") "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, body) : str_concat(__recv, body); })()); })();
}
  if ((kind == NK_FOR_STMT)) {
  let iter_idx = node_get_data1(n);
  let iter = get_interned_str(iter_idx);
  let start = emit_expr(node_get_data2(n));
  let end = emit_expr(node_get_data3(n));
  let body = emit_block(node_get_data4(n));
  return str_concat(str_concat(str_concat(str_concat((() => { const __recv = (() => { const __recv = (() => { const __recv = "for (let "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, iter) : str_concat(__recv, iter); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " = ") : str_concat(__recv, " = "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, start) : str_concat(__recv, start); })(), (() => { const __recv = "; "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, iter) : str_concat(__recv, iter); })()), (() => { const __recv = " < "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, end) : str_concat(__recv, end); })()), (() => { const __recv = "; "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = iter; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "++) ") : str_concat(__recv, "++) "); })()) : str_concat(__recv, (() => { const __recv = iter; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "++) ") : str_concat(__recv, "++) "); })()); })()), body);
}
  if ((kind == NK_LOOP_STMT)) {
  let body = emit_block(node_get_data1(n));
  return (() => { const __recv = "while (true) "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, body) : str_concat(__recv, body); })();
}
  if ((kind == NK_BREAK_STMT)) {
  return "break;";
}
  if ((kind == NK_CONTINUE_STMT)) {
  return "continue;";
}
  if ((kind == NK_INTO_STMT)) {
  let cname = get_interned_str(node_get_data1(n));
  return (() => { const __recv = "// into "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, cname) : str_concat(__recv, cname); })();
}
  if ((kind == NK_LIFETIME_STMT)) {
  return emit_block(node_get_data2(n));
}
  if ((kind == NK_BLOCK)) {
  return emit_block(n);
}
  if ((kind == NK_EXPECT_FN_DECL)) {
  let name_idx = node_get_data1(n);
  let name = get_interned_str(name_idx);
  return (() => { const __recv = "// expect fn "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })();
}
  if ((((kind == NK_FN_DECL) || (kind == NK_CLASS_FN_DECL)) || (kind == NK_ACTUAL_FN_DECL))) {
  let name_idx = node_get_data1(n);
  let name = get_interned_str(name_idx);
  let params = node_get_data3(n);
  let body = node_get_data5(n);
  let param_names = vec_new();
  let i = 0;
  let len = (() => { const __recv = params; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let param = (() => { const __recv = params; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  (() => { const __recv = param_names; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, get_interned_str((() => { const __recv = param; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })())) : vec_push(__recv, get_interned_str((() => { const __recv = param; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })())); })();
  i = (i + 1);
}
  let params_str = (() => { const __recv = param_names; const __dyn = __recv?.table?.vec_join; return __dyn ? __dyn(__recv.ref, ", ") : vec_join(__recv, ", "); })();
  if ((node_kind(body) == NK_BLOCK)) {
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = "function "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = "("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, params_str) : str_concat(__recv, params_str); })()) : str_concat(__recv, (() => { const __recv = "("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, params_str) : str_concat(__recv, params_str); })()); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = ") "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, emit_fn_block(body)) : str_concat(__recv, emit_fn_block(body)); })()) : str_concat(__recv, (() => { const __recv = ") "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, emit_fn_block(body)) : str_concat(__recv, emit_fn_block(body)); })()); })();
}
  return str_concat((() => { const __recv = (() => { const __recv = (() => { const __recv = "function "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = "("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, params_str) : str_concat(__recv, params_str); })()) : str_concat(__recv, (() => { const __recv = "("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, params_str) : str_concat(__recv, params_str); })()); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ") { return ") : str_concat(__recv, ") { return "); })(), (() => { const __recv = emit_expr(body); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "; }") : str_concat(__recv, "; }"); })());
}
  if ((kind == NK_STRUCT_DECL)) {
  let name_idx = node_get_data1(n);
  let name = get_interned_str(name_idx);
  let fields = node_get_data3(n);
  let sb = sb_new();
  sb_append(sb, "function ");
  sb_append(sb, name);
  sb_append(sb, "(fields = {}) { return { __tag: \"");
  sb_append(sb, name);
  sb_append(sb, "\"");
  let i = 0;
  let len = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let field = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let fname = get_interned_str((() => { const __recv = field; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })());
  sb_append(sb, ", ");
  sb_append(sb, fname);
  sb_append(sb, ": fields.");
  sb_append(sb, fname);
  i = (i + 1);
}
  sb_append(sb, " }; }");
  return sb_build(sb);
}
  if ((kind == NK_TYPE_ALIAS)) {
  let name_idx = node_get_data1(n);
  let name = get_interned_str(name_idx);
  return (() => { const __recv = (() => { const __recv = "// type "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " = ...") : str_concat(__recv, " = ..."); })();
}
  if ((kind == NK_ENUM_DECL)) {
  let name = get_interned_str(node_get_data1(n));
  let variants = node_get_data2(n);
  let sb = sb_new();
  sb_append(sb, "const ");
  sb_append(sb, name);
  sb_append(sb, " = { ");
  let i = 0;
  let len = (() => { const __recv = variants; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  if ((i > 0)) {
  sb_append(sb, ", ");
}
  let v = get_interned_str((() => { const __recv = variants; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })());
  sb_append(sb, v);
  sb_append(sb, ": { __tag: \"");
  sb_append(sb, v);
  sb_append(sb, "\" }");
  i = (i + 1);
}
  sb_append(sb, " }; ");
  return sb_build(sb);
}
  if ((kind == NK_OBJECT_DECL)) {
  let name = get_interned_str(node_get_data1(n));
  let inputs = node_get_data3(n);
  if (((inputs == 0) || ((() => { const __recv = inputs; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() == 0))) {
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "const "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " = { __tag: \"") : str_concat(__recv, " = { __tag: \""); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "\" }; ") : str_concat(__recv, "\" }; "); })();
}
  let sb = sb_new();
  sb_append(sb, "const ");
  sb_append(sb, name);
  sb_append(sb, " = (() => { const __cache = new Map(); return (fields = {}) => { const __key = JSON.stringify([");
  let i = 0;
  let len = (() => { const __recv = inputs; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  if ((i > 0)) {
  sb_append(sb, ", ");
}
  let input_field = (() => { const __recv = inputs; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let fname = get_interned_str((() => { const __recv = input_field; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })());
  sb_append(sb, "fields.");
  sb_append(sb, fname);
  i = (i + 1);
}
  sb_append(sb, "]); const __cached = __cache.get(__key); if (__cached !== undefined) return __cached; const __value = { __tag: \"");
  sb_append(sb, name);
  sb_append(sb, "\"");
  i = 0;
  while ((i < len)) {
  let input_field = (() => { const __recv = inputs; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let fname = get_interned_str((() => { const __recv = input_field; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })());
  sb_append(sb, ", ");
  sb_append(sb, fname);
  sb_append(sb, ": fields.");
  sb_append(sb, fname);
  i = (i + 1);
}
  sb_append(sb, " }; __cache.set(__key, __value); return __value; }; })();");
  return sb_build(sb);
}
  if ((kind == NK_CONTRACT_DECL)) {
  let name = get_interned_str(node_get_data1(n));
  return (() => { const __recv = "// contract "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })();
}
  if ((kind == NK_EXTERN_FN_DECL)) {
  let name_idx = node_get_data1(n);
  let name = get_interned_str(name_idx);
  return (() => { const __recv = "// extern fn "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })();
}
  if ((kind == NK_EXTERN_LET_DECL)) {
  let name_idx = node_get_data1(n);
  let name = get_interned_str(name_idx);
  return (() => { const __recv = "// extern let "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })();
}
  if ((kind == NK_EXTERN_TYPE_DECL)) {
  let name_idx = node_get_data1(n);
  let name = get_interned_str(name_idx);
  return (() => { const __recv = "// extern type "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })();
}
  return "";
}

function emit_stmt_or_block(n) {
  if ((node_kind(n) == NK_BLOCK)) {
  return emit_block(n);
}
  return (() => { const __recv = "{ "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = emit_stmt(n); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " }") : str_concat(__recv, " }"); })()) : str_concat(__recv, (() => { const __recv = emit_stmt(n); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " }") : str_concat(__recv, " }"); })()); })();
}

function emit_block(n) {
  let stmts = node_get_data1(n);
  let sb = sb_new();
  sb_append(sb, "{\n");
  let i = 0;
  let len = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  sb_append(sb, "  ");
  sb_append(sb, emit_stmt((() => { const __recv = stmts; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })()));
  sb_append(sb, "\n");
  i = (i + 1);
}
  sb_append(sb, "}");
  return sb_build(sb);
}

function emit_block_as_iife(n) {
  let stmts = node_get_data1(n);
  let len = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  if ((len == 0)) {
  return "(() => undefined)()";
}
  let sb = sb_new();
  sb_append(sb, "(() => {\n");
  let i = 0;
  while ((i < len)) {
  let stmt = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let is_last = (i == (len - 1));
  let kind = node_kind(stmt);
  if ((is_last && (kind == NK_EXPR_STMT))) {
  sb_append(sb, "  return ");
  sb_append(sb, emit_expr(node_get_data1(stmt)));
  sb_append(sb, ";\n");
} else { if ((is_last && ((kind == NK_IF_STMT) || (kind == NK_IF_EXPR)))) {
  sb_append(sb, "  return ");
  sb_append(sb, emit_if_as_expr(stmt));
  sb_append(sb, ";\n");
} else {
  sb_append(sb, "  ");
  sb_append(sb, emit_stmt(stmt));
  sb_append(sb, "\n");
} }
  i = (i + 1);
}
  sb_append(sb, "})()");
  return sb_build(sb);
}

function emit_fn_block(n) {
  let stmts = node_get_data1(n);
  let len = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  if ((len == 0)) {
  return "{\n}";
}
  let sb = sb_new();
  sb_append(sb, "{\n");
  let i = 0;
  while ((i < len)) {
  let stmt = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let is_last = (i == (len - 1));
  let kind = node_kind(stmt);
  if ((is_last && (kind == NK_EXPR_STMT))) {
  sb_append(sb, "  return ");
  sb_append(sb, emit_expr(node_get_data1(stmt)));
  sb_append(sb, ";\n");
} else { if ((is_last && ((kind == NK_IF_STMT) || (kind == NK_IF_EXPR)))) {
  sb_append(sb, "  return ");
  sb_append(sb, emit_if_as_expr(stmt));
  sb_append(sb, ";\n");
} else {
  sb_append(sb, "  ");
  sb_append(sb, emit_stmt(stmt));
  sb_append(sb, "\n");
} }
  i = (i + 1);
}
  sb_append(sb, "}");
  return sb_build(sb);
}

function emit_if_as_expr(n) {
  let cond = emit_expr(node_get_data1(n));
  let then_branch = node_get_data2(n);
  let else_branch = node_get_data3(n);
  let then_code = emit_branch_as_expr(then_branch);
  let else_code = (((else_branch == 0)) ? (() => {
  return "undefined";
})() : (() => {
  return emit_branch_as_expr(else_branch);
})());
  return str_concat((() => { const __recv = (() => { const __recv = (() => { const __recv = "(("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, cond) : str_concat(__recv, cond); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ") ? ") : str_concat(__recv, ") ? "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = then_code; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " : ") : str_concat(__recv, " : "); })()) : str_concat(__recv, (() => { const __recv = then_code; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " : ") : str_concat(__recv, " : "); })()); })(), (() => { const __recv = else_code; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ")") : str_concat(__recv, ")"); })());
}

function emit_branch_as_expr(n) {
  let kind = node_kind(n);
  if ((kind == NK_BLOCK)) {
  let stmts = node_get_data1(n);
  let len = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  if ((len == 0)) {
  return "undefined";
}
  let sb = sb_new();
  sb_append(sb, "(() => {\n");
  let i = 0;
  while ((i < len)) {
  let stmt = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let is_last = (i == (len - 1));
  let stmt_kind = node_kind(stmt);
  if ((is_last && (stmt_kind == NK_EXPR_STMT))) {
  sb_append(sb, "    return ");
  sb_append(sb, emit_expr(node_get_data1(stmt)));
  sb_append(sb, ";\n");
} else { if ((is_last && ((stmt_kind == NK_IF_STMT) || (stmt_kind == NK_IF_EXPR)))) {
  sb_append(sb, "    return ");
  sb_append(sb, emit_if_as_expr(stmt));
  sb_append(sb, ";\n");
} else {
  sb_append(sb, "    ");
  sb_append(sb, emit_stmt(stmt));
  sb_append(sb, "\n");
} }
  i = (i + 1);
}
  sb_append(sb, "  })()");
  return sb_build(sb);
}
  if (((kind == NK_IF_STMT) || (kind == NK_IF_EXPR))) {
  return emit_if_as_expr(n);
}
  return emit_expr(n);
}

function generate_js(program) {
  let stmts = node_get_data1(program);
  let sb = sb_new();
  sb_append(sb, "\"use strict\";\n\n");
  let i = 0;
  let len = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  sb_append(sb, emit_stmt((() => { const __recv = stmts; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })()));
  sb_append(sb, "\n\n");
  i = (i + 1);
}
  return sb_build(sb);
}

function selfhost_codegen_stmt_marker() { return 0; }

let lint_issue_records = vec_new();

function lint_issue_sep_field() { return "\u001f"; }

function lint_issue_sep_record() { return "\u001e"; }

function lint_issue_encode(code, message, reason, fix) {
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = code; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, lint_issue_sep_field()) : str_concat(__recv, lint_issue_sep_field()); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, message) : str_concat(__recv, message); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, lint_issue_sep_field()) : str_concat(__recv, lint_issue_sep_field()); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, reason) : str_concat(__recv, reason); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, lint_issue_sep_field()) : str_concat(__recv, lint_issue_sep_field()); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, fix) : str_concat(__recv, fix); })();
}

function lint_add_issue(code, message, reason, fix) {
  (() => { const __recv = lint_issue_records; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, lint_issue_encode(code, message, reason, fix)) : vec_push(__recv, lint_issue_encode(code, message, reason, fix)); })();
  return 0;
}

function lint_reset() {
  (() => { const __recv = lint_issue_records; const __dyn = __recv?.table?.vec_clear; return __dyn ? __dyn(__recv.ref) : vec_clear(__recv); })();
  return 0;
}

function lint_take_issues() {
  let s = (() => { const __recv = lint_issue_records; const __dyn = __recv?.table?.vec_join; return __dyn ? __dyn(__recv.ref, lint_issue_sep_record()) : vec_join(__recv, lint_issue_sep_record()); })();
  (() => { const __recv = lint_issue_records; const __dyn = __recv?.table?.vec_clear; return __dyn ? __dyn(__recv.ref) : vec_clear(__recv); })();
  return s;
}

function lint_check_file_length(file_path, max_effective_lines) {
  let count = lint_effective_line_count();
  if ((count > max_effective_lines)) {
  lint_add_issue("E_LINT_FILE_TOO_LONG", (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "File exceeds "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(max_effective_lines)) : str_concat(__recv, int_to_string(max_effective_lines)); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " effective lines (") : str_concat(__recv, " effective lines ("); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(count)) : str_concat(__recv, int_to_string(count)); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ")") : str_concat(__recv, ")"); })(), "Large files are harder to review and maintain; this file exceeds the maximum effective line budget after excluding comments and blank lines.", (() => { const __recv = (() => { const __recv = "Split this file into smaller modules so each file has at most "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, int_to_string(max_effective_lines)) : str_concat(__recv, int_to_string(max_effective_lines)); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " non-comment, non-whitespace lines.") : str_concat(__recv, " non-comment, non-whitespace lines."); })());
}
  return 0;
}

function lint_collect_expr(expr, receiver_extern_fns, reads) {
  if ((expr == 0)) {
  return 0;
}
  let kind = node_kind(expr);
  if ((kind == NK_IDENTIFIER)) {
  (() => { const __recv = reads; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(expr))) : set_add(__recv, get_interned_str(node_get_data1(expr))); })();
  return 0;
}
  if (((kind == NK_UNARY_EXPR) || (kind == NK_UNWRAP_EXPR))) {
  lint_collect_expr(node_get_data2(expr), receiver_extern_fns, reads);
  if ((kind == NK_UNWRAP_EXPR)) {
  lint_collect_expr(node_get_data1(expr), receiver_extern_fns, reads);
}
  return 0;
}
  if ((kind == NK_BINARY_EXPR)) {
  lint_collect_expr(node_get_data2(expr), receiver_extern_fns, reads);
  lint_collect_expr(node_get_data3(expr), receiver_extern_fns, reads);
  return 0;
}
  if ((kind == NK_CALL_EXPR)) {
  let callee = node_get_data1(expr);
  let args = node_get_data2(expr);
  if (((node_kind(callee) == NK_IDENTIFIER) && ((() => { const __recv = args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() > 0))) {
  let name = get_interned_str(node_get_data1(callee));
  let call_style = node_get_data3(expr);
  if (((() => { const __recv = receiver_extern_fns; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })() && (call_style != 1))) {
  lint_add_issue("E_LINT_PREFER_RECEIVER_CALL", (() => { const __recv = (() => { const __recv = "Prefer receiver-call syntax for '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "'") : str_concat(__recv, "'"); })(), "This extern function declares a receiver as its first 'this' parameter, so calling it as a free function is less idiomatic.", (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "Rewrite '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "(x, ...)' as 'x.") : str_concat(__recv, "(x, ...)' as 'x."); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "(...)'.") : str_concat(__recv, "(...)'."); })());
}
}
  lint_collect_expr(callee, receiver_extern_fns, reads);
  let i = 0;
  let len = (() => { const __recv = args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  lint_collect_expr((() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(), receiver_extern_fns, reads);
  i = (i + 1);
}
  return 0;
}
  if ((kind == NK_MEMBER_EXPR)) {
  lint_collect_expr(node_get_data1(expr), receiver_extern_fns, reads);
  return 0;
}
  if ((kind == NK_INDEX_EXPR)) {
  lint_collect_expr(node_get_data1(expr), receiver_extern_fns, reads);
  lint_collect_expr(node_get_data2(expr), receiver_extern_fns, reads);
  return 0;
}
  if ((kind == NK_STRUCT_INIT)) {
  let fields = node_get_data2(expr);
  let i = 0;
  let len = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let field = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  lint_collect_expr((() => { const __recv = field; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })(), receiver_extern_fns, reads);
  i = (i + 1);
}
  return 0;
}
  if ((kind == NK_IF_EXPR)) {
  let cond = node_get_data1(expr);
  if ((node_kind(cond) == NK_BOOL_LIT)) {
  lint_add_issue("E_LINT_CONSTANT_CONDITION", "Constant condition in if-expression/statement", "A constant condition means one branch is unreachable, which usually indicates dead or unintended code.", "Use a non-constant condition, or simplify by keeping only the branch that will execute.");
}
  lint_collect_expr(cond, receiver_extern_fns, reads);
  lint_collect_stmt(node_get_data2(expr), receiver_extern_fns, reads, set_new(), vec_new());
  if ((node_get_data3(expr) != 0)) {
  lint_collect_stmt(node_get_data3(expr), receiver_extern_fns, reads, set_new(), vec_new());
}
  return 0;
}
  if ((kind == NK_MATCH_EXPR)) {
  lint_collect_expr(node_get_data1(expr), receiver_extern_fns, reads);
  let cases = node_get_data2(expr);
  let i = 0;
  let len = (() => { const __recv = cases; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let c = (() => { const __recv = cases; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  lint_collect_stmt((() => { const __recv = c; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })(), receiver_extern_fns, reads, set_new(), vec_new());
  i = (i + 1);
}
  return 0;
}
  if ((kind == NK_IS_EXPR)) {
  lint_collect_expr(node_get_data1(expr), receiver_extern_fns, reads);
}
  return 0;
}

function lint_collect_stmt(stmt, receiver_extern_fns, reads, declared_set, declared_names) {
  if ((stmt == 0)) {
  return 0;
}
  let kind = node_kind(stmt);
  if ((kind == NK_LET_DECL)) {
  let name = get_interned_str(node_get_data1(stmt));
  if ((!(() => { const __recv = declared_set; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })())) {
  (() => { const __recv = declared_set; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, name) : set_add(__recv, name); })();
  (() => { const __recv = declared_names; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, name) : vec_push(__recv, name); })();
}
  lint_collect_expr(node_get_data3(stmt), receiver_extern_fns, reads);
  return 0;
}
  if ((kind == NK_BLOCK)) {
  let stmts = node_get_data1(stmt);
  if (((() => { const __recv = stmts; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() == 0)) {
  lint_add_issue("E_LINT_EMPTY_BLOCK", "Empty block has no effect", "An empty block executes no statements, which is often accidental and can hide incomplete logic.", "Add the intended statements to the block, or remove the block if it is unnecessary.");
}
  let i = 0;
  let len = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  lint_collect_stmt((() => { const __recv = stmts; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(), receiver_extern_fns, reads, declared_set, declared_names);
  i = (i + 1);
}
  return 0;
}
  if ((kind == NK_EXPR_STMT)) {
  lint_collect_expr(node_get_data1(stmt), receiver_extern_fns, reads);
  return 0;
}
  if ((kind == NK_ASSIGN_STMT)) {
  lint_collect_expr(node_get_data1(stmt), receiver_extern_fns, reads);
  lint_collect_expr(node_get_data2(stmt), receiver_extern_fns, reads);
  return 0;
}
  if ((kind == NK_RETURN_STMT)) {
  lint_collect_expr(node_get_data1(stmt), receiver_extern_fns, reads);
  return 0;
}
  if ((kind == NK_IF_STMT)) {
  let cond = node_get_data1(stmt);
  if ((node_kind(cond) == NK_BOOL_LIT)) {
  lint_add_issue("E_LINT_CONSTANT_CONDITION", "Constant condition in if-expression/statement", "A constant condition means one branch is unreachable, which usually indicates dead or unintended code.", "Use a non-constant condition, or simplify by keeping only the branch that will execute.");
}
  lint_collect_expr(cond, receiver_extern_fns, reads);
  lint_collect_stmt(node_get_data2(stmt), receiver_extern_fns, reads, declared_set, declared_names);
  lint_collect_stmt(node_get_data3(stmt), receiver_extern_fns, reads, declared_set, declared_names);
  return 0;
}
  if ((kind == NK_FOR_STMT)) {
  lint_collect_expr(node_get_data2(stmt), receiver_extern_fns, reads);
  lint_collect_expr(node_get_data3(stmt), receiver_extern_fns, reads);
  lint_collect_stmt(node_get_data4(stmt), receiver_extern_fns, reads, declared_set, declared_names);
  return 0;
}
  if ((kind == NK_WHILE_STMT)) {
  lint_collect_expr(node_get_data1(stmt), receiver_extern_fns, reads);
  lint_collect_stmt(node_get_data2(stmt), receiver_extern_fns, reads, declared_set, declared_names);
  return 0;
}
  if (((kind == NK_FN_DECL) || (kind == NK_CLASS_FN_DECL))) {
  lint_collect_stmt(node_get_data5(stmt), receiver_extern_fns, reads, declared_set, declared_names);
  return 0;
}
  lint_collect_expr(stmt, receiver_extern_fns, reads);
  return 0;
}

function lint_add_circular_import_issue(cycle_text) {
  return lint_add_issue("E_LINT_CIRCULAR_IMPORT", (() => { const __recv = "Circular import detected: "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, cycle_text) : str_concat(__recv, cycle_text); })(), "Circular dependencies between modules make dependency flow harder to understand and maintain.", "Refactor shared declarations into a third module and have each side import that shared module instead.");
}

function lint_program(program, file_path, max_effective_lines) {
  lint_check_file_length(file_path, max_effective_lines);
  let receiver_extern_fns = set_new();
  let reads = set_new();
  let declared_set = set_new();
  let declared_names = vec_new();
  let body = node_get_data1(program);
  let i = 0;
  let len = (() => { const __recv = body; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let stmt = (() => { const __recv = body; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  if ((node_kind(stmt) == NK_EXTERN_FN_DECL)) {
  let params = node_get_data3(stmt);
  if (((() => { const __recv = params; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() > 0)) {
  let p0 = (() => { const __recv = params; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })();
  let p0name = get_interned_str((() => { const __recv = p0; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })());
  if ((() => { const __recv = p0name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "this") : str_eq(__recv, "this"); })()) {
  (() => { const __recv = receiver_extern_fns; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(stmt))) : set_add(__recv, get_interned_str(node_get_data1(stmt))); })();
}
}
}
  i = (i + 1);
}
  i = 0;
  while ((i < len)) {
  lint_collect_stmt((() => { const __recv = body; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(), receiver_extern_fns, reads, declared_set, declared_names);
  i = (i + 1);
}
  i = 0;
  let dlen = (() => { const __recv = declared_names; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < dlen)) {
  let name = (() => { const __recv = declared_names; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  if (((!(() => { const __recv = name; const __dyn = __recv?.table?.str_starts_with; return __dyn ? __dyn(__recv.ref, "_") : str_starts_with(__recv, "_"); })()) && (!(() => { const __recv = reads; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })()))) {
  lint_add_issue("E_LINT_UNUSED_BINDING", (() => { const __recv = (() => { const __recv = "Unused binding '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "'") : str_concat(__recv, "'"); })(), "Unused bindings increase cognitive load and can indicate leftover or incomplete code paths.", "Remove the binding if unused, use it intentionally, or rename it to start with '_' to mark it as intentionally unused.");
}
  i = (i + 1);
}
  return 0;
}

function selfhost_linter_marker() { return 0; }

function module_loader_sanitize_max_effective_lines(max_effective_lines) {
  return (((max_effective_lines <= 0)) ? (() => {
  return 500;
})() : (() => {
  return max_effective_lines;
})());
}

function module_loader_normalize_flag(value) {
  return (((value == 0)) ? (() => {
  return 0;
})() : (() => {
  return 1;
})());
}

function module_parts_to_relative_path(parts) {
  let sb = sb_new();
  let i = 0;
  let len = (() => { const __recv = parts; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  if ((i > 0)) {
  sb_append(sb, "/");
}
  sb_append(sb, get_interned_str((() => { const __recv = parts; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })()));
  i = (i + 1);
}
  sb_append(sb, ".tuff");
  return sb_build(sb);
}

function join_sources(sources) {
  let sb = sb_new();
  let i = 0;
  let len = (() => { const __recv = sources; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  if ((i > 0)) {
  sb_append(sb, "\n\n");
}
  sb_append(sb, (() => { const __recv = sources; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })());
  i = (i + 1);
}
  return sb_build(sb);
}

function strip_import_decls(program) {
  let stmts = node_get_data1(program);
  let filtered = vec_new();
  let i = 0;
  let len = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let stmt = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  if ((node_kind(stmt) != 6)) {
  (() => { const __recv = filtered; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, stmt) : vec_push(__recv, stmt); })();
}
  i = (i + 1);
}
  node_set_data1(program, filtered);
  return program;
}

function is_module_decl_kind(kind) {
  return (((((((((((kind == 2) || (kind == 16)) || (kind == 3)) || (kind == 60)) || (kind == 63)) || (kind == 65)) || (kind == 4)) || (kind == 5)) || (kind == 17)) || (kind == 18)) || (kind == 19));
}

function collect_module_declarations(stmts) {
  let declared = set_new();
  let i = 0;
  let len = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let stmt = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let kind = node_kind(stmt);
  if (is_module_decl_kind(kind)) {
  (() => { const __recv = declared; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, get_interned_str(node_get_data1(stmt))) : set_add(__recv, get_interned_str(node_get_data1(stmt))); })();
}
  i = (i + 1);
}
  return declared;
}

function module_scope_define(scopes, depth, name) {
  let scope = (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, depth) : vec_get(__recv, depth); })();
  (() => { const __recv = scope; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, name) : set_add(__recv, name); })();
  return 0;
}

function module_scope_has(scopes, depth, name) {
  let i = depth;
  while ((i >= 0)) {
  if ((() => { const __recv = (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(); const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })()) {
  return true;
}
  i = (i - 1);
}
  return false;
}

function module_check_expr_implicit_imports(n, declared, imported, all_exported_declared, all_extern_declared, scopes, depth) {
  if ((n == 0)) {
  return 0;
}
  let kind = node_kind(n);
  if ((kind == 24)) {
  let name = get_interned_str(node_get_data1(n));
  if ((((!module_scope_has(scopes, depth, name)) && (!(() => { const __recv = declared; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })())) && (!(() => { const __recv = imported; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })()))) {
  if (((() => { const __recv = all_exported_declared; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })() && (!(() => { const __recv = all_extern_declared; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, name) : set_has(__recv, name); })()))) {
  panic_with_code("E_MODULE_IMPLICIT_IMPORT", (() => { const __recv = (() => { const __recv = "Strict module imports require explicit import for symbol '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "'") : str_concat(__recv, "'"); })(), "A module referenced a symbol declared in another module without importing it explicitly.", "Add the symbol to the module import list (for example: let { symbol } = moduleName;).");
}
}
  return 0;
}
  if ((kind == 25)) {
  module_check_expr_implicit_imports(node_get_data2(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  module_check_expr_implicit_imports(node_get_data3(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  return 0;
}
  if (((kind == 26) || (kind == 34))) {
  module_check_expr_implicit_imports(node_get_data2(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  if ((kind == 34)) {
  module_check_expr_implicit_imports(node_get_data1(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
}
  return 0;
}
  if ((kind == 27)) {
  module_check_expr_implicit_imports(node_get_data1(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  let args = node_get_data2(n);
  let i = 0;
  let len = (() => { const __recv = args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  module_check_expr_implicit_imports((() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  i = (i + 1);
}
  return 0;
}
  if ((kind == 28)) {
  module_check_expr_implicit_imports(node_get_data1(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  return 0;
}
  if ((kind == 29)) {
  module_check_expr_implicit_imports(node_get_data1(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  module_check_expr_implicit_imports(node_get_data2(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  return 0;
}
  if ((kind == 30)) {
  let fields = node_get_data2(n);
  let i = 0;
  let len = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let f = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  module_check_expr_implicit_imports((() => { const __recv = f; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })(), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  i = (i + 1);
}
  return 0;
}
  if ((kind == 31)) {
  module_check_expr_implicit_imports(node_get_data1(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  module_check_stmt_implicit_imports(node_get_data2(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  if ((node_get_data3(n) != 0)) {
  module_check_stmt_implicit_imports(node_get_data3(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
}
  return 0;
}
  if ((kind == 32)) {
  module_check_expr_implicit_imports(node_get_data1(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  let cases = node_get_data2(n);
  let i = 0;
  let len = (() => { const __recv = cases; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let case_node = (() => { const __recv = cases; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let pat = (() => { const __recv = case_node; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })();
  let body = (() => { const __recv = case_node; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })();
  let next_depth = (depth + 1);
  (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, set_new()) : vec_push(__recv, set_new()); })();
  if ((node_kind(pat) == 53)) {
  let fields = node_get_data2(pat);
  let j = 0;
  let fLen = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((j < fLen)) {
  module_scope_define(scopes, next_depth, get_interned_str((() => { const __recv = fields; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, j) : vec_get(__recv, j); })()));
  j = (j + 1);
}
} else { if ((node_kind(pat) == 52)) {
  let pat_name = get_interned_str(node_get_data1(pat));
  if (((!(() => { const __recv = declared; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, pat_name) : set_has(__recv, pat_name); })()) && (!(() => { const __recv = imported; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, pat_name) : set_has(__recv, pat_name); })()))) {
  module_scope_define(scopes, next_depth, pat_name);
}
} }
  module_check_stmt_implicit_imports(body, declared, imported, all_exported_declared, all_extern_declared, scopes, next_depth);
  (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_pop; return __dyn ? __dyn(__recv.ref) : vec_pop(__recv); })();
  i = (i + 1);
}
  return 0;
}
  if ((kind == 33)) {
  module_check_expr_implicit_imports(node_get_data1(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
}
  return 0;
}

function module_check_stmt_implicit_imports(n, declared, imported, all_exported_declared, all_extern_declared, scopes, depth) {
  if ((n == 0)) {
  return 0;
}
  let kind = node_kind(n);
  if ((kind == 12)) {
  let next_depth = (depth + 1);
  (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, set_new()) : vec_push(__recv, set_new()); })();
  let stmts = node_get_data1(n);
  let i = 0;
  let len = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  module_check_stmt_implicit_imports((() => { const __recv = stmts; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(), declared, imported, all_exported_declared, all_extern_declared, scopes, next_depth);
  i = (i + 1);
}
  (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_pop; return __dyn ? __dyn(__recv.ref) : vec_pop(__recv); })();
  return 0;
}
  if (((kind == 2) || (kind == 16))) {
  let fnScopes = vec_new();
  (() => { const __recv = fnScopes; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, set_new()) : vec_push(__recv, set_new()); })();
  let params = node_get_data3(n);
  let i = 0;
  let len = (() => { const __recv = params; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let p = (() => { const __recv = params; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  module_scope_define(fnScopes, 0, get_interned_str((() => { const __recv = p; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })()));
  i = (i + 1);
}
  module_check_stmt_implicit_imports(node_get_data5(n), declared, imported, all_exported_declared, all_extern_declared, fnScopes, 0);
  return 0;
}
  if ((kind == 5)) {
  module_check_expr_implicit_imports(node_get_data3(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  module_scope_define(scopes, depth, get_interned_str(node_get_data1(n)));
  return 0;
}
  if ((kind == 6)) {
  let names = node_get_data1(n);
  let i = 0;
  let len = (() => { const __recv = names; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  module_scope_define(scopes, depth, get_interned_str((() => { const __recv = names; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })()));
  i = (i + 1);
}
  return 0;
}
  if ((kind == 7)) {
  module_check_expr_implicit_imports(node_get_data1(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  return 0;
}
  if ((kind == 13)) {
  module_check_expr_implicit_imports(node_get_data1(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  module_check_expr_implicit_imports(node_get_data2(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  return 0;
}
  if ((kind == 8)) {
  module_check_expr_implicit_imports(node_get_data1(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  return 0;
}
  if ((kind == 9)) {
  module_check_expr_implicit_imports(node_get_data1(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  module_check_stmt_implicit_imports(node_get_data2(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  if ((node_get_data3(n) != 0)) {
  module_check_stmt_implicit_imports(node_get_data3(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
}
  return 0;
}
  if ((kind == 11)) {
  let next_depth = (depth + 1);
  (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, set_new()) : vec_push(__recv, set_new()); })();
  module_scope_define(scopes, next_depth, get_interned_str(node_get_data1(n)));
  module_check_expr_implicit_imports(node_get_data2(n), declared, imported, all_exported_declared, all_extern_declared, scopes, next_depth);
  module_check_expr_implicit_imports(node_get_data3(n), declared, imported, all_exported_declared, all_extern_declared, scopes, next_depth);
  module_check_stmt_implicit_imports(node_get_data4(n), declared, imported, all_exported_declared, all_extern_declared, scopes, next_depth);
  (() => { const __recv = scopes; const __dyn = __recv?.table?.vec_pop; return __dyn ? __dyn(__recv.ref) : vec_pop(__recv); })();
  return 0;
}
  if ((kind == 10)) {
  module_check_expr_implicit_imports(node_get_data1(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  module_check_stmt_implicit_imports(node_get_data2(n), declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  return 0;
}
  module_check_expr_implicit_imports(n, declared, imported, all_exported_declared, all_extern_declared, scopes, depth);
  return 0;
}

function module_assert_no_implicit_imports(source, declared, imported, all_exported_declared, all_extern_declared) {
  lex_init(source);
  lex_all();
  parse_init();
  let program = p_parse_program();
  let topScopes = vec_new();
  (() => { const __recv = topScopes; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, set_new()) : vec_push(__recv, set_new()); })();
  let body = node_get_data1(program);
  let i = 0;
  let len = (() => { const __recv = body; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  module_check_stmt_implicit_imports((() => { const __recv = body; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })(), declared, imported, all_exported_declared, all_extern_declared, topScopes, 0);
  i = (i + 1);
}
  return 0;
}

function module_has_out_export(source, name) {
  return (((((((((((() => { const __recv = source; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, (() => { const __recv = "out fn "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()) : str_includes(__recv, (() => { const __recv = "out fn "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()); })() || (() => { const __recv = source; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, (() => { const __recv = "out struct "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()) : str_includes(__recv, (() => { const __recv = "out struct "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()); })()) || (() => { const __recv = source; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, (() => { const __recv = "out copy struct "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()) : str_includes(__recv, (() => { const __recv = "out copy struct "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()); })()) || (() => { const __recv = source; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, (() => { const __recv = "copy out struct "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()) : str_includes(__recv, (() => { const __recv = "copy out struct "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()); })()) || (() => { const __recv = source; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, (() => { const __recv = "out enum "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()) : str_includes(__recv, (() => { const __recv = "out enum "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()); })()) || (() => { const __recv = source; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, (() => { const __recv = "out object "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()) : str_includes(__recv, (() => { const __recv = "out object "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()); })()) || (() => { const __recv = source; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, (() => { const __recv = "out contract "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()) : str_includes(__recv, (() => { const __recv = "out contract "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()); })()) || (() => { const __recv = source; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, (() => { const __recv = "out type "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()) : str_includes(__recv, (() => { const __recv = "out type "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()); })()) || (() => { const __recv = source; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, (() => { const __recv = "out copy type "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()) : str_includes(__recv, (() => { const __recv = "out copy type "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()); })()) || (() => { const __recv = source; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, (() => { const __recv = "copy out type "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()) : str_includes(__recv, (() => { const __recv = "copy out type "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()); })()) || (() => { const __recv = source; const __dyn = __recv?.table?.str_includes; return __dyn ? __dyn(__recv.ref, (() => { const __recv = "out class fn "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()) : str_includes(__recv, (() => { const __recv = "out class fn "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })()); })());
}

function gather_module_sources(filePath, moduleBasePath, seen, visiting, sources, module_declared_map, all_declared_names, all_exported_declared_names, all_extern_declared_names, lint_enabled, max_effective_lines, module_cycles) {
  if ((() => { const __recv = seen; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, filePath) : set_has(__recv, filePath); })()) {
  return 0;
}
  if ((() => { const __recv = visiting; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, filePath) : set_has(__recv, filePath); })()) {
  if ((lint_enabled == 1)) {
  (() => { const __recv = module_cycles; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, filePath) : vec_push(__recv, filePath); })();
  return 0;
}
  panic_with_code("E_MODULE_CYCLE", (() => { const __recv = "Module import cycle detected at "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, filePath) : str_concat(__recv, filePath); })(), "A module was revisited while still being loaded, which means the import graph contains a cycle.", "Break the cycle by extracting shared declarations into a third module imported by both sides.");
}
  (() => { const __recv = visiting; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, filePath) : set_add(__recv, filePath); })();
  let source = read_file(filePath);
  lex_init(source);
  lex_all();
  parse_init();
  let program = p_parse_program();
  let stmts = node_get_data1(program);
  let declared = collect_module_declarations(stmts);
  (() => { const __recv = module_declared_map; const __dyn = __recv?.table?.map_set; return __dyn ? __dyn(__recv.ref, filePath, declared) : map_set(__recv, filePath, declared); })();
  let all_declared_items = node_get_data1(program);
  let di = 0;
  let dlen = (() => { const __recv = all_declared_items; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((di < dlen)) {
  let dstmt = (() => { const __recv = all_declared_items; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, di) : vec_get(__recv, di); })();
  let dkind = node_kind(dstmt);
  if (is_module_decl_kind(dkind)) {
  let dname = get_interned_str(node_get_data1(dstmt));
  (() => { const __recv = all_declared_names; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, dname) : set_add(__recv, dname); })();
  if ((((dkind == 17) || (dkind == 18)) || (dkind == 19))) {
  (() => { const __recv = all_extern_declared_names; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, dname) : set_add(__recv, dname); })();
}
  if (module_has_out_export(source, dname)) {
  (() => { const __recv = all_exported_declared_names; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, dname) : set_add(__recv, dname); })();
}
}
  di = (di + 1);
}
  let imports = vec_new();
  let i = 0;
  let len = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let stmt = (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  if ((node_kind(stmt) == 6)) {
  let parts = node_get_data2(stmt);
  let rel = module_parts_to_relative_path(parts);
  let depPath = path_join(moduleBasePath, rel);
  let importNamesRaw = node_get_data1(stmt);
  let importNames = vec_new();
  let j = 0;
  let jLen = (() => { const __recv = importNamesRaw; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((j < jLen)) {
  (() => { const __recv = importNames; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, get_interned_str((() => { const __recv = importNamesRaw; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, j) : vec_get(__recv, j); })())) : vec_push(__recv, get_interned_str((() => { const __recv = importNamesRaw; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, j) : vec_get(__recv, j); })())); })();
  j = (j + 1);
}
  let importSpec = vec_new();
  (() => { const __recv = importSpec; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, depPath) : vec_push(__recv, depPath); })();
  (() => { const __recv = importSpec; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, importNames) : vec_push(__recv, importNames); })();
  (() => { const __recv = imports; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, importSpec) : vec_push(__recv, importSpec); })();
}
  i = (i + 1);
}
  i = 0;
  len = (() => { const __recv = imports; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let spec = (() => { const __recv = imports; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let depPath = (() => { const __recv = spec; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })();
  let importNames = (() => { const __recv = spec; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })();
  gather_module_sources(depPath, moduleBasePath, seen, visiting, sources, module_declared_map, all_declared_names, all_exported_declared_names, all_extern_declared_names, lint_enabled, max_effective_lines, module_cycles);
  let depDeclared = (() => { const __recv = module_declared_map; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, depPath) : map_get(__recv, depPath); })();
  let depSource = read_file(depPath);
  let j = 0;
  let jLen = (() => { const __recv = importNames; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((j < jLen)) {
  let importedName = (() => { const __recv = importNames; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, j) : vec_get(__recv, j); })();
  if ((!module_has_out_export(depSource, importedName))) {
  if ((() => { const __recv = depDeclared; const __dyn = __recv?.table?.set_has; return __dyn ? __dyn(__recv.ref, importedName) : set_has(__recv, importedName); })()) {
  panic_with_code("E_MODULE_PRIVATE_IMPORT", (() => { const __recv = (() => { const __recv = "Cannot import '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, importedName) : str_concat(__recv, importedName); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' from module: symbol is not exported with 'out'") : str_concat(__recv, "' from module: symbol is not exported with 'out'"); })(), "A module import referenced a declaration that exists but is not visible outside its module.", "Mark the declaration with 'out' in the target module, or remove it from the import list.");
}
  panic_with_code("E_MODULE_UNKNOWN_EXPORT", (() => { const __recv = (() => { const __recv = "Cannot import '"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, importedName) : str_concat(__recv, importedName); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "' from module: exported symbol not found") : str_concat(__recv, "' from module: exported symbol not found"); })(), "A module import requested a symbol that is not exported by the target module.", "Check the import list and add a matching 'out' declaration in the target module.");
}
  j = (j + 1);
}
  i = (i + 1);
}
  let imported_names = set_new();
  i = 0;
  len = (() => { const __recv = imports; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let spec = (() => { const __recv = imports; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let importNames = (() => { const __recv = spec; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })();
  let j = 0;
  let jLen = (() => { const __recv = importNames; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((j < jLen)) {
  (() => { const __recv = imported_names; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, (() => { const __recv = importNames; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, j) : vec_get(__recv, j); })()) : set_add(__recv, (() => { const __recv = importNames; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, j) : vec_get(__recv, j); })()); })();
  j = (j + 1);
}
  i = (i + 1);
}
  module_assert_no_implicit_imports(source, declared, imported_names, all_exported_declared_names, all_extern_declared_names);
  (() => { const __recv = visiting; const __dyn = __recv?.table?.set_delete; return __dyn ? __dyn(__recv.ref, filePath) : set_delete(__recv, filePath); })();
  (() => { const __recv = seen; const __dyn = __recv?.table?.set_add; return __dyn ? __dyn(__recv.ref, filePath) : set_add(__recv, filePath); })();
  (() => { const __recv = sources; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, source) : vec_push(__recv, source); })();
  return 0;
}

function compile_file(inputPath, outputPath) {
  return compile_file_with_options(inputPath, outputPath, 1, 0, 500, 1);
}

function compile_file_with_options(inputPath, outputPath, strict_safety, lint_enabled, max_effective_lines, borrow_enabled) {
  let max_lines = module_loader_sanitize_max_effective_lines(max_effective_lines);
  let strict = module_loader_normalize_flag(strict_safety);
  let lint = module_loader_normalize_flag(lint_enabled);
  let borrow = module_loader_normalize_flag(borrow_enabled);
  let moduleBasePath = path_dirname(inputPath);
  let seen = set_new();
  let visiting = set_new();
  let sources = vec_new();
  let module_declared_map = map_new();
  let all_declared_names = set_new();
  let all_exported_declared_names = set_new();
  let all_extern_declared_names = set_new();
  let module_cycles = vec_new();
  lint_reset();
  gather_module_sources(inputPath, moduleBasePath, seen, visiting, sources, module_declared_map, all_declared_names, all_exported_declared_names, all_extern_declared_names, lint, max_lines, module_cycles);
  let merged = join_sources(sources);
  lex_init(merged);
  lex_all();
  parse_init();
  let program = p_parse_program();
  program = strip_import_decls(program);
  let desugared = desugar(program);
  let resolved = resolve_names(desugared);
  let typed = typecheck_program_with_options(resolved, strict);
  if ((borrow == 1)) {
  borrowcheck_program(typed);
}
  if ((lint == 1)) {
  lint_program(typed, inputPath, max_lines);
  let i = 0;
  let len = (() => { const __recv = module_cycles; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  lint_add_circular_import_issue((() => { const __recv = module_cycles; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })());
  i = (i + 1);
}
}
  let js = generate_js(typed);
  return write_file(outputPath, js);
}

function p_has_generic_call_suffix() {
  if ((!p_at(TK_SYMBOL, "<"))) {
  return false;
}
  if ((!p_can_start_type_tok_at(1))) {
  return false;
}
  let cursor = 0;
  let depth = 0;
  while (true) {
  let ti = p_peek(cursor);
  let tk = tok_kind(ti);
  if ((tk == TK_EOF)) {
  return false;
}
  if (((depth > 0) && (tk == TK_SYMBOL))) {
  let stop_sym = get_interned_str(tok_value(ti));
  if ((((((((((((((((((((() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, ")") : str_eq(__recv, ")"); })() || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, ";") : str_eq(__recv, ";"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "{") : str_eq(__recv, "{"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "}") : str_eq(__recv, "}"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "=") : str_eq(__recv, "="); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "==") : str_eq(__recv, "=="); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "!=") : str_eq(__recv, "!="); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "<=") : str_eq(__recv, "<="); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, ">=") : str_eq(__recv, ">="); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "&&") : str_eq(__recv, "&&"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "||") : str_eq(__recv, "||"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "+") : str_eq(__recv, "+"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "-") : str_eq(__recv, "-"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "*") : str_eq(__recv, "*"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "/") : str_eq(__recv, "/"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "%") : str_eq(__recv, "%"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "..") : str_eq(__recv, ".."); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "=>") : str_eq(__recv, "=>"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, ".") : str_eq(__recv, "."); })())) {
  return false;
}
}
  if ((tk == TK_SYMBOL)) {
  let sym = get_interned_str(tok_value(ti));
  if ((() => { const __recv = sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "<") : str_eq(__recv, "<"); })()) {
  depth = (depth + 1);
} else { if ((() => { const __recv = sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, ">") : str_eq(__recv, ">"); })()) {
  depth = (depth - 1);
  if ((depth == 0)) {
  let next = p_peek((cursor + 1));
  if ((tok_kind(next) == TK_SYMBOL)) {
  let next_sym = get_interned_str(tok_value(next));
  return (() => { const __recv = next_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "(") : str_eq(__recv, "("); })();
}
  return false;
}
} }
}
  cursor = (cursor + 1);
}
}

function p_has_generic_struct_init_suffix() {
  if ((!p_at(TK_SYMBOL, "<"))) {
  return false;
}
  if ((!p_can_start_type_tok_at(1))) {
  return false;
}
  let cursor = 0;
  let depth = 0;
  while (true) {
  let ti = p_peek(cursor);
  let tk = tok_kind(ti);
  if ((tk == TK_EOF)) {
  return false;
}
  if (((depth > 0) && (tk == TK_SYMBOL))) {
  let stop_sym = get_interned_str(tok_value(ti));
  if ((((((((((((((((((((() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, ")") : str_eq(__recv, ")"); })() || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, ";") : str_eq(__recv, ";"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "{") : str_eq(__recv, "{"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "}") : str_eq(__recv, "}"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "=") : str_eq(__recv, "="); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "==") : str_eq(__recv, "=="); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "!=") : str_eq(__recv, "!="); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "<=") : str_eq(__recv, "<="); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, ">=") : str_eq(__recv, ">="); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "&&") : str_eq(__recv, "&&"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "||") : str_eq(__recv, "||"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "+") : str_eq(__recv, "+"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "-") : str_eq(__recv, "-"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "*") : str_eq(__recv, "*"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "/") : str_eq(__recv, "/"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "%") : str_eq(__recv, "%"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "..") : str_eq(__recv, ".."); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "=>") : str_eq(__recv, "=>"); })()) || (() => { const __recv = stop_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, ".") : str_eq(__recv, "."); })())) {
  return false;
}
}
  if ((tk == TK_SYMBOL)) {
  let sym = get_interned_str(tok_value(ti));
  if ((() => { const __recv = sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "<") : str_eq(__recv, "<"); })()) {
  depth = (depth + 1);
} else { if ((() => { const __recv = sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, ">") : str_eq(__recv, ">"); })()) {
  depth = (depth - 1);
  if ((depth == 0)) {
  let next = p_peek((cursor + 1));
  if ((tok_kind(next) == TK_SYMBOL)) {
  let next_sym = get_interned_str(tok_value(next));
  return (() => { const __recv = next_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "{") : str_eq(__recv, "{"); })();
}
  return false;
}
} }
}
  cursor = (cursor + 1);
}
}

function p_has_generic_value_suffix() {
  if ((!p_at(TK_SYMBOL, "<"))) {
  return false;
}
  if ((!p_can_start_type_tok_at(1))) {
  return false;
}
  let cursor = 0;
  let depth = 0;
  while (true) {
  let ti = p_peek(cursor);
  let tk = tok_kind(ti);
  if ((tk == TK_EOF)) {
  return false;
}
  if ((tk == TK_SYMBOL)) {
  let sym = get_interned_str(tok_value(ti));
  if ((() => { const __recv = sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "<") : str_eq(__recv, "<"); })()) {
  depth = (depth + 1);
} else { if ((() => { const __recv = sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, ">") : str_eq(__recv, ">"); })()) {
  depth = (depth - 1);
  if ((depth == 0)) {
  let next = p_peek((cursor + 1));
  if ((tok_kind(next) == TK_SYMBOL)) {
  let next_sym = get_interned_str(tok_value(next));
  if ((() => { const __recv = next_sym; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "(") : str_eq(__recv, "("); })()) {
  return false;
}
}
  return true;
}
} }
}
  cursor = (cursor + 1);
}
}

function p_parse_postfix(exprIn) {
  let expr = exprIn;
  while (true) {
  if (((((node_kind(expr) == NK_MEMBER_EXPR) && (() => { const __recv = get_interned_str(node_get_data2(expr)); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "into") : str_eq(__recv, "into"); })()) && p_at(TK_SYMBOL, "<")) && p_has_generic_value_suffix())) {
  p_eat();
  let type_args = vec_new();
  if ((!p_at(TK_SYMBOL, ">"))) {
  (() => { const __recv = type_args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_type()) : vec_push(__recv, p_parse_type()); })();
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  (() => { const __recv = type_args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_type()) : vec_push(__recv, p_parse_type()); })();
}
}
  p_expect(TK_SYMBOL, ">", "Expected '>' after into type args");
  let recv = node_get_data1(expr);
  let prop = node_get_data2(expr);
  let args = vec_new();
  (() => { const __recv = args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, recv) : vec_push(__recv, recv); })();
  let callee = node_new(NK_IDENTIFIER);
  node_set_data1(callee, prop);
  let into_value = node_new(NK_CALL_EXPR);
  node_set_data1(into_value, callee);
  node_set_data2(into_value, args);
  node_set_data3(into_value, 1);
  node_set_data4(into_value, type_args);
  node_set_data5(into_value, 1);
  expr = into_value;
  continue;
}
  if ((p_at(TK_SYMBOL, "<") && p_has_generic_call_suffix())) {
  p_eat();
  let type_args = vec_new();
  if ((!p_at(TK_SYMBOL, ">"))) {
  (() => { const __recv = type_args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_type()) : vec_push(__recv, p_parse_type()); })();
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  (() => { const __recv = type_args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_type()) : vec_push(__recv, p_parse_type()); })();
}
}
  p_expect(TK_SYMBOL, ">", "Expected '>' after generic call type args");
  p_expect(TK_SYMBOL, "(", "Expected '(' after generic call type args");
  let args = vec_new();
  if ((!p_at(TK_SYMBOL, ")"))) {
  (() => { const __recv = args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_expression(0)) : vec_push(__recv, p_parse_expression(0)); })();
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  (() => { const __recv = args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_expression(0)) : vec_push(__recv, p_parse_expression(0)); })();
}
}
  p_expect(TK_SYMBOL, ")", "Expected ')' after call args");
  if ((node_kind(expr) == NK_MEMBER_EXPR)) {
  let recv = node_get_data1(expr);
  let prop = node_get_data2(expr);
  let lowered_args = vec_new();
  (() => { const __recv = lowered_args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, recv) : vec_push(__recv, recv); })();
  let ai = 0;
  let alen = (() => { const __recv = args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((ai < alen)) {
  (() => { const __recv = lowered_args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, (() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, ai) : vec_get(__recv, ai); })()) : vec_push(__recv, (() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, ai) : vec_get(__recv, ai); })()); })();
  ai = (ai + 1);
}
  let callee = node_new(NK_IDENTIFIER);
  node_set_data1(callee, prop);
  let call = node_new(NK_CALL_EXPR);
  node_set_data1(call, callee);
  node_set_data2(call, lowered_args);
  node_set_data3(call, 1);
  node_set_data4(call, type_args);
  expr = call;
} else {
  let call = node_new(NK_CALL_EXPR);
  node_set_data1(call, expr);
  node_set_data2(call, args);
  node_set_data3(call, 0);
  node_set_data4(call, type_args);
  expr = call;
}
  continue;
}
  if (p_at(TK_SYMBOL, "(")) {
  p_eat();
  let args = vec_new();
  if ((!p_at(TK_SYMBOL, ")"))) {
  (() => { const __recv = args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_expression(0)) : vec_push(__recv, p_parse_expression(0)); })();
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  (() => { const __recv = args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_expression(0)) : vec_push(__recv, p_parse_expression(0)); })();
}
}
  p_expect(TK_SYMBOL, ")", "Expected ')'");
  if ((node_kind(expr) == NK_MEMBER_EXPR)) {
  let recv = node_get_data1(expr);
  let prop = node_get_data2(expr);
  let lowered_args = vec_new();
  (() => { const __recv = lowered_args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, recv) : vec_push(__recv, recv); })();
  let ai = 0;
  let alen = (() => { const __recv = args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((ai < alen)) {
  (() => { const __recv = lowered_args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, (() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, ai) : vec_get(__recv, ai); })()) : vec_push(__recv, (() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, ai) : vec_get(__recv, ai); })()); })();
  ai = (ai + 1);
}
  let callee = node_new(NK_IDENTIFIER);
  node_set_data1(callee, prop);
  let call = node_new(NK_CALL_EXPR);
  node_set_data1(call, callee);
  node_set_data2(call, lowered_args);
  node_set_data3(call, 1);
  expr = call;
} else {
  let call = node_new(NK_CALL_EXPR);
  node_set_data1(call, expr);
  node_set_data2(call, args);
  node_set_data3(call, 0);
  expr = call;
}
  continue;
}
  if (p_at(TK_SYMBOL, ".")) {
  p_eat();
  let prop = 0;
  if (p_at_kind(TK_IDENTIFIER)) {
  prop = p_parse_identifier();
} else { if (p_at_kind(TK_KEYWORD)) {
  prop = tok_value(p_eat());
} else {
  panic("Expected member name after '.'");
} }
  let member = node_new(NK_MEMBER_EXPR);
  node_set_data1(member, expr);
  node_set_data2(member, prop);
  expr = member;
  continue;
}
  if (p_at(TK_SYMBOL, "[")) {
  p_eat();
  let idx_expr = p_parse_expression(0);
  p_expect(TK_SYMBOL, "]", "Expected ']'");
  let idx_node = node_new(NK_INDEX_EXPR);
  node_set_data1(idx_node, expr);
  node_set_data2(idx_node, idx_expr);
  expr = idx_node;
  continue;
}
  if (p_at(TK_SYMBOL, "?")) {
  p_eat();
  let unwrap = node_new(NK_UNWRAP_EXPR);
  node_set_data1(unwrap, expr);
  expr = unwrap;
  continue;
}
  break;
}
  return expr;
}

function p_parse_primary() {
  if (p_at_kind(TK_NUMBER)) {
  let t = p_eat();
  let node = node_new(NK_NUMBER_LIT);
  node_set_data1(node, tok_value(t));
  return p_parse_postfix(node);
}
  if (p_at_kind(TK_BOOL)) {
  let t = p_eat();
  let node = node_new(NK_BOOL_LIT);
  node_set_data1(node, tok_value(t));
  return p_parse_postfix(node);
}
  if (p_at_kind(TK_STRING)) {
  let t = p_eat();
  let node = node_new(NK_STRING_LIT);
  node_set_data1(node, tok_value(t));
  return p_parse_postfix(node);
}
  if (p_at_kind(TK_CHAR)) {
  let t = p_eat();
  let node = node_new(NK_CHAR_LIT);
  node_set_data1(node, tok_value(t));
  return p_parse_postfix(node);
}
  if (p_at(TK_SYMBOL, "(")) {
  let mark = p_mark();
  p_eat();
  let params = vec_new();
  let valid = true;
  if ((!p_at(TK_SYMBOL, ")"))) {
  while (true) {
  if ((!p_at_kind(TK_IDENTIFIER))) {
  valid = false;
  break;
}
  let pname = p_parse_identifier();
  let ptype = 0;
  if (p_at(TK_SYMBOL, ":")) {
  p_eat();
  ptype = p_parse_type();
}
  let param = vec_new();
  (() => { const __recv = param; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, pname) : vec_push(__recv, pname); })();
  (() => { const __recv = param; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, ptype) : vec_push(__recv, ptype); })();
  (() => { const __recv = params; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, param) : vec_push(__recv, param); })();
  if (p_at(TK_SYMBOL, ",")) {
  p_eat();
  continue;
}
  break;
}
}
  if ((valid && p_at(TK_SYMBOL, ")"))) {
  p_eat();
  if (p_at(TK_SYMBOL, "=>")) {
  p_eat();
  let body = ((p_at(TK_SYMBOL, "{")) ? (() => {
  return p_parse_block();
})() : (() => {
  return p_parse_expression(0);
})());
  let lam = node_new(NK_LAMBDA_EXPR);
  node_set_data1(lam, params);
  node_set_data2(lam, body);
  return p_parse_postfix(lam);
}
}
  p_restore(mark);
}
  if (p_at(TK_KEYWORD, "fn")) {
  p_eat();
  let fname = 0;
  if (p_at_kind(TK_IDENTIFIER)) {
  fname = p_parse_identifier();
}
  let generics = vec_new();
  if (p_at(TK_SYMBOL, "<")) {
  p_eat();
  if ((!p_at(TK_SYMBOL, ">"))) {
  while (true) {
  (() => { const __recv = generics; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_identifier()) : vec_push(__recv, p_parse_identifier()); })();
  if (p_at(TK_SYMBOL, ":")) {
  p_eat();
  p_parse_type();
}
  if ((!p_at(TK_SYMBOL, ","))) {
  break;
}
  p_eat();
}
}
  p_expect(TK_SYMBOL, ">", "Expected '>'");
}
  p_expect(TK_SYMBOL, "(", "Expected '(' in function expression");
  let params = vec_new();
  if ((!p_at(TK_SYMBOL, ")"))) {
  while (true) {
  let pname = p_parse_identifier();
  let ptype = 0;
  if (p_at(TK_SYMBOL, ":")) {
  p_eat();
  ptype = p_parse_type();
}
  let param = vec_new();
  (() => { const __recv = param; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, pname) : vec_push(__recv, pname); })();
  (() => { const __recv = param; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, ptype) : vec_push(__recv, ptype); })();
  (() => { const __recv = params; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, param) : vec_push(__recv, param); })();
  if ((!p_at(TK_SYMBOL, ","))) {
  break;
}
  p_eat();
}
}
  p_expect(TK_SYMBOL, ")", "Expected ')' after params");
  let ret = 0;
  if (p_at(TK_SYMBOL, ":")) {
  p_eat();
  ret = p_parse_type();
}
  p_expect(TK_SYMBOL, "=>", "Expected '=>' in function expression");
  let body = ((p_at(TK_SYMBOL, "{")) ? (() => {
  return p_parse_block();
})() : (() => {
  return p_parse_expression(0);
})());
  let fnexpr = node_new(NK_FN_EXPR);
  node_set_data1(fnexpr, fname);
  node_set_data2(fnexpr, generics);
  node_set_data3(fnexpr, params);
  node_set_data4(fnexpr, ret);
  node_set_data5(fnexpr, body);
  return p_parse_postfix(fnexpr);
}
  if (p_at(TK_SYMBOL, "(")) {
  p_eat();
  let expr = p_parse_expression(0);
  p_expect(TK_SYMBOL, ")", "Expected ')'");
  return p_parse_postfix(expr);
}
  if (p_at(TK_KEYWORD, "if")) {
  p_eat();
  p_expect(TK_SYMBOL, "(", "Expected '(' after if");
  let cond = p_parse_expression(0);
  p_expect(TK_SYMBOL, ")", "Expected ')' after condition");
  let then_branch = ((p_at(TK_SYMBOL, "{")) ? (() => {
  return p_parse_block();
})() : (() => {
  return p_parse_expression(0);
})());
  let else_branch = 0;
  if (p_at(TK_KEYWORD, "else")) {
  p_eat();
  else_branch = ((p_at(TK_SYMBOL, "{")) ? (() => {
  return p_parse_block();
})() : (() => {
  return p_parse_expression(0);
})());
}
  let node = node_new(NK_IF_EXPR);
  node_set_data1(node, cond);
  node_set_data2(node, then_branch);
  node_set_data3(node, else_branch);
  return p_parse_postfix(node);
}
  if (p_at(TK_KEYWORD, "match")) {
  p_eat();
  p_expect(TK_SYMBOL, "(", "Expected '(' after match");
  let target = p_parse_expression(0);
  p_expect(TK_SYMBOL, ")", "Expected ')' after match target");
  p_expect(TK_SYMBOL, "{", "Expected '{'");
  let cases = vec_new();
  while ((!p_at(TK_SYMBOL, "}"))) {
  p_expect(TK_KEYWORD, "case", "Expected 'case'");
  let pat = p_parse_pattern();
  p_expect(TK_SYMBOL, "=", "Expected '='");
  let body = ((p_at(TK_SYMBOL, "{")) ? (() => {
  return p_parse_block();
})() : (() => {
  return p_parse_expression(0);
})());
  p_expect(TK_SYMBOL, ";", "Expected ';' after case");
  let case_node = vec_new();
  (() => { const __recv = case_node; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, pat) : vec_push(__recv, pat); })();
  (() => { const __recv = case_node; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, body) : vec_push(__recv, body); })();
  (() => { const __recv = cases; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, case_node) : vec_push(__recv, case_node); })();
}
  p_expect(TK_SYMBOL, "}", "Expected '}'");
  let node = node_new(NK_MATCH_EXPR);
  node_set_data1(node, target);
  node_set_data2(node, cases);
  return node;
}
  if (p_at_kind(TK_IDENTIFIER)) {
  let name = p_parse_identifier();
  let expr = node_new(NK_IDENTIFIER);
  node_set_data1(expr, name);
  let generic_args = vec_new();
  let is_type_like = false;
  let name_text = get_interned_str(name);
  if (((() => { const __recv = name_text; const __dyn = __recv?.table?.str_length; return __dyn ? __dyn(__recv.ref) : str_length(__recv); })() > 0)) {
  let c0 = (() => { const __recv = name_text; const __dyn = __recv?.table?.str_char_at; return __dyn ? __dyn(__recv.ref, 0) : str_char_at(__recv, 0); })();
  if (((c0 >= 65) && (c0 <= 90))) {
  is_type_like = true;
}
}
  if (((is_type_like && p_at(TK_SYMBOL, "<")) && (p_has_generic_struct_init_suffix() || p_has_generic_value_suffix()))) {
  p_eat();
  if ((!p_at(TK_SYMBOL, ">"))) {
  (() => { const __recv = generic_args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_type()) : vec_push(__recv, p_parse_type()); })();
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  (() => { const __recv = generic_args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_type()) : vec_push(__recv, p_parse_type()); })();
}
}
  p_expect(TK_SYMBOL, ">", "Expected '>' in generic struct initializer");
  node_set_data2(expr, generic_args);
}
  if (p_at(TK_SYMBOL, "{")) {
  p_eat();
  let fields = vec_new();
  if ((!p_at(TK_SYMBOL, "}"))) {
  let key = p_parse_identifier();
  p_expect(TK_SYMBOL, ":", "Expected ':' in struct init");
  let val = p_parse_expression(0);
  let field = vec_new();
  (() => { const __recv = field; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, key) : vec_push(__recv, key); })();
  (() => { const __recv = field; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, val) : vec_push(__recv, val); })();
  (() => { const __recv = fields; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, field) : vec_push(__recv, field); })();
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  let key2 = p_parse_identifier();
  p_expect(TK_SYMBOL, ":", "Expected ':'");
  let val2 = p_parse_expression(0);
  let field2 = vec_new();
  (() => { const __recv = field2; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, key2) : vec_push(__recv, key2); })();
  (() => { const __recv = field2; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, val2) : vec_push(__recv, val2); })();
  (() => { const __recv = fields; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, field2) : vec_push(__recv, field2); })();
}
}
  p_expect(TK_SYMBOL, "}", "Expected '}'");
  let init_node = node_new(NK_STRUCT_INIT);
  node_set_data1(init_node, name);
  node_set_data2(init_node, fields);
  node_set_data3(init_node, generic_args);
  expr = init_node;
}
  return p_parse_postfix(expr);
}
  panic("Unexpected token in expression");
  return 0;
}

function p_parse_unary() {
  if (((p_at(TK_SYMBOL, "!") || p_at(TK_SYMBOL, "-")) || p_at(TK_SYMBOL, "&"))) {
  let t = p_eat();
  let op = tok_value(t);
  if (((() => { const __recv = get_interned_str(op); const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "&") : str_eq(__recv, "&"); })() && p_at(TK_KEYWORD, "mut"))) {
  p_eat();
  op = intern("&mut");
}
  let inner = p_parse_unary();
  let node = node_new(NK_UNARY_EXPR);
  node_set_data1(node, op);
  node_set_data2(node, inner);
  return node;
}
  return p_parse_primary();
}

function p_get_precedence(op) {
  if (((() => { const __recv = intern_map; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, "||") : map_has(__recv, "||"); })() && (op == (() => { const __recv = intern_map; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, "||") : map_get(__recv, "||"); })()))) {
  return 1;
}
  if (((() => { const __recv = intern_map; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, "&&") : map_has(__recv, "&&"); })() && (op == (() => { const __recv = intern_map; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, "&&") : map_get(__recv, "&&"); })()))) {
  return 2;
}
  if (((() => { const __recv = intern_map; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, "==") : map_has(__recv, "=="); })() && (op == (() => { const __recv = intern_map; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, "==") : map_get(__recv, "=="); })()))) {
  return 3;
}
  if (((() => { const __recv = intern_map; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, "!=") : map_has(__recv, "!="); })() && (op == (() => { const __recv = intern_map; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, "!=") : map_get(__recv, "!="); })()))) {
  return 3;
}
  if (((() => { const __recv = intern_map; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, "<") : map_has(__recv, "<"); })() && (op == (() => { const __recv = intern_map; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, "<") : map_get(__recv, "<"); })()))) {
  return 4;
}
  if (((() => { const __recv = intern_map; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, "<=") : map_has(__recv, "<="); })() && (op == (() => { const __recv = intern_map; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, "<=") : map_get(__recv, "<="); })()))) {
  return 4;
}
  if (((() => { const __recv = intern_map; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, ">") : map_has(__recv, ">"); })() && (op == (() => { const __recv = intern_map; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, ">") : map_get(__recv, ">"); })()))) {
  return 4;
}
  if (((() => { const __recv = intern_map; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, ">=") : map_has(__recv, ">="); })() && (op == (() => { const __recv = intern_map; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, ">=") : map_get(__recv, ">="); })()))) {
  return 4;
}
  if (((() => { const __recv = intern_map; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, "+") : map_has(__recv, "+"); })() && (op == (() => { const __recv = intern_map; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, "+") : map_get(__recv, "+"); })()))) {
  return 5;
}
  if (((() => { const __recv = intern_map; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, "-") : map_has(__recv, "-"); })() && (op == (() => { const __recv = intern_map; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, "-") : map_get(__recv, "-"); })()))) {
  return 5;
}
  if (((() => { const __recv = intern_map; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, "*") : map_has(__recv, "*"); })() && (op == (() => { const __recv = intern_map; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, "*") : map_get(__recv, "*"); })()))) {
  return 6;
}
  if (((() => { const __recv = intern_map; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, "/") : map_has(__recv, "/"); })() && (op == (() => { const __recv = intern_map; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, "/") : map_get(__recv, "/"); })()))) {
  return 6;
}
  if (((() => { const __recv = intern_map; const __dyn = __recv?.table?.map_has; return __dyn ? __dyn(__recv.ref, "%") : map_has(__recv, "%"); })() && (op == (() => { const __recv = intern_map; const __dyn = __recv?.table?.map_get; return __dyn ? __dyn(__recv.ref, "%") : map_get(__recv, "%"); })()))) {
  return 6;
}
  return 0;
}

function p_is_binary_op() {
  if (p_at(TK_SYMBOL, "+")) {
  return true;
}
  if (p_at(TK_SYMBOL, "-")) {
  return true;
}
  if (p_at(TK_SYMBOL, "*")) {
  return true;
}
  if (p_at(TK_SYMBOL, "/")) {
  return true;
}
  if (p_at(TK_SYMBOL, "%")) {
  return true;
}
  if (p_at(TK_SYMBOL, "==")) {
  return true;
}
  if (p_at(TK_SYMBOL, "!=")) {
  return true;
}
  if (p_at(TK_SYMBOL, "<")) {
  return true;
}
  if (p_at(TK_SYMBOL, "<=")) {
  return true;
}
  if (p_at(TK_SYMBOL, ">")) {
  return true;
}
  if (p_at(TK_SYMBOL, ">=")) {
  return true;
}
  if (p_at(TK_SYMBOL, "&&")) {
  return true;
}
  if (p_at(TK_SYMBOL, "||")) {
  return true;
}
  if (p_at(TK_KEYWORD, "is")) {
  return true;
}
  if (p_at(TK_KEYWORD, "into")) {
  return true;
}
  return false;
}

function p_parse_expression(minPrec) {
  let left = p_parse_unary();
  while (p_is_binary_op()) {
  if (((minPrec <= 0) && p_at(TK_KEYWORD, "into"))) {
  p_eat();
  let contract_name = p_parse_identifier();
  let type_args = vec_new();
  let contract_type = node_new(NK_NAMED_TYPE);
  node_set_data1(contract_type, contract_name);
  node_set_data2(contract_type, vec_new());
  (() => { const __recv = type_args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, contract_type) : vec_push(__recv, contract_type); })();
  let args = vec_new();
  (() => { const __recv = args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, left) : vec_push(__recv, left); })();
  if (p_at(TK_SYMBOL, "(")) {
  p_eat();
  if ((!p_at(TK_SYMBOL, ")"))) {
  (() => { const __recv = args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_expression(0)) : vec_push(__recv, p_parse_expression(0)); })();
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  (() => { const __recv = args; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_expression(0)) : vec_push(__recv, p_parse_expression(0)); })();
}
}
  p_expect(TK_SYMBOL, ")", "Expected ')' after into arguments");
}
  let call = node_new(NK_CALL_EXPR);
  let callee = node_new(NK_IDENTIFIER);
  node_set_data1(callee, intern("into"));
  node_set_data1(call, callee);
  node_set_data2(call, args);
  node_set_data3(call, 1);
  node_set_data4(call, type_args);
  left = call;
  continue;
}
  let op = tok_value(p_peek(0));
  let prec = p_get_precedence(op);
  if (p_at(TK_KEYWORD, "is")) {
  p_eat();
  let pat = p_parse_pattern();
  let is_node = node_new(NK_IS_EXPR);
  node_set_data1(is_node, left);
  node_set_data2(is_node, pat);
  left = is_node;
  continue;
}
  if ((prec < minPrec)) {
  break;
}
  p_eat();
  let right = p_parse_expression((prec + 1));
  let bin = node_new(NK_BINARY_EXPR);
  node_set_data1(bin, op);
  node_set_data2(bin, left);
  node_set_data3(bin, right);
  left = bin;
}
  return left;
}

function p_parse_block() {
  p_expect(TK_SYMBOL, "{", "Expected '{'");
  let stmts = vec_new();
  while (((!p_at(TK_SYMBOL, "}")) && (!p_at_kind(TK_EOF)))) {
  (() => { const __recv = stmts; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, p_parse_statement()) : vec_push(__recv, p_parse_statement()); })();
}
  p_expect(TK_SYMBOL, "}", "Expected '}'");
  let node = node_new(NK_BLOCK);
  node_set_data1(node, stmts);
  return node;
}

function selfhost_parser_expr_marker() { return 0; }

function emit_expr(n) {
  let kind = node_kind(n);
  if ((kind == NK_NUMBER_LIT)) {
  let val = node_get_data1(n);
  return get_interned_str(val);
}
  if ((kind == NK_BOOL_LIT)) {
  let val = node_get_data1(n);
  if ((val == 1)) {
  return "true";
}
  return "false";
}
  if ((kind == NK_STRING_LIT)) {
  let val = node_get_data1(n);
  let s = get_interned_str(val);
  return (() => { const __recv = (() => { const __recv = "\""; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, s) : str_concat(__recv, s); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "\"") : str_concat(__recv, "\""); })();
}
  if ((kind == NK_CHAR_LIT)) {
  let val = node_get_data1(n);
  let s = get_interned_str(val);
  return (() => { const __recv = (() => { const __recv = "\""; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, s) : str_concat(__recv, s); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "\"") : str_concat(__recv, "\""); })();
}
  if ((kind == NK_IDENTIFIER)) {
  let name_idx = node_get_data1(n);
  return get_interned_str(name_idx);
}
  if ((kind == NK_UNARY_EXPR)) {
  let op = get_interned_str(node_get_data1(n));
  if (((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "&") : str_eq(__recv, "&"); })() || (() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "&mut") : str_eq(__recv, "&mut"); })())) {
  return emit_expr(node_get_data2(n));
}
  let inner = emit_expr(node_get_data2(n));
  return (() => { const __recv = (() => { const __recv = "("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, op) : str_concat(__recv, op); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = inner; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ")") : str_concat(__recv, ")"); })()) : str_concat(__recv, (() => { const __recv = inner; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ")") : str_concat(__recv, ")"); })()); })();
}
  if ((kind == NK_BINARY_EXPR)) {
  let op = get_interned_str(node_get_data1(n));
  if ((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "==") : str_eq(__recv, "=="); })()) {
  op = "===";
}
  if ((() => { const __recv = op; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "!=") : str_eq(__recv, "!="); })()) {
  op = "!==";
}
  let left = emit_expr(node_get_data2(n));
  let right = emit_expr(node_get_data3(n));
  return str_concat((() => { const __recv = (() => { const __recv = (() => { const __recv = "("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, left) : str_concat(__recv, left); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = " "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, op) : str_concat(__recv, op); })()) : str_concat(__recv, (() => { const __recv = " "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, op) : str_concat(__recv, op); })()); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = " "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, right) : str_concat(__recv, right); })()) : str_concat(__recv, (() => { const __recv = " "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, right) : str_concat(__recv, right); })()); })(), ")");
}
  if ((kind == NK_CALL_EXPR)) {
  let callee_node = node_get_data1(n);
  if ((node_kind(callee_node) == NK_IDENTIFIER)) {
  let callee_name = get_interned_str(node_get_data1(callee_node));
  if ((() => { const __recv = callee_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "drop") : str_eq(__recv, "drop"); })()) {
  return "undefined";
}
  if (((() => { const __recv = callee_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "into") : str_eq(__recv, "into"); })() && (node_get_data3(n) == 1))) {
  let args = node_get_data2(n);
  if (((() => { const __recv = args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() < 1)) {
  return "undefined";
}
  let type_args = node_get_data4(n);
  let contract_name = "";
  if ((((() => { const __recv = type_args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })() == 1) && (node_kind((() => { const __recv = type_args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })()) == NK_NAMED_TYPE))) {
  contract_name = get_interned_str(node_get_data1((() => { const __recv = type_args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })()));
}
  let src_node = (() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })();
  let src = emit_expr(src_node);
  let consume_source = "";
  if ((node_kind(src_node) == NK_IDENTIFIER)) {
  consume_source = (() => { const __recv = get_interned_str(node_get_data1(src_node)); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " = undefined;") : str_concat(__recv, " = undefined;"); })();
}
  if ((node_get_data5(n) == 1)) {
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "(() => { const __src = "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, src) : str_concat(__recv, src); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "; const __conv = __src?.__into?.[") : str_concat(__recv, "; const __conv = __src?.__into?.["); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "\"") : str_concat(__recv, "\""); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, contract_name) : str_concat(__recv, contract_name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "\"") : str_concat(__recv, "\""); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "]; if (!__conv) { throw new Error(\"Missing into converter for ") : str_concat(__recv, "]; if (!__conv) { throw new Error(\"Missing into converter for "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (((() => { const __recv = contract_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "") : str_eq(__recv, ""); })()) ? (() => {
  return "<unknown>";
})() : (() => {
  return contract_name;
})())) : str_concat(__recv, (((() => { const __recv = contract_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "") : str_eq(__recv, ""); })()) ? (() => {
  return "<unknown>";
})() : (() => {
  return contract_name;
})())); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "\"); } ") : str_concat(__recv, "\"); } "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, consume_source) : str_concat(__recv, consume_source); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " let __used = false; return (...__intoArgs) => { if (__used) { throw new Error(\"Into converter already consumed for ") : str_concat(__recv, " let __used = false; return (...__intoArgs) => { if (__used) { throw new Error(\"Into converter already consumed for "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (((() => { const __recv = contract_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "") : str_eq(__recv, ""); })()) ? (() => {
  return "<unknown>";
})() : (() => {
  return contract_name;
})())) : str_concat(__recv, (((() => { const __recv = contract_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "") : str_eq(__recv, ""); })()) ? (() => {
  return "<unknown>";
})() : (() => {
  return contract_name;
})())); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "\"); } __used = true; return __conv(...__intoArgs); }; })()") : str_concat(__recv, "\"); } __used = true; return __conv(...__intoArgs); }; })()"); })();
}
  let arg_strs = vec_new();
  let i = 1;
  let len = (() => { const __recv = args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  (() => { const __recv = arg_strs; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, emit_expr((() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })())) : vec_push(__recv, emit_expr((() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })())); })();
  i = (i + 1);
}
  let rest_args = (() => { const __recv = arg_strs; const __dyn = __recv?.table?.vec_join; return __dyn ? __dyn(__recv.ref, ", ") : vec_join(__recv, ", "); })();
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "(() => { const __src = "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, src) : str_concat(__recv, src); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "; const __conv = __src?.__into?.[") : str_concat(__recv, "; const __conv = __src?.__into?.["); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "\"") : str_concat(__recv, "\""); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, contract_name) : str_concat(__recv, contract_name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "\"") : str_concat(__recv, "\""); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "]; if (!__conv) { throw new Error(\"Missing into converter for ") : str_concat(__recv, "]; if (!__conv) { throw new Error(\"Missing into converter for "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (((() => { const __recv = contract_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "") : str_eq(__recv, ""); })()) ? (() => {
  return "<unknown>";
})() : (() => {
  return contract_name;
})())) : str_concat(__recv, (((() => { const __recv = contract_name; const __dyn = __recv?.table?.str_eq; return __dyn ? __dyn(__recv.ref, "") : str_eq(__recv, ""); })()) ? (() => {
  return "<unknown>";
})() : (() => {
  return contract_name;
})())); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "\"); } const __out = __conv(") : str_concat(__recv, "\"); } const __out = __conv("); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, rest_args) : str_concat(__recv, rest_args); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "); ") : str_concat(__recv, "); "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, consume_source) : str_concat(__recv, consume_source); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " return __out; })()") : str_concat(__recv, " return __out; })()"); })();
}
}
  let callee = emit_expr(node_get_data1(n));
  let args = node_get_data2(n);
  let arg_strs = vec_new();
  let i = 0;
  let len = (() => { const __recv = args; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  (() => { const __recv = arg_strs; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, emit_expr((() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })())) : vec_push(__recv, emit_expr((() => { const __recv = args; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })())); })();
  i = (i + 1);
}
  let args_str = (() => { const __recv = arg_strs; const __dyn = __recv?.table?.vec_join; return __dyn ? __dyn(__recv.ref, ", ") : vec_join(__recv, ", "); })();
  return (() => { const __recv = (() => { const __recv = callee; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "(") : str_concat(__recv, "("); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = args_str; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ")") : str_concat(__recv, ")"); })()) : str_concat(__recv, (() => { const __recv = args_str; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ")") : str_concat(__recv, ")"); })()); })();
}
  if ((kind == NK_MEMBER_EXPR)) {
  let obj = emit_expr(node_get_data1(n));
  let prop = get_interned_str(node_get_data2(n));
  return (() => { const __recv = (() => { const __recv = obj; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ".") : str_concat(__recv, "."); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, prop) : str_concat(__recv, prop); })();
}
  if ((kind == NK_INDEX_EXPR)) {
  let target = emit_expr(node_get_data1(n));
  let idx_expr = emit_expr(node_get_data2(n));
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = target; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "[") : str_concat(__recv, "["); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, idx_expr) : str_concat(__recv, idx_expr); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "]") : str_concat(__recv, "]"); })();
}
  if ((kind == NK_STRUCT_INIT)) {
  let name_idx = node_get_data1(n);
  let name = get_interned_str(name_idx);
  let fields = node_get_data2(n);
  let sb = sb_new();
  sb_append(sb, "((typeof ");
  sb_append(sb, name);
  sb_append(sb, " === \"function\") ? ");
  sb_append(sb, name);
  sb_append(sb, "({");
  let i = 0;
  let len = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let field = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let key_idx = (() => { const __recv = field; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })();
  let val_node = (() => { const __recv = field; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })();
  if ((i > 0)) {
  sb_append(sb, ", ");
}
  sb_append(sb, get_interned_str(key_idx));
  sb_append(sb, ": ");
  sb_append(sb, emit_expr(val_node));
  i = (i + 1);
}
  sb_append(sb, "}) : ({ __tag: ");
  sb_append(sb, (() => { const __recv = (() => { const __recv = "\""; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "\"") : str_concat(__recv, "\""); })());
  i = 0;
  while ((i < len)) {
  let field = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let key_idx = (() => { const __recv = field; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })();
  let val_node = (() => { const __recv = field; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })();
  sb_append(sb, ", ");
  sb_append(sb, get_interned_str(key_idx));
  sb_append(sb, ": ");
  sb_append(sb, emit_expr(val_node));
  i = (i + 1);
}
  sb_append(sb, " }))");
  return sb_build(sb);
}
  if ((kind == NK_IF_EXPR)) {
  let cond = emit_expr(node_get_data1(n));
  let then_b = node_get_data2(n);
  let else_b = node_get_data3(n);
  let then_str = (((node_kind(then_b) == NK_BLOCK)) ? (() => {
  return emit_block_as_iife(then_b);
})() : (() => {
  return emit_expr(then_b);
})());
  let else_str = (((else_b == 0)) ? (() => {
  return "undefined";
})() : (() => {
  return (((node_kind(else_b) == NK_BLOCK)) ? (() => {
  return emit_block_as_iife(else_b);
})() : (() => {
  return emit_expr(else_b);
})());
})());
  return str_concat((() => { const __recv = (() => { const __recv = (() => { const __recv = "(("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, cond) : str_concat(__recv, cond); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ") ? ") : str_concat(__recv, ") ? "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = then_str; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " : ") : str_concat(__recv, " : "); })()) : str_concat(__recv, (() => { const __recv = then_str; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " : ") : str_concat(__recv, " : "); })()); })(), (() => { const __recv = else_str; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ")") : str_concat(__recv, ")"); })());
}
  if ((kind == NK_MATCH_EXPR)) {
  let target = emit_expr(node_get_data1(n));
  let cases = node_get_data2(n);
  let sb = sb_new();
  sb_append(sb, "(() => { const __m = ");
  sb_append(sb, target);
  sb_append(sb, "; ");
  let i = 0;
  let len = (() => { const __recv = cases; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let case_node = (() => { const __recv = cases; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let pat = (() => { const __recv = case_node; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })();
  let body = (() => { const __recv = case_node; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 1) : vec_get(__recv, 1); })();
  let guard = emit_pattern_guard("__m", pat);
  if ((i == 0)) {
  sb_append(sb, "if (");
} else {
  sb_append(sb, "else if (");
}
  sb_append(sb, guard);
  sb_append(sb, ") { ");
  sb_append(sb, emit_pattern_bindings("__m", pat));
  sb_append(sb, "return ");
  sb_append(sb, (((node_kind(body) == NK_BLOCK)) ? (() => {
  return emit_block(body);
})() : (() => {
  return emit_expr(body);
})()));
  sb_append(sb, "; } ");
  i = (i + 1);
}
  sb_append(sb, "else { throw new Error(\"Non-exhaustive match\"); } })()");
  return sb_build(sb);
}
  if ((kind == NK_IS_EXPR)) {
  let inner = emit_expr(node_get_data1(n));
  let pat = node_get_data2(n);
  return (() => { const __recv = (() => { const __recv = "("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, emit_pattern_guard(inner, pat)) : str_concat(__recv, emit_pattern_guard(inner, pat)); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ")") : str_concat(__recv, ")"); })();
}
  if ((kind == NK_UNWRAP_EXPR)) {
  return emit_expr(node_get_data1(n));
}
  if ((kind == NK_LAMBDA_EXPR)) {
  let params = node_get_data1(n);
  let body = node_get_data2(n);
  let pnames = vec_new();
  let i = 0;
  let len = (() => { const __recv = params; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let param = (() => { const __recv = params; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  (() => { const __recv = pnames; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, get_interned_str((() => { const __recv = param; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })())) : vec_push(__recv, get_interned_str((() => { const __recv = param; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })())); })();
  i = (i + 1);
}
  let args = (() => { const __recv = pnames; const __dyn = __recv?.table?.vec_join; return __dyn ? __dyn(__recv.ref, ", ") : vec_join(__recv, ", "); })();
  if ((node_kind(body) == NK_BLOCK)) {
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "(("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, args) : str_concat(__recv, args); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ") => ") : str_concat(__recv, ") => "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, emit_fn_block(body)) : str_concat(__recv, emit_fn_block(body)); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ")") : str_concat(__recv, ")"); })();
}
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "(("; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, args) : str_concat(__recv, args); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ") => ") : str_concat(__recv, ") => "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, emit_expr(body)) : str_concat(__recv, emit_expr(body)); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ")") : str_concat(__recv, ")"); })();
}
  if ((kind == NK_FN_EXPR)) {
  let fname_idx = node_get_data1(n);
  let params = node_get_data3(n);
  let body = node_get_data5(n);
  let pnames = vec_new();
  let i = 0;
  let len = (() => { const __recv = params; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let param = (() => { const __recv = params; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  (() => { const __recv = pnames; const __dyn = __recv?.table?.vec_push; return __dyn ? __dyn(__recv.ref, get_interned_str((() => { const __recv = param; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })())) : vec_push(__recv, get_interned_str((() => { const __recv = param; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, 0) : vec_get(__recv, 0); })())); })();
  i = (i + 1);
}
  let args = (() => { const __recv = pnames; const __dyn = __recv?.table?.vec_join; return __dyn ? __dyn(__recv.ref, ", ") : vec_join(__recv, ", "); })();
  let namePart = "";
  if ((fname_idx != 0)) {
  namePart = (() => { const __recv = " "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, get_interned_str(fname_idx)) : str_concat(__recv, get_interned_str(fname_idx)); })();
}
  if ((node_kind(body) == NK_BLOCK)) {
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "(function"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, namePart) : str_concat(__recv, namePart); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "(") : str_concat(__recv, "("); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, args) : str_concat(__recv, args); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ") ") : str_concat(__recv, ") "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, emit_fn_block(body)) : str_concat(__recv, emit_fn_block(body)); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ")") : str_concat(__recv, ")"); })();
}
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = (() => { const __recv = "(function"; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, namePart) : str_concat(__recv, namePart); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "(") : str_concat(__recv, "("); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, args) : str_concat(__recv, args); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ") { return ") : str_concat(__recv, ") { return "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, emit_expr(body)) : str_concat(__recv, emit_expr(body)); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "; })") : str_concat(__recv, "; })"); })();
}
  return "undefined";
}

function emit_pattern_guard(value_expr, pat) {
  let kind = node_kind(pat);
  if ((kind == NK_WILDCARD_PAT)) {
  return "true";
}
  if ((kind == NK_LITERAL_PAT)) {
  let val = get_interned_str(node_get_data1(pat));
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = value_expr; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " === ") : str_concat(__recv, " === "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, val) : str_concat(__recv, val); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "") : str_concat(__recv, ""); })();
}
  if ((kind == NK_NAME_PAT)) {
  let name = get_interned_str(node_get_data1(pat));
  return str_concat((() => { const __recv = (() => { const __recv = (() => { const __recv = value_expr; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " && ") : str_concat(__recv, " && "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, value_expr) : str_concat(__recv, value_expr); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ".__tag === \"") : str_concat(__recv, ".__tag === \""); })(), (() => { const __recv = name; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "\"") : str_concat(__recv, "\""); })());
}
  if ((kind == NK_STRUCT_PAT)) {
  let name = get_interned_str(node_get_data1(pat));
  return str_concat((() => { const __recv = (() => { const __recv = (() => { const __recv = value_expr; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " && ") : str_concat(__recv, " && "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, value_expr) : str_concat(__recv, value_expr); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, ".__tag === \"") : str_concat(__recv, ".__tag === \""); })(), (() => { const __recv = name; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "\"") : str_concat(__recv, "\""); })());
}
  return "false";
}

function emit_pattern_bindings(value_expr, pat) {
  let kind = node_kind(pat);
  if ((kind == NK_STRUCT_PAT)) {
  let fields = node_get_data2(pat);
  let sb = sb_new();
  let i = 0;
  let len = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_length; return __dyn ? __dyn(__recv.ref) : vec_length(__recv); })();
  while ((i < len)) {
  let fname_idx = (() => { const __recv = fields; const __dyn = __recv?.table?.vec_get; return __dyn ? __dyn(__recv.ref, i) : vec_get(__recv, i); })();
  let fname = get_interned_str(fname_idx);
  sb_append(sb, "const ");
  sb_append(sb, fname);
  sb_append(sb, " = ");
  sb_append(sb, value_expr);
  sb_append(sb, ".");
  sb_append(sb, fname);
  sb_append(sb, "; ");
  i = (i + 1);
}
  return sb_build(sb);
}
  if ((kind == NK_NAME_PAT)) {
  let name = get_interned_str(node_get_data1(pat));
  return (() => { const __recv = (() => { const __recv = (() => { const __recv = "const "; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, name) : str_concat(__recv, name); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, " = ") : str_concat(__recv, " = "); })(); const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, (() => { const __recv = value_expr; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "; ") : str_concat(__recv, "; "); })()) : str_concat(__recv, (() => { const __recv = value_expr; const __dyn = __recv?.table?.str_concat; return __dyn ? __dyn(__recv.ref, "; ") : str_concat(__recv, "; "); })()); })();
}
  return "";
}

function selfhost_codegen_expr_marker() { return 0; }

function sanitize_max_effective_lines(max_effective_lines) {
  return (((max_effective_lines <= 0)) ? (() => {
  return 500;
})() : (() => {
  return max_effective_lines;
})());
}

function normalize_flag(value) {
  return (((value == 0)) ? (() => {
  return 0;
})() : (() => {
  return 1;
})());
}

function compile_source_with_options(source, strict_safety, lint_enabled, max_effective_lines, borrow_enabled) {
  let max_lines = sanitize_max_effective_lines(max_effective_lines);
  let strict = normalize_flag(strict_safety);
  let lint = normalize_flag(lint_enabled);
  let borrow = normalize_flag(borrow_enabled);
  lint_reset();
  lex_init(source);
  lex_all();
  parse_init();
  let program = p_parse_program();
  let desugared = desugar(program);
  let resolved = resolve_names(desugared);
  let typed = typecheck_program_with_options(resolved, strict);
  if ((borrow == 1)) {
  borrowcheck_program(typed);
}
  if ((lint == 1)) {
  lint_program(typed, "<memory>", max_lines);
}
  return generate_js(typed);
}

function take_lint_issues() { return lint_take_issues(); }

function compile_source(source) { return compile_source_with_options(source, 1, 0, 500, 1); }

function main() {
  print("Self-hosted Tuff compiler loaded");
  return 0;
}
