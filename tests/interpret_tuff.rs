use tuffc::interpretTuff;

#[test]
fn empty_input_returns_zero() {
    assert_eq!(interpretTuff(""), 0);
}

#[test]
fn numeric_prefix_ignores_suffix() {
    assert_eq!(interpretTuff("100U8"), 100);
}

#[test]
fn non_numeric_input_returns_zero() {
    assert_eq!(interpretTuff("U8"), 0);
}
