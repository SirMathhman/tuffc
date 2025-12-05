import pytest
import csv
from echo import interpret


def load_positive_tests():
    """Load positive test cases from CSV"""
    tests = []
    with open("positive_tests.csv", "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            tests.append((row["input"], row["expected_output"]))
    return tests


def load_negative_tests():
    """Load negative test cases from CSV"""
    tests = []
    with open("negative_tests.csv", "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            tests.append((row["input"], row["expected_not_output"]))
    return tests


@pytest.mark.parametrize("input_str,expected", load_positive_tests())
def test_echo_positive(input_str, expected):
    """Test that echo returns the expected output (positive tests)"""
    assert interpret(input_str) == expected


@pytest.mark.parametrize("input_str,expected_not", load_negative_tests())
def test_echo_negative(input_str, expected_not):
    """Test that echo does not return unexpected output (negative tests)"""
    assert interpret(input_str) != expected_not
