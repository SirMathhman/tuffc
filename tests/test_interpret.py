import sys
from pathlib import Path

# Ensure project root is on sys.path so `src` package is importable during tests
sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.interpret import interpret


def test_interpret_returns_same_string():
    assert interpret("100") == "100"


def test_interpret_strips_u8_suffix():
    assert interpret("100U8") == "100"


def test_interpret_keeps_float_prefix():
    assert interpret("3.14F32") == "3.14"


def test_zero_float_f32():
    assert interpret("0.0F32") == "0.0"


def test_zero_float_f64():
    assert interpret("0.0F64") == "0.0"


def test_interpret_non_numeric_unchanged():
    assert interpret("abc") == "abc"


def test_negative_unsigned_raises():
    import pytest

    with pytest.raises(ValueError):
        interpret("-100U8")


def test_negative_unsigned_lowercase_raises():
    import pytest

    with pytest.raises(ValueError):
        interpret("-42u16")


def test_unsigned_overflow_raises():
    import pytest

    with pytest.raises(ValueError):
        interpret("256U8")


def test_unsigned_max_allowed():
    assert interpret("255U8") == "255"


def test_signed_i8_bounds():
    assert interpret("127I8") == "127"
    assert interpret("-128I8") == "-128"


def test_signed_i8_overflow_underflow():
    import pytest

    with pytest.raises(ValueError):
        interpret("128I8")

    with pytest.raises(ValueError):
        interpret("-129I8")


def test_signed_i16_boundaries():
    assert interpret("32767I16") == "32767"
    assert interpret("-32768I16") == "-32768"


def test_quoted_string_preserved():
    assert interpret('"test"') == '"test"'


def test_add_unsigned_u32():
    assert interpret("100U32 + 200U32") == "300"


def test_add_unsigned_u32_overflow():
    import pytest

    # 2^32 - 1 is max for U32
    with pytest.raises(ValueError):
        interpret("4294967295U32 + 1U32")


def test_mixed_signedness_addition_raises():
    import pytest

    with pytest.raises(ValueError):
        interpret("1U8 + 2I8")


def test_mixed_width_addition_raises():
    import pytest

    with pytest.raises(ValueError):
        interpret("1U8 + 2U16")


def test_plain_plus_u8():
    assert interpret("1 + 2U8") == "3"
    assert interpret("1U8 + 2") == "3"


def test_plain_plus_u32_overflow():
    import pytest

    # adding a plain integer to a max-U32 should still obey U32 range
    with pytest.raises(ValueError):
        interpret("4294967295 + 1U32")


def test_plain_integer_addition():
    assert interpret("1 + 2") == "3"


def test_chain_addition_mixed_suffixes():
    assert interpret("10U8 + 2 + 8U8") == "20"


def test_long_plain_chain_addition():
    assert interpret("1 + 2 + 3 + 4") == "10"


def test_subtraction_and_mixed_ops():
    assert interpret("10U8 - 5U8 + 3") == "8"


def test_subtraction_underflow_unsigned_raises():
    import pytest

    with pytest.raises(ValueError):
        interpret("0U8 - 1U8")


def test_multiplication_and_addition():
    assert interpret("10 * 2U8 + 1") == "21"


def test_multiplication_overflow_raises():
    import pytest

    with pytest.raises(ValueError):
        interpret("128U8 * 2U8")


def test_multiplication_precedence_with_leading_add():
    assert interpret("1 + 10 * 2U8") == "21"


def test_parentheses_wrap_expression():
    assert interpret("(1 + 10 * 2U8)") == "21"


def test_parentheses_in_expression():
    assert interpret("(1 + 10) * 2U8") == "22"


def test_multiple_parenthesized_subexpressions():
    assert interpret("(1 + 10) * (2U8 + 3)") == "55"


def test_variable_declaration_and_lookup():
    expr = "let x : U8 = (1 + 10) * (2U8 + 3); x"
    assert interpret(expr) == "55"


def test_typed_initializer_plain_integer_assigns_and_lookup():
    assert interpret("let x : U8 = 100; x") == "100"


def test_typeof_on_typed_variable_returns_declared():
    assert interpret("let x : U8 = 100; typeOf(x)") == "U8"


def test_typeof_on_untyped_variable_defaults_to_i32():
    assert interpret("let x = 100; typeOf(x)") == "I32"


def test_mutable_declaration_allows_reassignment():
    assert interpret("let mut x = 0; x = 100; x") == "100"


def test_immutable_declaration_reassignment_raises():
    import pytest

    with pytest.raises(ValueError):
        interpret("let x = 0; x = 100;")


def test_braces_evaluate_inner_expression():
    assert interpret("{100}") == "100"


def test_typed_initializer_from_incompatible_typed_variable_raises():
    import pytest

    with pytest.raises(ValueError):
        interpret("let x : U8 = 100; let y : I32 = x;")


def test_typed_initializer_mismatched_signedness_raises():
    import pytest

    with pytest.raises(ValueError):
        interpret("let x : I32 = (1 + 10) * (2U8 + 3); x")


def test_let_trailing_returns_empty():
    assert interpret("let x : U8 = 100;") == ""


def test_let_without_type_and_lookup():
    assert interpret("let x = 100; x") == "100"


def test_let_assign_from_variable():
    assert interpret("let x = 100; let y = x; y") == "100"


def test_let_without_type_trailing_returns_empty():
    assert interpret("let x = 100;") == ""


def test_redeclaration_raises():
    import pytest

    with pytest.raises(ValueError):
        interpret("let x = 100; let x = 100;")


def test_declare_uninitialized_then_assign():
    assert interpret("let x : I32; x = 100; x") == "100"


def test_typed_declaration_trailing_returns_empty():
    assert interpret("let x : I32;") == ""


def test_typeof_plain_integer_defaults_to_i32():
    assert interpret("typeOf(100)") == "I32"


def test_typeof_with_suffix_returns_explicit():
    assert interpret("typeOf(100U8)") == "U8"


def test_typeof_expression_with_explicit_suffix_returns_explicit():
    assert interpret("typeOf((1 + 10) * (2U8 + 3))") == "U8"


def test_typeof_expression_with_i64_returns_i64():
    assert interpret("typeOf((1 + 10) * (2I64 + 3))") == "I64"
