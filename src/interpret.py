import re

from ._arithmetic import evaluate_arithmetic, _LEADING_NUMBER
from . import _pointers, _logic
from ._functions import (
    try_handle_top_level_fn,
    try_handle_top_level_impl,
    try_evaluate_function_call,
    try_evaluate_method_call,
)


def interpret(s: str, env: dict | None = None) -> str:
    """Return the input string, stripping any trailing type-suffix when present.

    Examples:
    - "100" -> "100"
    - "100U8" -> "100"
    - "3.14F32" -> "3.14"

    The function keeps the numeric prefix (int/float with optional exponent)
    and returns it when present, otherwise returns the original string.
    """
    if not isinstance(s, str):
        raise TypeError("interpret expects a string")

    env = {} if env is None else env

    # If input contains multiple statements separated by ';', evaluate them
    # sequentially and return the value of the last statement.
    # Only treat s as multiple statements when there are top-level
    # semicolons (not ones enclosed in parentheses/braces or strings).
    parts = None
    if ";" in s:
        parts = []
        cur = []
        depth = 0
        in_string = False
        i = 0
        had_top_level = False
        while i < len(s):
            ch = s[i]
            if ch == '"':
                in_string = not in_string
                cur.append(ch)
            elif not in_string:
                if ch in "({":
                    depth += 1
                    cur.append(ch)
                elif ch in ")}":
                    depth -= 1
                    cur.append(ch)
                elif ch == ";" and depth == 0:
                    had_top_level = True
                    part = "".join(cur).strip()
                    if part:
                        parts.append(part)
                    cur = []
                else:
                    cur.append(ch)
            else:
                cur.append(ch)
            i += 1

        last_part = "".join(cur).strip()
        if last_part:
            parts.append(last_part)

        if not had_top_level:
            parts = None

    if parts is not None:
        from ._statements import evaluate_statement_parts

        return evaluate_statement_parts(parts, env)

    # Provide a `typeOf(expr)` convenience when the entire input is a
    # typeOf(...) invocation. This must be handled before the generic
    # parentheses evaluation (which would otherwise strip the parens).
    m_typeof = re.match(r"^\s*typeOf\s*\((.*)\)\s*$", s)
    if m_typeof:
        inner = m_typeof.group(1).strip()

        # If it's a simple identifier, look up its declared type.
        if re.match(r"^[A-Za-z_]\w*$", inner):
            if inner in env:
                kind, bits = env[inner][1], env[inner][2]
                if kind is None:
                    # untyped variable defaults to I32 for integers
                    val = env[inner][0]
                    if isinstance(val, int):
                        return "I32"
                    return "F64"
                return kind.upper() + str(bits)
            # unknown identifier — treat as I32 by default
            return "I32"

        # If it's a numeric literal or expression, attempt to detect an
        # explicit suffix like U8/I32/F32 in the text. Prefer explicit
        # suffix when present.
        # find U/I/F suffix matches (e.g. 2U8, 3.14F32)
        explicit = re.findall(r"(?i)([uif])(\d+)\b", inner)
        if explicit:
            k, b = explicit[0]
            return k.upper() + str(int(b))

        # otherwise if it's a plain integer literal return I32, float -> F64
        mnum = _LEADING_NUMBER.match(inner)
        if mnum:
            num = mnum.group(0)
            if any(ch in num for ch in ".eE"):
                return "F64"
            return "I32"

        # fallback
        return "I32"

    # Support simple if-then-else expressions at top-level like
    # `if (cond) then_expr else else_expr`. We parse the condition in
    # parentheses and locate a top-level `else` to split the branches.
    stripped = s.lstrip()
    if stripped.startswith("if"):
        # find the opening paren for the condition
        i = s.find("if") + 2
        while i < len(s) and s[i].isspace():
            i += 1
        if i >= len(s) or s[i] != "(":
            raise ValueError("invalid if expression")

        # find matching ')' for the condition
        j = i
        depth = 0
        in_string = False
        while j < len(s):
            ch = s[j]
            if ch == '"':
                in_string = not in_string
            elif not in_string:
                if ch == "(":
                    depth += 1
                elif ch == ")":
                    depth -= 1
                    if depth == 0:
                        break
            j += 1

        if j >= len(s) or s[j] != ")":
            raise ValueError("unmatched parentheses in if condition")

        cond = s[i + 1 : j].strip()
        # find top-level 'else' after j
        k = j + 1
        depth = 0
        in_string = False
        else_pos = -1
        while k < len(s):
            ch = s[k]
            if ch == '"':
                in_string = not in_string
            elif not in_string:
                if ch in "{(":
                    depth += 1
                elif ch in "})":
                    if depth > 0:
                        depth -= 1
                elif s.startswith("else", k) and depth == 0:
                    # ensure 'else' is a standalone token
                    before = s[k - 1] if k - 1 >= 0 else " "
                    after = s[k + 4] if k + 4 < len(s) else " "
                    if before.isspace() and after.isspace():
                        else_pos = k
                        break
            k += 1

        if else_pos == -1:
            raise ValueError("if expression missing else branch")

        then_expr = s[j + 1 : else_pos].strip()
        else_expr = s[else_pos + 4 :].strip()

        cond_val = interpret(cond, env)
        # truthiness: explicit 'true'/'false' or numeric (non-zero true)
        if cond_val == "true":
            chosen = then_expr
        elif cond_val == "false":
            chosen = else_expr
        else:
            try:
                chosen = then_expr if int(cond_val, 10) != 0 else else_expr
            except Exception:
                chosen = else_expr

        return interpret(chosen, env)

    rest_fn = try_handle_top_level_fn(s, env)
    if rest_fn is None:
        rest_fn = try_handle_top_level_impl(s, env)
    if rest_fn is not None:
        if rest_fn:
            return interpret(rest_fn, env)
        return ""

    # Evaluate innermost parenthesized expressions first, replacing them
    # with their evaluated result. This allows "(1 + 10) * 2U8" to become
    # "11 * 2U8" which the rest of the parser handles.
    # Support curly-brace grouping `{ ... }` same as parentheses.
    braced_occurred = False
    while "{" in s:
        open_idx = s.rfind("{")
        close_idx = s.find("}", open_idx)
        if close_idx == -1:
            raise ValueError("unmatched brace")

        inner = s[open_idx + 1 : close_idx]
        # Evaluate block contents in a local copy of the environment so
        # variables declared inside a `{ ... }` block do not leak out.
        # However, assignments to variables that already exist in the
        # outer environment should affect the outer environment when the
        # variable is assignable (e.g. `let mut x = 0; { x = 10; }`). To
        # accomplish this propagate any changes for variables that were
        # present in the outer env after evaluating the block.
        child_env = env.copy()
        val = interpret(inner, child_env)
        # Propagate any modifications to variables that existed in the
        # parent environment. New variables declared inside the block
        # remain local to the child_env and are not copied out.
        for nm, child_binding in child_env.items():
            if nm in env and child_binding != env[nm]:
                env[nm] = child_binding
        braced_occurred = True
        s = s[:open_idx] + val + s[close_idx + 1 :]

    while "(" in s:
        open_idx = s.rfind("(")
        close_idx = s.find(")", open_idx)
        if close_idx == -1:
            raise ValueError("unmatched parentheses")

        inner = s[open_idx + 1 : close_idx]

        # check for method-style call first: obj.method(args)
        fn_call = try_evaluate_method_call(s, open_idx, close_idx, env)
        if fn_call:
            id_start, ret_val = fn_call
            s = s[:id_start] + ret_val + s[close_idx + 1 :]
        else:
            fn_call = try_evaluate_function_call(s, open_idx, close_idx, env)
            if fn_call:
                id_start, ret_val = fn_call
                s = s[:id_start] + ret_val + s[close_idx + 1 :]
            else:
                val = interpret(inner, env)
                s = s[:open_idx] + val + s[close_idx + 1 :]

    # Support simple dereference expressions where the entire input is a
    # prefix '*' followed by an identifier (e.g. `*y`). This is intentionally
    # limited — parsing unary '*' in the middle of arithmetic expressions
    # would require a proper tokenizer. For our current tests this is
    # sufficient.
    m_deref = re.match(r"^\s*\*\s*([A-Za-z_]\w*)\s*$", s)
    if m_deref:
        name = m_deref.group(1)
        return _pointers.try_deref_simple(name, env)

    # Delegate logical operator handling to helper module (supports &&, ||).
    logical_result = _logic.evaluate_logical(s, env)
    if logical_result is not None:
        return logical_result

    # Support simple comparison operators at top level: ==, !=, <=, >=, <, >
    mcmp = re.match(r"^\s*(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)\s*$", s)
    if mcmp:
        left = mcmp.group(1).strip()
        op = mcmp.group(2)
        right = mcmp.group(3).strip()
        lv = interpret(left, env)
        rv = interpret(right, env)
        # Try numeric comparison first
        try:
            ln = int(lv, 10)
            rn = int(rv, 10)
            if op == "==":
                return "true" if ln == rn else "false"
            if op == "!=":
                return "true" if ln != rn else "false"
            if op == "<":
                return "true" if ln < rn else "false"
            if op == ">":
                return "true" if ln > rn else "false"
            if op == "<=":
                return "true" if ln <= rn else "false"
            if op == ">=":
                return "true" if ln >= rn else "false"
        except ValueError:
            # fallback to string comparison
            if op == "==":
                return "true" if lv == rv else "false"
            if op == "!=":
                return "true" if lv != rv else "false"
            return "false"

    # substitute variables from env into the expression
    # Resolve struct field access like `obj.field` first, replacing with
    # the underlying numeric value when possible.
    def _replace_field(m: re.Match) -> str:
        obj_name = m.group(1)
        field_name = m.group(2)
        if obj_name in env:
            val = env[obj_name][0]
            if isinstance(val, dict):
                if field_name in val:
                    return str(val[field_name])
                raise ValueError(f"struct '{obj_name}' has no field '{field_name}'")
        return m.group(0)

    s = re.sub(r"\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)\b", _replace_field, s)
    if env:
        # replace longest names first to avoid partial matches
        for name in sorted(env.keys(), key=len, reverse=True):
            # skip internal helpers like '__types__' which aren't variable bindings
            binding = env.get(name)
            if not isinstance(binding, tuple) or len(binding) != 4:
                continue
            s = re.sub(r"\b" + re.escape(name) + r"\b", str(binding[0]), s)

    # if the whole string is an identifier, return its value
    ident_full = re.match(r"^[A-Za-z_]\w*$", s.strip())
    if ident_full:
        name = ident_full.group(0)
        if name in env:
            return str(env[name][0])
        # If the input had a braced block that was evaluated separately,
        # an identifier that wasn't declared in the outer environment
        # should be considered an error rather than left as-is.
        if braced_occurred:
            raise ValueError(f"use of undeclared variable '{name}'")

    m = _LEADING_NUMBER.match(s)
    if not m:
        return s

    prefix = m.group(0)
    suffix = s[len(prefix) :]

    # Try to evaluate as arithmetic expression (+, -, *)
    arith_result = evaluate_arithmetic(s, env)
    if arith_result is not None:
        return arith_result

    # Negative numbers with an unsigned suffix (e.g. "-100U8") are invalid.
    if suffix and suffix[0].lower() == "u" and prefix.startswith("-"):
        raise ValueError("negative unsigned literal not allowed")

    # If suffix indicates an integer width (e.g. U8 or I16), validate range.
    # Only validate integer numeric prefixes (no '.' or exponent).
    if suffix and suffix[0].lower() in ("u", "i"):
        m_bits = re.match(r"^[ui](\d+)", suffix, re.IGNORECASE)
        if m_bits:
            # ensure prefix is an integer literal
            if any(ch in prefix for ch in ".eE"):
                raise ValueError("integer-suffixed literal must be integer")

            bits = int(m_bits.group(1))
            if bits <= 0:
                raise ValueError("invalid integer width")

            try:
                val = int(prefix, 10)
            except ValueError:
                raise ValueError("invalid integer literal")

            if suffix[0].lower() == "u":
                max_val = (1 << bits) - 1
                if val < 0 or val > max_val:
                    raise ValueError("unsigned literal out of range")
            else:
                # signed: range is -(2^(bits-1)) .. 2^(bits-1)-1
                max_pos = (1 << (bits - 1)) - 1
                min_neg = -(1 << (bits - 1))
                if val < min_neg or val > max_pos:
                    raise ValueError("signed literal out of range")

    return prefix
