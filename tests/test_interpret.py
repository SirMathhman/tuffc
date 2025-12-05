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


def test_interpret_non_numeric_unchanged():
    assert interpret("abc") == "abc"
