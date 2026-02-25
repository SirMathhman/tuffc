"use strict";

let NK_PROGRAM = 1;
if (typeof __tuff_this !== "undefined") __tuff_this.NK_PROGRAM = NK_PROGRAM;

let NK_FN_DECL = 2;
if (typeof __tuff_this !== "undefined") __tuff_this.NK_FN_DECL = NK_FN_DECL;

let NK_STRUCT_DECL = 3;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_STRUCT_DECL = NK_STRUCT_DECL;

let NK_TYPE_ALIAS = 4;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_TYPE_ALIAS = NK_TYPE_ALIAS;

let NK_LET_DECL = 5;
if (typeof __tuff_this !== "undefined") __tuff_this.NK_LET_DECL = NK_LET_DECL;

let NK_IMPORT_DECL = 6;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_IMPORT_DECL = NK_IMPORT_DECL;

let NK_EXPR_STMT = 7;
if (typeof __tuff_this !== "undefined") __tuff_this.NK_EXPR_STMT = NK_EXPR_STMT;

let NK_RETURN_STMT = 8;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_RETURN_STMT = NK_RETURN_STMT;

let NK_IF_STMT = 9;
if (typeof __tuff_this !== "undefined") __tuff_this.NK_IF_STMT = NK_IF_STMT;

let NK_WHILE_STMT = 10;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_WHILE_STMT = NK_WHILE_STMT;

let NK_FOR_STMT = 11;
if (typeof __tuff_this !== "undefined") __tuff_this.NK_FOR_STMT = NK_FOR_STMT;

let NK_BLOCK = 12;
if (typeof __tuff_this !== "undefined") __tuff_this.NK_BLOCK = NK_BLOCK;

let NK_ASSIGN_STMT = 13;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_ASSIGN_STMT = NK_ASSIGN_STMT;

let NK_BREAK_STMT = 14;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_BREAK_STMT = NK_BREAK_STMT;

let NK_CONTINUE_STMT = 15;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_CONTINUE_STMT = NK_CONTINUE_STMT;

let NK_CLASS_FN_DECL = 16;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_CLASS_FN_DECL = NK_CLASS_FN_DECL;

let NK_EXTERN_LET_DECL = 18;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_EXTERN_LET_DECL = NK_EXTERN_LET_DECL;

let NK_EXTERN_TYPE_DECL = 19;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_EXTERN_TYPE_DECL = NK_EXTERN_TYPE_DECL;

let NK_EXPECT_FN_DECL = 61;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_EXPECT_FN_DECL = NK_EXPECT_FN_DECL;

let NK_ACTUAL_FN_DECL = 62;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_ACTUAL_FN_DECL = NK_ACTUAL_FN_DECL;

let NK_OBJECT_DECL = 63;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_OBJECT_DECL = NK_OBJECT_DECL;

let NK_LOOP_STMT = 64;
if (typeof __tuff_this !== "undefined") __tuff_this.NK_LOOP_STMT = NK_LOOP_STMT;

let NK_CONTRACT_DECL = 65;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_CONTRACT_DECL = NK_CONTRACT_DECL;

let NK_INTO_STMT = 66;
if (typeof __tuff_this !== "undefined") __tuff_this.NK_INTO_STMT = NK_INTO_STMT;

let NK_LIFETIME_STMT = 67;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_LIFETIME_STMT = NK_LIFETIME_STMT;

let NK_STMT_LIST = 68;
if (typeof __tuff_this !== "undefined") __tuff_this.NK_STMT_LIST = NK_STMT_LIST;

let NK_EXTERN_IMPORT_DECL = 69;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_EXTERN_IMPORT_DECL = NK_EXTERN_IMPORT_DECL;

let NK_ENUM_DECL = 60;
if (typeof __tuff_this !== "undefined") __tuff_this.NK_ENUM_DECL = NK_ENUM_DECL;

let NK_DEP_TYPE_ALIAS = 70;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_DEP_TYPE_ALIAS = NK_DEP_TYPE_ALIAS;

let NK_APPLIED_TYPE = 71;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_APPLIED_TYPE = NK_APPLIED_TYPE;

