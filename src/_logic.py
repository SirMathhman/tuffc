"""Logical operator helpers (&& and ||) for the interpreter.

This module provides evaluate_logical(s, env) which performs short-circuit
evaluation of top-level boolean expressions using && and ||. It returns
"true" or "false" when the expression is a pure logical chain, otherwise
returns None.
"""




def evaluate_logical(s: str, env: dict) -> str | None:
    # AND has higher precedence than OR; evaluate AND chains first.
    if "&&" in s:
        parts = [p.strip() for p in s.split("&&")]
        if len(parts) >= 2:
            from .interpret import interpret
            for i, part_expr in enumerate(parts):
                val = interpret(part_expr, env)
                if val == "false":
                    return "false"
                if i == len(parts) - 1:
                    return "true"

    if "||" in s:
        parts = [p.strip() for p in s.split("||")]
        if len(parts) >= 2:
            from .interpret import interpret
            for i, part_expr in enumerate(parts):
                val = interpret(part_expr, env)
                if val == "true":
                    return "true"
                if i == len(parts) - 1:
                    return "false"

    return None
