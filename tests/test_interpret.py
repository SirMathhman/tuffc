import os
import sys

# ensure project root is on sys.path for test discovery
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from tuffc.interpreter import interpret


def test_interpret_returns_input():
    assert interpret("hello") == "hello"


def test_interpret_returns_numeric_string():
    assert interpret("100") == "100"


def test_interpret_strips_case_sensitive_suffixes():
    # positive — exact-case suffixes are stripped
    assert interpret("100U8") == "100"
    assert interpret("+0U64") == "+0"
    assert interpret("  -42I32 ") == "-42"


def test_interpret_keeps_non_matching_suffixes():
    # lower-case suffix should not be stripped (case-sensitive)
    assert interpret("100u8") == "100u8"
    # malformed or unknown suffixes remain unchanged
    assert interpret("100U") == "100U"
    assert interpret("100U128") == "100U128"
    assert interpret("100U8abc") == "100U8abc"
    assert interpret("abc100U8") == "abc100U8"