let NK_NUMBER_LIT = 20;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_NUMBER_LIT = NK_NUMBER_LIT;

let NK_BOOL_LIT = 21;
if (typeof __tuff_this !== "undefined") __tuff_this.NK_BOOL_LIT = NK_BOOL_LIT;

let NK_STRING_LIT = 22;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_STRING_LIT = NK_STRING_LIT;

let NK_CHAR_LIT = 23;
if (typeof __tuff_this !== "undefined") __tuff_this.NK_CHAR_LIT = NK_CHAR_LIT;

let NK_IDENTIFIER = 24;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_IDENTIFIER = NK_IDENTIFIER;

let NK_BINARY_EXPR = 25;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_BINARY_EXPR = NK_BINARY_EXPR;

let NK_UNARY_EXPR = 26;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_UNARY_EXPR = NK_UNARY_EXPR;

let NK_CALL_EXPR = 27;
if (typeof __tuff_this !== "undefined") __tuff_this.NK_CALL_EXPR = NK_CALL_EXPR;

let NK_MEMBER_EXPR = 28;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_MEMBER_EXPR = NK_MEMBER_EXPR;

let NK_INDEX_EXPR = 29;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_INDEX_EXPR = NK_INDEX_EXPR;

let NK_STRUCT_INIT = 30;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_STRUCT_INIT = NK_STRUCT_INIT;

let NK_IF_EXPR = 31;
if (typeof __tuff_this !== "undefined") __tuff_this.NK_IF_EXPR = NK_IF_EXPR;

let NK_MATCH_EXPR = 32;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_MATCH_EXPR = NK_MATCH_EXPR;

let NK_IS_EXPR = 33;
if (typeof __tuff_this !== "undefined") __tuff_this.NK_IS_EXPR = NK_IS_EXPR;

let NK_UNWRAP_EXPR = 34;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_UNWRAP_EXPR = NK_UNWRAP_EXPR;

let NK_LAMBDA_EXPR = 35;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_LAMBDA_EXPR = NK_LAMBDA_EXPR;

let NK_FN_EXPR = 36;
if (typeof __tuff_this !== "undefined") __tuff_this.NK_FN_EXPR = NK_FN_EXPR;

let NK_TUPLE_EXPR = 37;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_TUPLE_EXPR = NK_TUPLE_EXPR;

let NK_NAMED_TYPE = 40;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_NAMED_TYPE = NK_NAMED_TYPE;

let NK_POINTER_TYPE = 41;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_POINTER_TYPE = NK_POINTER_TYPE;

let NK_ARRAY_TYPE = 42;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_ARRAY_TYPE = NK_ARRAY_TYPE;

let NK_TUPLE_TYPE = 43;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_TUPLE_TYPE = NK_TUPLE_TYPE;

let NK_REFINEMENT_TYPE = 44;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_REFINEMENT_TYPE = NK_REFINEMENT_TYPE;

let NK_UNION_TYPE = 45;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_UNION_TYPE = NK_UNION_TYPE;

let NK_FUNCTION_TYPE = 46;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_FUNCTION_TYPE = NK_FUNCTION_TYPE;

let NK_WILDCARD_PAT = 50;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_WILDCARD_PAT = NK_WILDCARD_PAT;

let NK_LITERAL_PAT = 51;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_LITERAL_PAT = NK_LITERAL_PAT;

let NK_NAME_PAT = 52;
if (typeof __tuff_this !== "undefined") __tuff_this.NK_NAME_PAT = NK_NAME_PAT;

let NK_STRUCT_PAT = 53;
if (typeof __tuff_this !== "undefined")
  __tuff_this.NK_STRUCT_PAT = NK_STRUCT_PAT;

const __tuff_outer_for_selfhost_parser_kinds_marker =
  typeof __tuff_this !== "undefined" ? __tuff_this : undefined;
function selfhost_parser_kinds_marker() {
  let __tuff_this = { this: __tuff_outer_for_selfhost_parser_kinds_marker };
  return 0;
}
if (typeof __tuff_this !== "undefined")
  __tuff_this.selfhost_parser_kinds_marker = selfhost_parser_kinds_marker;
