#!/usr/bin/env python3
from src._statements import evaluate_statement_parts

# Add debugging to understand the flow
parts = ["in let value : I32", "out let x = value"]
env = {"__mapping__": {}, "__exported__": set(), "__inputs__": {}}
env["value"] = (100, "i", 32, False)

print("Input parts:", parts)
print("Input env keys:", [k for k in env if not k.startswith("__")])
print()

# Call with debugging
import sys
from unittest.mock import patch

original_evaluate = evaluate_statement_parts


def debug_evaluate(parts_list, env_dict):
    print(f"evaluate_statement_parts called with {len(parts_list)} parts:")
    for idx, p in enumerate(parts_list):
        print(f"  [{idx}] {repr(p)}")
    print(f"  env has x: {'x' in env_dict}")
    result = original_evaluate(parts_list, env_dict)
    print(f"  result: {repr(result)}")
    print(f"  env has x after: {'x' in env_dict}")
    if "x" in env_dict:
        print(f"  x value: {env_dict['x']}")
    return result


# Patch and test
with patch("src._statements.evaluate_statement_parts", debug_evaluate):
    try:
        result = debug_evaluate(parts, env)
    except:
        import traceback

        traceback.print_exc()

print()
print("Final state:")
print("  x:", env.get("x"))
print("  exported:", env.get("__exported__", set()))
