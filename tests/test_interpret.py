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
