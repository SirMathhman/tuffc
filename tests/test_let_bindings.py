import os
import sys

# ensure project root is on sys.path for test discovery
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from tuffc.interpreter import interpret


def test_let_binding_simple():
    assert interpret("let x : I32 = 100; x") == "100"


def test_assign_from_typed_literal():
    assert interpret("let x : I32 = 1U32; x") == "1"


def test_chained_lets_plain_identifier_result():
    assert interpret("let x : I32 = 1; let y : I32 = x + 2; y") == "3"


def test_final_expression_returns_typed_result_when_not_identifier():
    assert interpret("let x : I32 = 1; x + 2") == "3I32"


def test_invalid_let_returns_input():
    # missing ':' should return input unchanged
    inp = "let x I32 = 1; x"
    assert interpret(inp) == inp
