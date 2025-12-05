import sys
from pathlib import Path

# Ensure project root is on sys.path so `src` package is importable during tests
sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.interpret import interpret


def test_interpret_returns_same_string():
    assert interpret("100") == "100"
