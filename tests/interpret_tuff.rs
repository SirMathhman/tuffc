use tuffc::interpretTuff;

#[test]
fn empty_input_returns_zero() {
    assert_eq!(interpretTuff(""), 0);
}
