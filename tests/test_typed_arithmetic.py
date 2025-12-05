import os
import sys

# ensure project root is on sys.path for test discovery
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from tuffc.interpreter import interpret


def test_u32_addition_simple():
    assert interpret("1U32 + 2U32") == "3U32"


def test_u8_wraps_on_overflow():
    assert interpret("255U8 + 1U8") == "0U8"


def test_i8_signed_wraps():
    assert interpret("127I8 + 1I8") == "-128I8"


def test_mixed_promote_to_wider_unsigned():
    assert interpret("255U8 + 1U16") == "256U16"


def test_mixed_signed_unsigned_same_width():
    assert interpret("1I16 + 65535U16") == "0U16"


def test_legacy_whole_string_suffix_behavior_preserved():
    assert interpret("  -42I32 ") == "-42"
    assert interpret("100u8") == "100u8"
