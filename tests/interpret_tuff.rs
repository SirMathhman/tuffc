use tuffc::interpretTuff;

#[test]
fn empty_input_returns_zero() {
    assert_eq!(interpretTuff(""), Ok(0));
}

#[test]
fn parses_uppercase_u8_suffix() {
    assert_eq!(interpretTuff("100U8"), Ok(100));
}

#[test]
fn parses_uppercase_u64_suffix() {
    assert_eq!(interpretTuff("42U64"), Ok(42));
}

#[test]
fn adds_typed_literals() {
    assert_eq!(interpretTuff("1U8 + 2U8"), Ok(3));
}

#[test]
fn evaluates_let_binding_and_reference() {
    assert_eq!(interpretTuff("let x : U8 = 1U8 + 2U8; x"), Ok(3));
}

#[test]
fn lets_can_omit_annotations() {
    assert_eq!(interpretTuff("let x = 1U8 + 2U8; x + 4U8"), Ok(7));
}

#[test]
fn lets_can_shadow_previous_bindings() {
    assert_eq!(interpretTuff("let x = 1U8; let x = x + 2U8; x"), Ok(3));
}

#[test]
fn evaluates_mutable_reassignment_and_reference() {
    assert_eq!(interpretTuff("let mut x = 0U8; x = 1U8 + 2U8; x"), Ok(3));
}

#[test]
fn mutable_bindings_support_annotations() {
    assert_eq!(interpretTuff("let mut x : U8 = 0U8; x = 3U8; x"), Ok(3));
}

#[test]
fn rejects_reassigning_immutable_binding() {
    assert!(interpretTuff("let x = 0U8; x = 1U8; x").is_err());
}

#[test]
fn rejects_reassigning_unknown_variable() {
    assert!(interpretTuff("let mut x = 0U8; y = 1U8; x").is_err());
}

#[test]
fn rejects_reassignment_that_violates_annotation() {
    assert!(interpretTuff("let mut x : U8 = 0U8; x = 300U8; x").is_err());
}

#[test]
fn rejects_malformed_reassignment_statement() {
    assert!(interpretTuff("let mut x = 0U8; x = ; x").is_err());
}

#[test]
fn validates_let_annotations() {
    assert!(interpretTuff("let x : U8 = 300U8; x").is_err());
}

#[test]
fn rejects_unknown_variables() {
    assert!(interpretTuff("x").is_err());
}

#[test]
fn respects_operator_precedence() {
    assert_eq!(interpretTuff("1U8 + 2U8 * 3U8"), Ok(7));
}

#[test]
fn respects_parentheses() {
    assert_eq!(interpretTuff("(1U8 + 2U8) * 3U8"), Ok(9));
}

#[test]
fn supports_unary_minus() {
    assert_eq!(interpretTuff("-1I8 + 2I8"), Ok(1));
}

#[test]
fn supports_subtraction_and_division() {
    assert_eq!(interpretTuff("8U8 - 3U8 / 2U8"), Ok(7));
}

#[test]
fn trims_whitespace_before_parsing() {
    assert_eq!(interpretTuff("  100U8  "), Ok(100));
}

#[test]
fn rejects_invalid_input() {
    assert!(interpretTuff("abc").is_err());
}

#[test]
fn rejects_lowercase_suffix() {
    assert!(interpretTuff("100u8").is_err());
}

#[test]
fn rejects_out_of_range_u8() {
    assert!(interpretTuff("256U8").is_err());
}

#[test]
fn rejects_division_by_zero() {
    assert!(interpretTuff("1U8 / 0U8").is_err());
}

#[test]
fn rejects_malformed_expression() {
    assert!(interpretTuff("1U8 +").is_err());
}

#[test]
fn rejects_trailing_semicolon() {
    assert!(interpretTuff("let x = 1U8; x;").is_err());
}

#[test]
fn rejects_arithmetic_overflow() {
    let input = format!("{} + 1", i128::MAX);
    assert!(interpretTuff(&input).is_err());
}
