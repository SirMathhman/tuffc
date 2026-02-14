"use strict";

// extern fn str_length

// extern fn str_char_at

// extern fn str_slice

// extern fn str_concat

// extern fn str_eq

// extern fn str_from_char_code

// extern fn str_index_of

// extern fn str_includes

// extern fn str_starts_with

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

// extern fn vec_new

// extern fn vec_push

// extern fn vec_pop

// extern fn vec_get

// extern fn vec_set

// extern fn vec_length

// extern fn vec_clear

// extern fn vec_join

// extern fn vec_includes

// extern type Map

// extern fn map_new

// extern fn map_set

// extern fn map_get

// extern fn map_has

// extern type Set

// extern fn set_new

// extern fn set_add

// extern fn set_has

// extern fn set_delete

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
  vec_push(tok_kinds, kind);
  vec_push(tok_values, value);
  vec_push(tok_lines, line);
  vec_push(tok_cols, col);
  tok_count = (tok_count + 1);
  return idx;
}

function tok_kind(idx) { return vec_get(tok_kinds, idx); }

function tok_value(idx) { return vec_get(tok_values, idx); }

let intern_table = vec_new();

let intern_map = map_new();

function intern(s) {
  return ((map_has(intern_map, s)) ? (() => {
  return map_get(intern_map, s);
})() : (() => {
  let idx = vec_length(intern_table);
  vec_push(intern_table, s);
  map_set(intern_map, s, idx);
  return idx;
})());
}

function get_intern(idx) {
  return vec_get(intern_table, idx);
}

function get_interned_str(idx) { return get_intern(idx); }

let keywords = set_new();

function init_keywords() {
  set_add(keywords, "fn");
  set_add(keywords, "let");
  set_add(keywords, "struct");
  set_add(keywords, "enum");
  set_add(keywords, "type");
  set_add(keywords, "match");
  set_add(keywords, "case");
  set_add(keywords, "if");
  set_add(keywords, "else");
  set_add(keywords, "for");
  set_add(keywords, "while");
  set_add(keywords, "loop");
  set_add(keywords, "in");
  set_add(keywords, "return");
  set_add(keywords, "break");
  set_add(keywords, "continue");
  set_add(keywords, "is");
  set_add(keywords, "class");
  set_add(keywords, "object");
  set_add(keywords, "impl");
  set_add(keywords, "with");
  set_add(keywords, "out");
  set_add(keywords, "module");
  set_add(keywords, "extern");
  set_add(keywords, "async");
  return 0;
}

function is_keyword(s) { return set_has(keywords, s); }

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
  lex_len = str_length(source);
  vec_clear(tok_kinds);
  vec_clear(tok_values);
  vec_clear(tok_lines);
  vec_clear(tok_cols);
  tok_count = 0;
  return 0;
}

