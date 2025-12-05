import os
import sys

# ensure project root is on sys.path for test discovery
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from tuffc.interpreter import interpret


def test_interpret_returns_input():
    assert interpret("hello") == "hello"


def test_interpret_returns_numeric_string():
    assert interpret("100") == "100"
