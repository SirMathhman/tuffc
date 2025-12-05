import sys
from pathlib import Path

# Ensure project root is on sys.path so `src` package is importable during tests
sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.interpret import interpret


def test_typed_declaration_with_mismatched_initializer_raises():
    import pytest

    with pytest.raises(ValueError):
        interpret("let x : I32 = 10U8;")
