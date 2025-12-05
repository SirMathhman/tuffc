import re

from .evaluator import evaluate_expression, EvalError
from .typed_int import SUFFIX_MAP, TypedInt


_SUFFIX_RE = re.compile(r"^([+-]?\d+)(?:U8|U16|U32|U64|I8|I16|I32|I64)$")
_ANY_SUFFIX_RE = re.compile(r"([+-]?\d+)(?:U8|U16|U32|U64|I8|I16|I32|I64)\b")
_LET_RE = re.compile(r"^let\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(U8|U16|U32|U64|I8|I16|I32|I64)\s*=\s*(.+)$")


def interpret(s: str) -> str:
    """Return the input string unchanged except strip case-sensitive integer
    type suffixes.

    Behavior:
    - Trims surrounding whitespace then checks for a whole-string match of a
      signed/unsigned integer followed immediately by one of the case-sensitive
      suffixes: U8, U16, U32, U64, I8, I16, I32, I64.
    - If matched, returns just the numeric portion (preserving leading sign).
    - Otherwise returns the original input unchanged.

    Examples:
        interpret("100U8") -> "100"
        interpret("  -42I32 ") -> "-42"
        interpret("100u8") -> "100u8"  # not stripped (case-sensitive)
    """
    if not isinstance(s, str):
        return s

    ts = s.strip()
    m = _SUFFIX_RE.match(ts)
    if m:
        return m.group(1)
    # If the input contains semicolon-separated statements, support simple
    # let-bindings: `let name : Type = expr; ... ; final_expr`.
    if ";" in ts or ts.strip().startswith("let "):
        parts = [p.strip() for p in ts.split(";")]
        # drop trailing empty parts
        parts = [p for p in parts if p != ""]

        if len(parts) >= 1 and any(p.startswith("let ") for p in parts[:-1]):
            env = {}
            # process all but final as let statements
            for stmt in parts[:-1]:
                m = _LET_RE.match(stmt)
                if not m:
                    return s
                name = m.group(1)
                suffix = m.group(2)
                rhs = m.group(3).strip()
                try:
                    val = evaluate_expression(rhs, env=env)
                except Exception:
                    return s

                bits, signed = SUFFIX_MAP[suffix]
                if isinstance(val, TypedInt):
                    # choose the view based on declared type
                    view = val.signed_value() if signed else val.unsigned_value()
                    bound = TypedInt.from_value(view, bits, signed)
                elif isinstance(val, int):
                    bound = TypedInt.from_value(val, bits, signed)
                else:
                    return s

                env[name] = bound

            # evaluate final expression with env
            final = parts[-1]
            try:
                result = evaluate_expression(final, env=env)
            except Exception:
                return s

            if isinstance(result, TypedInt):
                # if final is a single identifier, return plain numeric string
                if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", final):
                    return str(result.signed_value() if result.signed else result.unsigned_value())
                return result.format_with_suffix()

            if isinstance(result, int):
                return str(result)

            return s

    # If the input contains suffixed typed integer tokens anywhere inside the
    # expression, try to evaluate the expression with typed-integer semantics.
    if _ANY_SUFFIX_RE.search(ts):
        try:
            val = evaluate_expression(ts)
        except (EvalError, Exception):
            # On parse/eval errors return original input unchanged
            return s

        # If the evaluator returned a TypedInt, format it with its suffix.
        if isinstance(val, TypedInt):
            return val.format_with_suffix()

        # Plain ints are returned as decimal string
        if isinstance(val, int):
            return str(val)

    return s