function lex_peek(offset) {
  let p = (lex_pos + offset);
  return (((p >= lex_len)) ? (() => {
  return 0;
})() : (() => {
  return str_char_at(lex_source, p);
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
  if (str_eq(text, "true")) {
  tok_add(TK_BOOL, 1, start_line, start_col);
} else { if (str_eq(text, "false")) {
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
  if (str_includes("(){}[],:;+-*/%<>=.!?|&", str_from_char_code(ch))) {
  lex_advance();
  tok_add(TK_SYMBOL, intern(str_from_char_code(ch)), start_line, start_col);
  continue;
}
  panic(str_concat("Unexpected character: ", str_from_char_code(ch)));
}
  tok_add(TK_EOF, intern("<eof>"), lex_line, lex_col);
  return tok_count;
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

let NK_NAMED_TYPE = 40;

let NK_POINTER_TYPE = 41;

let NK_ARRAY_TYPE = 42;

let NK_TUPLE_TYPE = 43;

let NK_REFINEMENT_TYPE = 44;

let NK_UNION_TYPE = 45;

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

let node_count = 0;

function node_new(kind) {
  let idx = node_count;
  vec_push(node_kinds, kind);
  vec_push(node_data1, 0);
  vec_push(node_data2, 0);
  vec_push(node_data3, 0);
  vec_push(node_data4, 0);
  vec_push(node_data5, 0);
  node_count = (node_count + 1);
  return idx;
}

function node_kind(idx) { return vec_get(node_kinds, idx); }

// extern type AnyValue

function node_set_data1(idx, v) {
  vec_set(node_data1, idx, v);
  return 0;
}

function node_set_data2(idx, v) {
  vec_set(node_data2, idx, v);
  return 0;
}

function node_set_data3(idx, v) {
  vec_set(node_data3, idx, v);
  return 0;
}

function node_set_data4(idx, v) {
  vec_set(node_data4, idx, v);
  return 0;
}

function node_set_data5(idx, v) {
  vec_set(node_data5, idx, v);
  return 0;
}

function node_get_data1(idx) { return vec_get(node_data1, idx); }

function node_get_data2(idx) { return vec_get(node_data2, idx); }

function node_get_data3(idx) { return vec_get(node_data3, idx); }

function node_get_data4(idx) { return vec_get(node_data4, idx); }

function node_get_data5(idx) { return vec_get(node_data5, idx); }

let parse_pos = 0;

let parse_exports = set_new();

function parse_init() {
  parse_pos = 0;
  parse_exports = set_new();
  vec_clear(node_kinds);
  vec_clear(node_data1);
  vec_clear(node_data2);
  vec_clear(node_data3);
  vec_clear(node_data4);
  vec_clear(node_data5);
  node_count = 0;
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

function p_at_kind(kind) { return (tok_kind(p_peek(0)) == kind); }

function p_at_value(val) {
  let v = tok_value(p_peek(0));
  return (map_has(intern_map, val) && (map_get(intern_map, val) == v));
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
  if (((str_eq(s, "*") || str_eq(s, "[")) || str_eq(s, "("))) {
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

function p_parse_type() {
  if (p_at(TK_SYMBOL, "*")) {
  p_eat();
  let mutable = 0;
  if (p_at(TK_KEYWORD, "mut")) {
  p_eat();
  mutable = 1;
}
  let inner = p_parse_type();
  let node = node_new(NK_POINTER_TYPE);
  node_set_data1(node, mutable);
  node_set_data2(node, inner);
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
  vec_push(members, p_parse_type());
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  vec_push(members, p_parse_type());
}
}
  p_expect(TK_SYMBOL, ")", "Expected ')' in tuple type");
  let node = node_new(NK_TUPLE_TYPE);
  node_set_data1(node, members);
  return node;
}
  let name = p_parse_identifier();
  let generics = vec_new();
  while (p_at(TK_SYMBOL, "::")) {
  p_eat();
  let part = p_parse_identifier();
}
  if ((p_at(TK_SYMBOL, "<") && p_can_start_type_tok_at(1))) {
  p_eat();
  if ((!p_at(TK_SYMBOL, ">"))) {
  vec_push(generics, p_parse_type());
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  vec_push(generics, p_parse_type());
}
}
  p_expect(TK_SYMBOL, ">", "Expected '>' in generic args");
}
  let type_node = node_new(NK_NAMED_TYPE);
  node_set_data1(type_node, name);
  node_set_data2(type_node, generics);
  let has_refine = ((((p_at(TK_SYMBOL, "!=") || p_at(TK_SYMBOL, "<")) || p_at(TK_SYMBOL, ">")) || p_at(TK_SYMBOL, "<=")) || p_at(TK_SYMBOL, ">="));
  if ((has_refine && p_can_start_refinement_expr())) {
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
  let right = p_parse_type();
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
  vec_push(fields, p_parse_identifier());
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  vec_push(fields, p_parse_identifier());
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

function p_parse_function(is_class) {
  p_expect(TK_KEYWORD, "fn", "Expected 'fn'");
  let name = p_parse_identifier();
  let generics = vec_new();
  if (p_at(TK_SYMBOL, "<")) {
  p_eat();
  if ((!p_at(TK_SYMBOL, ">"))) {
  vec_push(generics, p_parse_identifier());
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  vec_push(generics, p_parse_identifier());
}
}
  p_expect(TK_SYMBOL, ">", "Expected '>'");
}
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
  vec_push(param, pname);
  vec_push(param, ptype);
  vec_push(params, param);
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  let pname2 = p_parse_identifier();
  let ptype2 = 0;
  if (p_at(TK_SYMBOL, ":")) {
  p_eat();
  ptype2 = p_parse_type();
}
  let param2 = vec_new();
  vec_push(param2, pname2);
  vec_push(param2, ptype2);
  vec_push(params, param2);
}
}
  p_expect(TK_SYMBOL, ")", "Expected ')'");
  let ret_type = 0;
  if (p_at(TK_SYMBOL, ":")) {
  p_eat();
  ret_type = p_parse_type();
}
  p_expect(TK_SYMBOL, "=>", "Expected '=>'");
  let body = ((p_at(TK_SYMBOL, "{")) ? (() => {
  return p_parse_block();
})() : (() => {
  return p_parse_expression(0);
})());
  if ((node_kind(body) != NK_BLOCK)) {
  if (((!p_at(TK_SYMBOL, "}")) && (!p_at_kind(TK_EOF)))) {
  p_expect(TK_SYMBOL, ";", "Expected ';'");
}
}
  let kind = (((is_class == 1)) ? (() => {
  return NK_CLASS_FN_DECL;
})() : (() => {
  return NK_FN_DECL;
})());
  let node = node_new(kind);
  node_set_data1(node, name);
  node_set_data2(node, generics);
  node_set_data3(node, params);
  node_set_data4(node, ret_type);
  node_set_data5(node, body);
  return node;
}

function p_parse_struct() {
  p_expect(TK_KEYWORD, "struct", "Expected 'struct'");
  let name = p_parse_identifier();
  let generics = vec_new();
  if (p_at(TK_SYMBOL, "<")) {
  p_eat();
  if ((!p_at(TK_SYMBOL, ">"))) {
  vec_push(generics, p_parse_identifier());
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  vec_push(generics, p_parse_identifier());
}
}
  p_expect(TK_SYMBOL, ">", "Expected '>'");
}
  p_expect(TK_SYMBOL, "{", "Expected '{'");
  let fields = vec_new();
  while ((!p_at(TK_SYMBOL, "}"))) {
  let fname = p_parse_identifier();
  p_expect(TK_SYMBOL, ":", "Expected ':'");
  let ftype = p_parse_type();
  let field = vec_new();
  vec_push(field, fname);
  vec_push(field, ftype);
  vec_push(fields, field);
  if ((p_at(TK_SYMBOL, ",") || p_at(TK_SYMBOL, ";"))) {
  p_eat();
}
}
  p_expect(TK_SYMBOL, "}", "Expected '}'");
  let node = node_new(NK_STRUCT_DECL);
  node_set_data1(node, name);
  node_set_data2(node, generics);
  node_set_data3(node, fields);
  return node;
}

function p_parse_enum() {
  p_expect(TK_KEYWORD, "enum", "Expected 'enum'");
  let name = p_parse_identifier();
  p_expect(TK_SYMBOL, "{", "Expected '{' after enum name");
  let variants = vec_new();
  while ((!p_at(TK_SYMBOL, "}"))) {
  vec_push(variants, p_parse_identifier());
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

function p_parse_type_alias() {
  p_expect(TK_KEYWORD, "type", "Expected 'type'");
  let name = p_parse_identifier();
  let generics = vec_new();
  if (p_at(TK_SYMBOL, "<")) {
  p_eat();
  if ((!p_at(TK_SYMBOL, ">"))) {
  vec_push(generics, p_parse_identifier());
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  vec_push(generics, p_parse_identifier());
}
}
  p_expect(TK_SYMBOL, ">", "Expected '>'");
}
  p_expect(TK_SYMBOL, "=", "Expected '='");
  let aliased = p_parse_type();
  p_expect(TK_SYMBOL, ";", "Expected ';'");
  let node = node_new(NK_TYPE_ALIAS);
  node_set_data1(node, name);
  node_set_data2(node, generics);
  node_set_data3(node, aliased);
  return node;
}

function p_parse_let() {
  p_expect(TK_KEYWORD, "let", "Expected 'let'");
  if (p_at(TK_SYMBOL, "{")) {
  p_eat();
  let names = vec_new();
  if ((!p_at(TK_SYMBOL, "}"))) {
  vec_push(names, p_parse_identifier());
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  vec_push(names, p_parse_identifier());
}
}
  p_expect(TK_SYMBOL, "}", "Expected '}'");
  p_expect(TK_SYMBOL, "=", "Expected '='");
  let parts = vec_new();
  vec_push(parts, p_parse_identifier());
  while (p_at(TK_SYMBOL, "::")) {
  p_eat();
  vec_push(parts, p_parse_identifier());
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

function p_parse_extern_decl() {
  if (p_at(TK_KEYWORD, "fn")) {
  p_eat();
  let name = p_parse_identifier();
  let generics = vec_new();
  if (p_at(TK_SYMBOL, "<")) {
  p_eat();
  if ((!p_at(TK_SYMBOL, ">"))) {
  vec_push(generics, p_parse_identifier());
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  vec_push(generics, p_parse_identifier());
}
}
  p_expect(TK_SYMBOL, ">", "Expected '>'");
}
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
  vec_push(param, pname);
  vec_push(param, ptype);
  vec_push(params, param);
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  let pname2 = p_parse_identifier();
  let ptype2 = 0;
  if (p_at(TK_SYMBOL, ":")) {
  p_eat();
  ptype2 = p_parse_type();
}
  let param2 = vec_new();
  vec_push(param2, pname2);
  vec_push(param2, ptype2);
  vec_push(params, param2);
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
  let generics = vec_new();
  if (p_at(TK_SYMBOL, "<")) {
  p_eat();
  if ((!p_at(TK_SYMBOL, ">"))) {
  vec_push(generics, p_parse_identifier());
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  vec_push(generics, p_parse_identifier());
}
}
  p_expect(TK_SYMBOL, ">", "Expected '>' after extern type generics");
}
  p_expect(TK_SYMBOL, ";", "Expected ';' after extern type");
  let node = node_new(NK_EXTERN_TYPE_DECL);
  node_set_data1(node, name);
  node_set_data2(node, generics);
  return node;
}
  return panic("Expected fn, let, or type after extern");
}

function p_parse_statement() {
  if (p_at(TK_KEYWORD, "out")) {
  p_eat();
  if (p_at(TK_KEYWORD, "struct")) {
  let out_node = p_parse_struct();
  set_add(parse_exports, get_interned_str(node_get_data1(out_node)));
  return out_node;
}
  if (p_at(TK_KEYWORD, "enum")) {
  let out_node = p_parse_enum();
  set_add(parse_exports, get_interned_str(node_get_data1(out_node)));
  return out_node;
}
  if (p_at(TK_KEYWORD, "type")) {
  let out_node = p_parse_type_alias();
  set_add(parse_exports, get_interned_str(node_get_data1(out_node)));
  return out_node;
}
  if (p_at(TK_KEYWORD, "fn")) {
  let out_node = p_parse_function(0);
  set_add(parse_exports, get_interned_str(node_get_data1(out_node)));
  return out_node;
}
  if (p_at(TK_KEYWORD, "class")) {
  p_eat();
  let out_node = p_parse_function(1);
  set_add(parse_exports, get_interned_str(node_get_data1(out_node)));
  return out_node;
}
  panic("Expected declaration after 'out'");
}
  if (p_at(TK_KEYWORD, "let")) {
  return p_parse_let();
}
  if (p_at(TK_KEYWORD, "struct")) {
  return p_parse_struct();
}
  if (p_at(TK_KEYWORD, "enum")) {
  return p_parse_enum();
}
  if (p_at(TK_KEYWORD, "type")) {
  return p_parse_type_alias();
}
  if (p_at(TK_KEYWORD, "fn")) {
  return p_parse_function(0);
}
  if (p_at(TK_KEYWORD, "extern")) {
  p_eat();
  return p_parse_extern_decl();
}
  if (p_at(TK_KEYWORD, "class")) {
  p_eat();
  return p_parse_function(1);
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
  vec_push(stmts, p_parse_statement());
}
  let node = node_new(NK_PROGRAM);
  node_set_data1(node, stmts);
  return node;
}

function desugar(program) { return program; }

function selfhost_parser_decls_marker() { return 0; }

function scope_define(scopes, depth, name) {
  let scope = vec_get(scopes, depth);
  if (set_has(scope, name)) {
  panic_with_code("E_RESOLVE_SHADOWING", str_concat("Variable shadowing/redeclaration is not allowed: ", name), "A name was declared multiple times in the same lexical scope.", "Rename one of the bindings or move it to a different scope.");
}
  set_add(scope, name);
  return 0;
}

function scope_has(scopes, depth, name) {
  let i = depth;
  while ((i >= 0)) {
  if (set_has(vec_get(scopes, i), name)) {
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
  if (((!scope_has(scopes, depth, name)) && (!set_has(globals, name)))) {
  panic_with_code("E_RESOLVE_UNKNOWN_IDENTIFIER", str_concat("Unknown identifier: ", name), "The identifier is not declared in local scope, global declarations, or imports.", "Declare the identifier before use or import it from the correct module.");
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
  resolve_expr(node_get_data1(n), globals, scopes, depth);
  let args = node_get_data2(n);
  let i = 0;
  let len = vec_length(args);
  while ((i < len)) {
  resolve_expr(vec_get(args, i), globals, scopes, depth);
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
  if ((!set_has(globals, type_name))) {
  panic_with_code("E_RESOLVE_UNKNOWN_STRUCT", str_concat("Unknown struct/type in initializer: ", type_name), "A struct initializer referenced a type that is not declared in the merged module scope.", "Declare the struct/type first or import the module that defines it.");
}
  let fields = node_get_data2(n);
  let i = 0;
  let len = vec_length(fields);
  while ((i < len)) {
  let field = vec_get(fields, i);
  resolve_expr(vec_get(field, 1), globals, scopes, depth);
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
  let len = vec_length(cases);
  while ((i < len)) {
  let case_node = vec_get(cases, i);
  let pat = vec_get(case_node, 0);
  let body = vec_get(case_node, 1);
  let next_depth = (depth + 1);
  vec_push(scopes, set_new());
  if ((node_kind(pat) == NK_STRUCT_PAT)) {
  let fields = node_get_data2(pat);
  let j = 0;
  let fLen = vec_length(fields);
  while ((j < fLen)) {
  scope_define(scopes, next_depth, get_interned_str(vec_get(fields, j)));
  j = (j + 1);
}
} else { if ((node_kind(pat) == NK_NAME_PAT)) {
  let pat_name = get_interned_str(node_get_data1(pat));
  if ((!set_has(globals, pat_name))) {
  scope_define(scopes, next_depth, pat_name);
}
} }
  resolve_stmt(body, globals, scopes, next_depth);
  vec_pop(scopes);
  i = (i + 1);
}
  return 0;
}
  if ((kind == NK_IS_EXPR)) {
  resolve_expr(node_get_data1(n), globals, scopes, depth);
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
  vec_push(scopes, set_new());
  let stmts = node_get_data1(n);
  let i = 0;
  let len = vec_length(stmts);
  while ((i < len)) {
  resolve_stmt(vec_get(stmts, i), globals, scopes, next_depth);
  i = (i + 1);
}
  vec_pop(scopes);
  return 0;
}
  if (((kind == NK_FN_DECL) || (kind == NK_CLASS_FN_DECL))) {
  let fnScopes = vec_new();
  vec_push(fnScopes, set_new());
  let params = node_get_data3(n);
  let i = 0;
  let len = vec_length(params);
  while ((i < len)) {
  let param = vec_get(params, i);
  scope_define(fnScopes, 0, get_interned_str(vec_get(param, 0)));
  i = (i + 1);
}
  resolve_stmt(node_get_data5(n), globals, fnScopes, 0);
  return 0;
}
  if ((kind == NK_LET_DECL)) {
  resolve_expr(node_get_data3(n), globals, scopes, depth);
  scope_define(scopes, depth, get_interned_str(node_get_data1(n)));
  return 0;
}
  if ((kind == NK_IMPORT_DECL)) {
  let names = node_get_data1(n);
  let i = 0;
  let len = vec_length(names);
  while ((i < len)) {
  scope_define(scopes, depth, get_interned_str(vec_get(names, i)));
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
  vec_push(scopes, set_new());
  scope_define(scopes, next_depth, get_interned_str(node_get_data1(n)));
  resolve_expr(node_get_data2(n), globals, scopes, next_depth);
  resolve_expr(node_get_data3(n), globals, scopes, next_depth);
  resolve_stmt(node_get_data4(n), globals, scopes, next_depth);
  vec_pop(scopes);
  return 0;
}
  if ((kind == NK_WHILE_STMT)) {
  resolve_expr(node_get_data1(n), globals, scopes, depth);
  resolve_stmt(node_get_data2(n), globals, scopes, depth);
  return 0;
}
  resolve_expr(n, globals, scopes, depth);
  return 0;
}

function resolve_names(program) {
  let globals = set_new();
  let body = node_get_data1(program);
  let i = 0;
  let len = vec_length(body);
  while ((i < len)) {
  let stmt = vec_get(body, i);
  let kind = node_kind(stmt);
  if ((((((((((kind == NK_FN_DECL) || (kind == NK_CLASS_FN_DECL)) || (kind == NK_STRUCT_DECL)) || (kind == NK_ENUM_DECL)) || (kind == NK_TYPE_ALIAS)) || (kind == NK_LET_DECL)) || (kind == NK_EXTERN_FN_DECL)) || (kind == NK_EXTERN_LET_DECL)) || (kind == NK_EXTERN_TYPE_DECL))) {
  let gname = get_interned_str(node_get_data1(stmt));
  if (set_has(globals, gname)) {
  panic_with_code("E_RESOLVE_SHADOWING", str_concat("Variable shadowing/redeclaration is not allowed: ", gname), "A global declaration with the same name already exists.", "Rename one of the global declarations or split conflicting declarations into separate modules.");
}
  set_add(globals, gname);
}
  i = (i + 1);
}
  let topScopes = vec_new();
  vec_push(topScopes, set_new());
  i = 0;
  while ((i < len)) {
  resolve_stmt(vec_get(body, i), globals, topScopes, 0);
  i = (i + 1);
}
  return program;
}

function selfhost_resolver_marker() { return 0; }

function typecheck_expr(n, fn_arities) {
  if ((n == 0)) {
  return 0;
}
  let kind = node_kind(n);
  if ((kind == NK_BINARY_EXPR)) {
  typecheck_expr(node_get_data2(n), fn_arities);
  typecheck_expr(node_get_data3(n), fn_arities);
  return 0;
}
  if (((kind == NK_UNARY_EXPR) || (kind == NK_UNWRAP_EXPR))) {
  if ((kind == NK_UNARY_EXPR)) {
  typecheck_expr(node_get_data2(n), fn_arities);
} else {
  typecheck_expr(node_get_data1(n), fn_arities);
}
  return 0;
}
  if ((kind == NK_CALL_EXPR)) {
  let callee = node_get_data1(n);
  let args = node_get_data2(n);
  let actual = vec_length(args);
  if ((node_kind(callee) == NK_IDENTIFIER)) {
  let fname = get_interned_str(node_get_data1(callee));
  if (map_has(fn_arities, fname)) {
  let expected = map_get(fn_arities, fname);
  if ((expected != actual)) {
  let msg = str_concat(str_concat(str_concat("Function ", fname), str_concat(" expects ", int_to_string(expected))), str_concat(" args, got ", int_to_string(actual)));
  panic_with_code("E_TYPE_ARG_COUNT", msg, "A function call provided a different number of arguments than the function signature requires.", "Pass exactly the number of parameters declared by the function.");
}
}
}
  typecheck_expr(callee, fn_arities);
  let i = 0;
  while ((i < actual)) {
  typecheck_expr(vec_get(args, i), fn_arities);
  i = (i + 1);
}
  return 0;
}
  if ((kind == NK_MEMBER_EXPR)) {
  typecheck_expr(node_get_data1(n), fn_arities);
  return 0;
}
  if ((kind == NK_INDEX_EXPR)) {
  typecheck_expr(node_get_data1(n), fn_arities);
  typecheck_expr(node_get_data2(n), fn_arities);
  return 0;
}
  if ((kind == NK_STRUCT_INIT)) {
  let fields = node_get_data2(n);
  let i = 0;
  let len = vec_length(fields);
  while ((i < len)) {
  let field = vec_get(fields, i);
  typecheck_expr(vec_get(field, 1), fn_arities);
  i = (i + 1);
}
  return 0;
}
  if ((kind == NK_IF_EXPR)) {
  typecheck_expr(node_get_data1(n), fn_arities);
  typecheck_stmt(node_get_data2(n), fn_arities);
  if ((node_get_data3(n) != 0)) {
  typecheck_stmt(node_get_data3(n), fn_arities);
}
  return 0;
}
  if ((kind == NK_MATCH_EXPR)) {
  typecheck_expr(node_get_data1(n), fn_arities);
  let cases = node_get_data2(n);
  let i = 0;
  let len = vec_length(cases);
  while ((i < len)) {
  let case_node = vec_get(cases, i);
  typecheck_stmt(vec_get(case_node, 1), fn_arities);
  i = (i + 1);
}
  return 0;
}
  if ((kind == NK_IS_EXPR)) {
  typecheck_expr(node_get_data1(n), fn_arities);
  return 0;
}
  return 0;
}

function typecheck_stmt(n, fn_arities) {
  if ((n == 0)) {
  return 0;
}
  let kind = node_kind(n);
  if ((kind == NK_BLOCK)) {
  let stmts = node_get_data1(n);
  let i = 0;
  let len = vec_length(stmts);
  while ((i < len)) {
  typecheck_stmt(vec_get(stmts, i), fn_arities);
  i = (i + 1);
}
  return 0;
}
  if (((kind == NK_FN_DECL) || (kind == NK_CLASS_FN_DECL))) {
  typecheck_stmt(node_get_data5(n), fn_arities);
  return 0;
}
  if ((kind == NK_LET_DECL)) {
  typecheck_expr(node_get_data3(n), fn_arities);
  return 0;
}
  if ((kind == NK_EXPR_STMT)) {
  typecheck_expr(node_get_data1(n), fn_arities);
  return 0;
}
  if ((kind == NK_ASSIGN_STMT)) {
  typecheck_expr(node_get_data1(n), fn_arities);
  typecheck_expr(node_get_data2(n), fn_arities);
  return 0;
}
  if ((kind == NK_RETURN_STMT)) {
  typecheck_expr(node_get_data1(n), fn_arities);
  return 0;
}
  if ((kind == NK_IF_STMT)) {
  typecheck_expr(node_get_data1(n), fn_arities);
  typecheck_stmt(node_get_data2(n), fn_arities);
  if ((node_get_data3(n) != 0)) {
  typecheck_stmt(node_get_data3(n), fn_arities);
}
  return 0;
}
  if ((kind == NK_FOR_STMT)) {
  typecheck_expr(node_get_data2(n), fn_arities);
  typecheck_expr(node_get_data3(n), fn_arities);
  typecheck_stmt(node_get_data4(n), fn_arities);
  return 0;
}
  if ((kind == NK_WHILE_STMT)) {
  typecheck_expr(node_get_data1(n), fn_arities);
  typecheck_stmt(node_get_data2(n), fn_arities);
  return 0;
}
  typecheck_expr(n, fn_arities);
  return 0;
}

function typecheck_program(program) {
  let fn_arities = map_new();
  let body = node_get_data1(program);
  let i = 0;
  let len = vec_length(body);
  while ((i < len)) {
  let stmt = vec_get(body, i);
  let kind = node_kind(stmt);
  if ((((kind == NK_FN_DECL) || (kind == NK_CLASS_FN_DECL)) || (kind == NK_EXTERN_FN_DECL))) {
  let name = get_interned_str(node_get_data1(stmt));
  let params = node_get_data3(stmt);
  map_set(fn_arities, name, vec_length(params));
}
  i = (i + 1);
}
  i = 0;
  while ((i < len)) {
  typecheck_stmt(vec_get(body, i), fn_arities);
  i = (i + 1);
}
  return program;
}

function selfhost_typecheck_marker() { return 0; }

function emit_stmt(n) {
  let kind = node_kind(n);
  if ((kind == NK_LET_DECL)) {
  let name_idx = node_get_data1(n);
  let name = get_interned_str(name_idx);
  let value = emit_expr(node_get_data3(n));
  return str_concat(str_concat(str_concat("let ", name), " = "), str_concat(value, ";"));
}
  if ((kind == NK_IMPORT_DECL)) {
  return "// import placeholder";
}
  if ((kind == NK_EXPR_STMT)) {
  return str_concat(emit_expr(node_get_data1(n)), ";");
}
  if ((kind == NK_ASSIGN_STMT)) {
  let target = emit_expr(node_get_data1(n));
  let value = emit_expr(node_get_data2(n));
  return str_concat(str_concat(str_concat(target, " = "), value), ";");
}
  if ((kind == NK_RETURN_STMT)) {
  let value = node_get_data1(n);
  if ((value == 0)) {
  return "return;";
}
  return str_concat("return ", str_concat(emit_expr(value), ";"));
}
  if ((kind == NK_IF_STMT)) {
  let cond = emit_expr(node_get_data1(n));
  let then_b = emit_block(node_get_data2(n));
  let else_b = node_get_data3(n);
  if ((else_b == 0)) {
  return str_concat(str_concat("if (", cond), str_concat(") ", then_b));
}
  return str_concat(str_concat(str_concat(str_concat("if (", cond), ") "), then_b), str_concat(" else ", emit_stmt_or_block(else_b)));
}
  if ((kind == NK_IF_EXPR)) {
  let cond = emit_expr(node_get_data1(n));
  let then_b = node_get_data2(n);
  let else_b = node_get_data3(n);
  let then_str = emit_stmt_or_block(then_b);
  if ((else_b == 0)) {
  return str_concat(str_concat("if (", cond), str_concat(") ", then_str));
}
  return str_concat(str_concat(str_concat(str_concat("if (", cond), ") "), then_str), str_concat(" else ", emit_stmt_or_block(else_b)));
}
  if ((kind == NK_WHILE_STMT)) {
  let cond = emit_expr(node_get_data1(n));
  let body = emit_block(node_get_data2(n));
  return str_concat(str_concat("while (", cond), str_concat(") ", body));
}
  if ((kind == NK_FOR_STMT)) {
  let iter_idx = node_get_data1(n);
  let iter = get_interned_str(iter_idx);
  let start = emit_expr(node_get_data2(n));
  let end = emit_expr(node_get_data3(n));
  let body = emit_block(node_get_data4(n));
  return str_concat(str_concat(str_concat(str_concat(str_concat(str_concat(str_concat("for (let ", iter), " = "), start), str_concat("; ", iter)), str_concat(" < ", end)), str_concat("; ", str_concat(iter, "++) "))), body);
}
  if ((kind == NK_BREAK_STMT)) {
  return "break;";
}
  if ((kind == NK_CONTINUE_STMT)) {
  return "continue;";
}
  if ((kind == NK_BLOCK)) {
  return emit_block(n);
}
  if (((kind == NK_FN_DECL) || (kind == NK_CLASS_FN_DECL))) {
  let name_idx = node_get_data1(n);
  let name = get_interned_str(name_idx);
  let params = node_get_data3(n);
  let body = node_get_data5(n);
  let param_names = vec_new();
  let i = 0;
  let len = vec_length(params);
  while ((i < len)) {
  let param = vec_get(params, i);
  vec_push(param_names, get_interned_str(vec_get(param, 0)));
  i = (i + 1);
}
  let params_str = vec_join(param_names, ", ");
  if ((node_kind(body) == NK_BLOCK)) {
  return str_concat(str_concat(str_concat("function ", name), str_concat("(", params_str)), str_concat(") ", emit_fn_block(body)));
}
  return str_concat(str_concat(str_concat(str_concat("function ", name), str_concat("(", params_str)), ") { return "), str_concat(emit_expr(body), "; }"));
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
  let len = vec_length(fields);
  while ((i < len)) {
  let field = vec_get(fields, i);
  let fname = get_interned_str(vec_get(field, 0));
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
  return str_concat(str_concat("// type ", name), " = ...");
}
  if ((kind == NK_ENUM_DECL)) {
  let name = get_interned_str(node_get_data1(n));
  let variants = node_get_data2(n);
  let sb = sb_new();
  sb_append(sb, "const ");
  sb_append(sb, name);
  sb_append(sb, " = { ");
  let i = 0;
  let len = vec_length(variants);
  while ((i < len)) {
  if ((i > 0)) {
  sb_append(sb, ", ");
}
  let v = get_interned_str(vec_get(variants, i));
  sb_append(sb, v);
  sb_append(sb, ": { __tag: \"");
  sb_append(sb, v);
  sb_append(sb, "\" }");
  i = (i + 1);
}
  sb_append(sb, " }; ");
  return sb_build(sb);
}
  if ((kind == NK_EXTERN_FN_DECL)) {
  let name_idx = node_get_data1(n);
  let name = get_interned_str(name_idx);
  return str_concat("// extern fn ", name);
}
  if ((kind == NK_EXTERN_LET_DECL)) {
  let name_idx = node_get_data1(n);
  let name = get_interned_str(name_idx);
  return str_concat("// extern let ", name);
}
  if ((kind == NK_EXTERN_TYPE_DECL)) {
  let name_idx = node_get_data1(n);
  let name = get_interned_str(name_idx);
  return str_concat("// extern type ", name);
}
  return "";
}

function emit_stmt_or_block(n) {
  if ((node_kind(n) == NK_BLOCK)) {
  return emit_block(n);
}
  return str_concat("{ ", str_concat(emit_stmt(n), " }"));
}

function emit_block(n) {
  let stmts = node_get_data1(n);
  let sb = sb_new();
  sb_append(sb, "{\n");
  let i = 0;
  let len = vec_length(stmts);
  while ((i < len)) {
  sb_append(sb, "  ");
  sb_append(sb, emit_stmt(vec_get(stmts, i)));
  sb_append(sb, "\n");
  i = (i + 1);
}
  sb_append(sb, "}");
  return sb_build(sb);
}

function emit_block_as_iife(n) {
  let stmts = node_get_data1(n);
  let len = vec_length(stmts);
  if ((len == 0)) {
  return "(() => undefined)()";
}
  let sb = sb_new();
  sb_append(sb, "(() => {\n");
  let i = 0;
  while ((i < len)) {
  let stmt = vec_get(stmts, i);
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
  let len = vec_length(stmts);
  if ((len == 0)) {
  return "{\n}";
}
  let sb = sb_new();
  sb_append(sb, "{\n");
  let i = 0;
  while ((i < len)) {
  let stmt = vec_get(stmts, i);
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
  return str_concat(str_concat(str_concat(str_concat("((", cond), ") ? "), str_concat(then_code, " : ")), str_concat(else_code, ")"));
}

function emit_branch_as_expr(n) {
  let kind = node_kind(n);
  if ((kind == NK_BLOCK)) {
  let stmts = node_get_data1(n);
  let len = vec_length(stmts);
  if ((len == 0)) {
  return "undefined";
}
  let sb = sb_new();
  sb_append(sb, "(() => {\n");
  let i = 0;
  while ((i < len)) {
  let stmt = vec_get(stmts, i);
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
  let len = vec_length(stmts);
  while ((i < len)) {
  sb_append(sb, emit_stmt(vec_get(stmts, i)));
  sb_append(sb, "\n\n");
  i = (i + 1);
}
  return sb_build(sb);
}

function selfhost_codegen_stmt_marker() { return 0; }

function module_parts_to_relative_path(parts) {
  let sb = sb_new();
  let i = 0;
  let len = vec_length(parts);
  while ((i < len)) {
  if ((i > 0)) {
  sb_append(sb, "/");
}
  sb_append(sb, get_interned_str(vec_get(parts, i)));
  i = (i + 1);
}
  sb_append(sb, ".tuff");
  return sb_build(sb);
}

function join_sources(sources) {
  let sb = sb_new();
  let i = 0;
  let len = vec_length(sources);
  while ((i < len)) {
  if ((i > 0)) {
  sb_append(sb, "\n\n");
}
  sb_append(sb, vec_get(sources, i));
  i = (i + 1);
}
  return sb_build(sb);
}

function is_module_decl_kind(kind) {
  return (((((((((kind == 2) || (kind == 16)) || (kind == 3)) || (kind == 60)) || (kind == 4)) || (kind == 5)) || (kind == 17)) || (kind == 18)) || (kind == 19));
}

function collect_module_declarations(stmts) {
  let declared = set_new();
  let i = 0;
  let len = vec_length(stmts);
  while ((i < len)) {
  let stmt = vec_get(stmts, i);
  let kind = node_kind(stmt);
  if (is_module_decl_kind(kind)) {
  set_add(declared, get_interned_str(node_get_data1(stmt)));
}
  i = (i + 1);
}
  return declared;
}

function module_has_out_export(source, name) {
  return ((((str_includes(source, str_concat("out fn ", name)) || str_includes(source, str_concat("out struct ", name))) || str_includes(source, str_concat("out enum ", name))) || str_includes(source, str_concat("out type ", name))) || str_includes(source, str_concat("out class fn ", name)));
}

function gather_module_sources(filePath, moduleBasePath, seen, visiting, sources, module_declared_map) {
  if (set_has(seen, filePath)) {
  return 0;
}
  if (set_has(visiting, filePath)) {
  panic_with_code("E_MODULE_CYCLE", str_concat("Module import cycle detected at ", filePath), "A module was revisited while still being loaded, which means the import graph contains a cycle.", "Break the cycle by extracting shared declarations into a third module imported by both sides.");
}
  set_add(visiting, filePath);
  let source = read_file(filePath);
  lex_init(source);
  lex_all();
  parse_init();
  let program = p_parse_program();
  let stmts = node_get_data1(program);
  let declared = collect_module_declarations(stmts);
  map_set(module_declared_map, filePath, declared);
  let imports = vec_new();
  let i = 0;
  let len = vec_length(stmts);
  while ((i < len)) {
  let stmt = vec_get(stmts, i);
  if ((node_kind(stmt) == 6)) {
  let parts = node_get_data2(stmt);
  let rel = module_parts_to_relative_path(parts);
  let depPath = path_join(moduleBasePath, rel);
  let importNamesRaw = node_get_data1(stmt);
  let importNames = vec_new();
  let j = 0;
  let jLen = vec_length(importNamesRaw);
  while ((j < jLen)) {
  vec_push(importNames, get_interned_str(vec_get(importNamesRaw, j)));
  j = (j + 1);
}
  let importSpec = vec_new();
  vec_push(importSpec, depPath);
  vec_push(importSpec, importNames);
  vec_push(imports, importSpec);
}
  i = (i + 1);
}
  i = 0;
  len = vec_length(imports);
  while ((i < len)) {
  let spec = vec_get(imports, i);
  let depPath = vec_get(spec, 0);
  let importNames = vec_get(spec, 1);
  gather_module_sources(depPath, moduleBasePath, seen, visiting, sources, module_declared_map);
  let depDeclared = map_get(module_declared_map, depPath);
  let depSource = read_file(depPath);
  let j = 0;
  let jLen = vec_length(importNames);
  while ((j < jLen)) {
  let importedName = vec_get(importNames, j);
  if ((!module_has_out_export(depSource, importedName))) {
  if (set_has(depDeclared, importedName)) {
  panic_with_code("E_MODULE_PRIVATE_IMPORT", str_concat(str_concat("Cannot import '", importedName), "' from module: symbol is not exported with 'out'"), "A module import referenced a declaration that exists but is not visible outside its module.", "Mark the declaration with 'out' in the target module, or remove it from the import list.");
}
  panic_with_code("E_MODULE_UNKNOWN_EXPORT", str_concat(str_concat("Cannot import '", importedName), "' from module: exported symbol not found"), "A module import requested a symbol that is not exported by the target module.", "Check the import list and add a matching 'out' declaration in the target module.");
}
  j = (j + 1);
}
  i = (i + 1);
}
  set_delete(visiting, filePath);
  set_add(seen, filePath);
  vec_push(sources, source);
  return 0;
}

function compile_file(inputPath, outputPath) {
  let moduleBasePath = path_dirname(inputPath);
  let seen = set_new();
  let visiting = set_new();
  let sources = vec_new();
  let module_declared_map = map_new();
  gather_module_sources(inputPath, moduleBasePath, seen, visiting, sources, module_declared_map);
  let merged = join_sources(sources);
  lex_init(merged);
  lex_all();
  parse_init();
  let program = p_parse_program();
  let desugared = desugar(program);
  let resolved = resolve_names(desugared);
  let typed = typecheck_program(resolved);
  let js = generate_js(typed);
  return write_file(outputPath, js);
}

function p_parse_postfix(exprIn) {
  let expr = exprIn;
  while (true) {
  if (p_at(TK_SYMBOL, "(")) {
  p_eat();
  let args = vec_new();
  if ((!p_at(TK_SYMBOL, ")"))) {
  vec_push(args, p_parse_expression(0));
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  vec_push(args, p_parse_expression(0));
}
}
  p_expect(TK_SYMBOL, ")", "Expected ')'");
  if ((node_kind(expr) == NK_MEMBER_EXPR)) {
  let recv = node_get_data1(expr);
  let prop = node_get_data2(expr);
  let lowered_args = vec_new();
  vec_push(lowered_args, recv);
  let ai = 0;
  let alen = vec_length(args);
  while ((ai < alen)) {
  vec_push(lowered_args, vec_get(args, ai));
  ai = (ai + 1);
}
  let callee = node_new(NK_IDENTIFIER);
  node_set_data1(callee, prop);
  let call = node_new(NK_CALL_EXPR);
  node_set_data1(call, callee);
  node_set_data2(call, lowered_args);
  expr = call;
} else {
  let call = node_new(NK_CALL_EXPR);
  node_set_data1(call, expr);
  node_set_data2(call, args);
  expr = call;
}
  continue;
}
  if (p_at(TK_SYMBOL, ".")) {
  p_eat();
  let prop = p_parse_identifier();
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
  vec_push(case_node, pat);
  vec_push(case_node, body);
  vec_push(cases, case_node);
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
  if (p_at(TK_SYMBOL, "{")) {
  p_eat();
  let fields = vec_new();
  if ((!p_at(TK_SYMBOL, "}"))) {
  let key = p_parse_identifier();
  p_expect(TK_SYMBOL, ":", "Expected ':' in struct init");
  let val = p_parse_expression(0);
  let field = vec_new();
  vec_push(field, key);
  vec_push(field, val);
  vec_push(fields, field);
  while (p_at(TK_SYMBOL, ",")) {
  p_eat();
  let key2 = p_parse_identifier();
  p_expect(TK_SYMBOL, ":", "Expected ':'");
  let val2 = p_parse_expression(0);
  let field2 = vec_new();
  vec_push(field2, key2);
  vec_push(field2, val2);
  vec_push(fields, field2);
}
}
  p_expect(TK_SYMBOL, "}", "Expected '}'");
  let init_node = node_new(NK_STRUCT_INIT);
  node_set_data1(init_node, name);
  node_set_data2(init_node, fields);
  expr = init_node;
}
  return p_parse_postfix(expr);
}
  panic("Unexpected token in expression");
  return 0;
}

function p_parse_unary() {
  if ((p_at(TK_SYMBOL, "!") || p_at(TK_SYMBOL, "-"))) {
  let op = tok_value(p_eat());
  let inner = p_parse_unary();
  let node = node_new(NK_UNARY_EXPR);
  node_set_data1(node, op);
  node_set_data2(node, inner);
  return node;
}
  return p_parse_primary();
}

function p_get_precedence(op) {
  if ((map_has(intern_map, "||") && (op == map_get(intern_map, "||")))) {
  return 1;
}
  if ((map_has(intern_map, "&&") && (op == map_get(intern_map, "&&")))) {
  return 2;
}
  if ((map_has(intern_map, "==") && (op == map_get(intern_map, "==")))) {
  return 3;
}
  if ((map_has(intern_map, "!=") && (op == map_get(intern_map, "!=")))) {
  return 3;
}
  if ((map_has(intern_map, "<") && (op == map_get(intern_map, "<")))) {
  return 4;
}
  if ((map_has(intern_map, "<=") && (op == map_get(intern_map, "<=")))) {
  return 4;
}
  if ((map_has(intern_map, ">") && (op == map_get(intern_map, ">")))) {
  return 4;
}
  if ((map_has(intern_map, ">=") && (op == map_get(intern_map, ">=")))) {
  return 4;
}
  if ((map_has(intern_map, "+") && (op == map_get(intern_map, "+")))) {
  return 5;
}
  if ((map_has(intern_map, "-") && (op == map_get(intern_map, "-")))) {
  return 5;
}
  if ((map_has(intern_map, "*") && (op == map_get(intern_map, "*")))) {
  return 6;
}
  if ((map_has(intern_map, "/") && (op == map_get(intern_map, "/")))) {
  return 6;
}
  if ((map_has(intern_map, "%") && (op == map_get(intern_map, "%")))) {
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
  return false;
}

function p_parse_expression(minPrec) {
  let left = p_parse_unary();
  while (p_is_binary_op()) {
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
  if (p_at(TK_SYMBOL, "?")) {
  p_eat();
  let unwrap = node_new(NK_UNWRAP_EXPR);
  node_set_data1(unwrap, left);
  left = unwrap;
}
  return left;
}

function p_parse_block() {
  p_expect(TK_SYMBOL, "{", "Expected '{'");
  let stmts = vec_new();
  while (((!p_at(TK_SYMBOL, "}")) && (!p_at_kind(TK_EOF)))) {
  vec_push(stmts, p_parse_statement());
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
  return str_concat(str_concat("\"", s), "\"");
}
  if ((kind == NK_CHAR_LIT)) {
  let val = node_get_data1(n);
  let s = get_interned_str(val);
  return str_concat(str_concat("\"", s), "\"");
}
  if ((kind == NK_IDENTIFIER)) {
  let name_idx = node_get_data1(n);
  return get_interned_str(name_idx);
}
  if ((kind == NK_UNARY_EXPR)) {
  let op = get_interned_str(node_get_data1(n));
  let inner = emit_expr(node_get_data2(n));
  return str_concat(str_concat("(", op), str_concat(inner, ")"));
}
  if ((kind == NK_BINARY_EXPR)) {
  let op = get_interned_str(node_get_data1(n));
  if (str_eq(op, "==")) {
  op = "===";
}
  if (str_eq(op, "!=")) {
  op = "!==";
}
  let left = emit_expr(node_get_data2(n));
  let right = emit_expr(node_get_data3(n));
  return str_concat(str_concat(str_concat(str_concat("(", left), str_concat(" ", op)), str_concat(" ", right)), ")");
}
  if ((kind == NK_CALL_EXPR)) {
  let callee = emit_expr(node_get_data1(n));
  let args = node_get_data2(n);
  let arg_strs = vec_new();
  let i = 0;
  let len = vec_length(args);
  while ((i < len)) {
  vec_push(arg_strs, emit_expr(vec_get(args, i)));
  i = (i + 1);
}
  let args_str = vec_join(arg_strs, ", ");
  return str_concat(str_concat(callee, "("), str_concat(args_str, ")"));
}
  if ((kind == NK_MEMBER_EXPR)) {
  let obj = emit_expr(node_get_data1(n));
  let prop = get_interned_str(node_get_data2(n));
  return str_concat(str_concat(obj, "."), prop);
}
  if ((kind == NK_INDEX_EXPR)) {
  let target = emit_expr(node_get_data1(n));
  let idx_expr = emit_expr(node_get_data2(n));
  return str_concat(str_concat(str_concat(target, "["), idx_expr), "]");
}
  if ((kind == NK_STRUCT_INIT)) {
  let name_idx = node_get_data1(n);
  let name = get_interned_str(name_idx);
  let fields = node_get_data2(n);
  let sb = sb_new();
  sb_append(sb, "({ __tag: ");
  sb_append(sb, str_concat(str_concat("\"", name), "\""));
  let i = 0;
  let len = vec_length(fields);
  while ((i < len)) {
  let field = vec_get(fields, i);
  let key_idx = vec_get(field, 0);
  let val_node = vec_get(field, 1);
  sb_append(sb, ", ");
  sb_append(sb, get_interned_str(key_idx));
  sb_append(sb, ": ");
  sb_append(sb, emit_expr(val_node));
  i = (i + 1);
}
  sb_append(sb, " })");
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
  return str_concat(str_concat(str_concat(str_concat("((", cond), ") ? "), str_concat(then_str, " : ")), str_concat(else_str, ")"));
}
  if ((kind == NK_MATCH_EXPR)) {
  let target = emit_expr(node_get_data1(n));
  let cases = node_get_data2(n);
  let sb = sb_new();
  sb_append(sb, "(() => { const __m = ");
  sb_append(sb, target);
  sb_append(sb, "; ");
  let i = 0;
  let len = vec_length(cases);
  while ((i < len)) {
  let case_node = vec_get(cases, i);
  let pat = vec_get(case_node, 0);
  let body = vec_get(case_node, 1);
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
  return str_concat(str_concat("(", emit_pattern_guard(inner, pat)), ")");
}
  if ((kind == NK_UNWRAP_EXPR)) {
  return emit_expr(node_get_data1(n));
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
  return str_concat(str_concat(str_concat(value_expr, " === "), val), "");
}
  if ((kind == NK_NAME_PAT)) {
  let name = get_interned_str(node_get_data1(pat));
  return str_concat(str_concat(str_concat(str_concat(value_expr, " && "), value_expr), ".__tag === \""), str_concat(name, "\""));
}
  if ((kind == NK_STRUCT_PAT)) {
  let name = get_interned_str(node_get_data1(pat));
  return str_concat(str_concat(str_concat(str_concat(value_expr, " && "), value_expr), ".__tag === \""), str_concat(name, "\""));
}
  return "false";
}

function emit_pattern_bindings(value_expr, pat) {
  let kind = node_kind(pat);
  if ((kind == NK_STRUCT_PAT)) {
  let fields = node_get_data2(pat);
  let sb = sb_new();
  let i = 0;
  let len = vec_length(fields);
  while ((i < len)) {
  let fname_idx = vec_get(fields, i);
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
  return str_concat(str_concat(str_concat("const ", name), " = "), str_concat(value_expr, "; "));
}
  return "";
}

function selfhost_codegen_expr_marker() { return 0; }

function compile_source(source) {
  lex_init(source);
  lex_all();
  parse_init();
  let program = p_parse_program();
  let desugared = desugar(program);
  let resolved = resolve_names(desugared);
  let typed = typecheck_program(resolved);
  return generate_js(typed);
}

function main() {
  print("Self-hosted Tuff compiler loaded");
  return 0;
}
