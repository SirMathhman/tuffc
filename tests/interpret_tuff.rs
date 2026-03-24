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
