from __future__ import annotations

import ast
import re
from typing import Any, Dict

from .typed_int import TypedInt, SUFFIX_MAP


# Regex to find suffixed integer literals inside expressions (case-sensitive)
_TOKEN_RE = re.compile(r"([+-]?\d+)(U8|U16|U32|U64|I8|I16|I32|I64)\b")


class EvalError(Exception):
    pass


def _make_typed_tokens(expr: str) -> (str, Dict[str, TypedInt]):
    tokens: Dict[str, TypedInt] = {}
    counter = 0

    def repl(m: re.Match) -> str:
        nonlocal counter
        literal = int(m.group(1))
        suffix = m.group(2)
        ti = TypedInt.from_suffix_literal(literal, suffix)
        key = f"__ti{counter}"
        counter += 1
        tokens[key] = ti
        return key

    new_expr = _TOKEN_RE.sub(repl, expr)
    return new_expr, tokens


class _Evaluator(ast.NodeVisitor):
    def __init__(self, env: Dict[str, TypedInt]):
        self.env = env

    def visit_Expression(self, node: ast.Expression) -> Any:
        return self.visit(node.body)

    def visit_Constant(self, node: ast.Constant) -> Any:
        if isinstance(node.value, int):
            return node.value
        raise EvalError("Unsupported literal type")

    # for Python <3.8 compatibility
    def visit_Num(self, node: ast.Num) -> Any:
        return node.n

    def visit_Name(self, node: ast.Name) -> Any:
        if node.id in self.env:
            return self.env[node.id]
        raise EvalError(f"unknown name {node.id}")

    def visit_BinOp(self, node: ast.BinOp) -> Any:
        left = self.visit(node.left)
        right = self.visit(node.right)

        # Coerce mixing of int and TypedInt
        if isinstance(left, TypedInt) and isinstance(right, TypedInt):
            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            if isinstance(node.op, ast.FloorDiv) or isinstance(node.op, ast.Div):
                return left.__floordiv__(right)
            if isinstance(node.op, ast.Mod):
                # mod: use unsigned raw values then wrap
                bits = max(left.bits, right.bits)
                signed = left.signed if left.signed == right.signed else False
                a = TypedInt.from_value(left.unsigned_value(), bits, signed)
                b = TypedInt.from_value(right.unsigned_value(), bits, signed)
                res_raw = a.raw % b.raw
                return TypedInt(bits, signed, res_raw)
        elif isinstance(left, TypedInt) and isinstance(right, int):
            # coerce plain int to left's type
            right_t = TypedInt.from_value(right, left.bits, left.signed)
            return (
                self.visit_BinOp(
                    ast.BinOp(left=node.left, op=node.op, right=ast.Constant(value=0))
                )
                if False
                else (
                    (left + right_t)
                    if isinstance(node.op, ast.Add)
                    else (
                        (left - right_t)
                        if isinstance(node.op, ast.Sub)
                        else (
                            (left * right_t)
                            if isinstance(node.op, ast.Mult)
                            else (
                                left.__floordiv__(right_t)
                                if isinstance(node.op, (ast.FloorDiv, ast.Div))
                                else (_ for _ in ()).throw(
                                    EvalError(
                                        "unsupported operator for typed-int and int"
                                    )
                                )
                            )
                        )
                    )
                )
            )
        elif isinstance(left, int) and isinstance(right, TypedInt):
            left_t = TypedInt.from_value(left, right.bits, right.signed)
            return (
                self.visit_BinOp(
                    ast.BinOp(left=ast.Constant(value=0), op=node.op, right=node.right)
                )
                if False
                else (
                    (left_t + right)
                    if isinstance(node.op, ast.Add)
                    else (
                        (left_t - right)
                        if isinstance(node.op, ast.Sub)
                        else (
                            (left_t * right)
                            if isinstance(node.op, ast.Mult)
                            else (
                                left_t.__floordiv__(right)
                                if isinstance(node.op, (ast.FloorDiv, ast.Div))
                                else (_ for _ in ()).throw(
                                    EvalError(
                                        "unsupported operator for int and typed-int"
                                    )
                                )
                            )
                        )
                    )
                )
            )
        elif isinstance(left, int) and isinstance(right, int):
            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            if isinstance(node.op, ast.FloorDiv) or isinstance(node.op, ast.Div):
                if right == 0:
                    raise ZeroDivisionError("integer division by zero")
                return left // right
            if isinstance(node.op, ast.Mod):
                return left % right

        raise EvalError("unsupported binary operation")

    def visit_UnaryOp(self, node: ast.UnaryOp) -> Any:
        operand = self.visit(node.operand)
        if isinstance(node.op, ast.UAdd):
            return operand
        if isinstance(node.op, ast.USub):
            if isinstance(operand, TypedInt):
                # unary negation: wrap in same type
                return TypedInt.from_value(
                    (
                        -operand.signed_value()
                        if operand.signed
                        else -operand.unsigned_value()
                    ),
                    operand.bits,
                    operand.signed,
                )
            if isinstance(operand, int):
                return -operand
        raise EvalError("unsupported unary operation")

    def generic_visit(self, node):
        raise EvalError(f"unsupported node: {type(node).__name__}")


def evaluate_expression(expr: str, env: Dict[str, TypedInt] | None = None) -> Any:
    """Evaluate an arithmetic expression containing suffixed typed integer literals.

    Returns either a TypedInt or a plain int.
    """
    # replace suffixed tokens with temporary names and build token env
    token_expr, token_env = _make_typed_tokens(expr)
    # merge provided env (variable bindings) with token env; provided env should take precedence for names
    combined_env: Dict[str, TypedInt] = {}
    token_env = token_env or {}
    combined_env.update(token_env)
    if env:
        # ensure env values are TypedInt
        for k, v in env.items():
            if not isinstance(v, TypedInt):
                raise EvalError("env values must be TypedInt")
            combined_env[k] = v

    transformed = token_expr
    try:
        tree = ast.parse(transformed, mode="eval")
    except SyntaxError as e:
        raise EvalError("syntax error") from e

    evaluator = _Evaluator(combined_env)
    return evaluator.visit(tree)
