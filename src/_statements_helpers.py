# Helper functions for statement evaluation
import re
from ._functions import ReturnSignal


def evaluate_return_statement(part: str, env: dict, interpret_fn):
    """Handle return statement. Returns the value to return via ReturnSignal."""
    m_ret = re.match(r"^\s*return\s*(.*)$", part, re.DOTALL)
    if not m_ret:
        raise ValueError("invalid return statement")
    expr = m_ret.group(1).strip()
    if not expr:
        raise ReturnSignal("")
    val = interpret_fn(expr, env)
    raise ReturnSignal(val)


def evaluate_impl_block(part: str, env: dict):
    """Handle impl block declaration. Returns None."""
    m_start = re.match(r"^\s*impl\s+([A-Za-z_]\w*)\s*\{", part)
    if not m_start:
        raise ValueError("invalid impl declaration")
    tname = m_start.group(1)
    open_idx = part.find("{", m_start.end() - 1)
    depth = 0
    j = open_idx
    in_string = False
    while j < len(part):
        ch = part[j]
        if ch == '"':
            in_string = not in_string
        elif not in_string:
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    break
        j += 1
    if j >= len(part) or part[j] != "}":
        raise ValueError("invalid impl declaration (unmatched brace)")

    body = part[open_idx + 1 : j].strip()
    # body may contain multiple function declarations separated by ';'
    from ._functions import register_method_from_part

    cur = []
    depth = 0
    in_string = False
    fragments = []
    k = 0
    while k < len(body):
        ch = body[k]
        if ch == '"':
            in_string = not in_string
            cur.append(ch)
        elif not in_string:
            if ch in "{(":
                depth += 1
                cur.append(ch)
            elif ch in "})":
                depth -= 1
                cur.append(ch)
            elif ch == ";" and depth == 0:
                frag = "".join(cur).strip()
                if frag:
                    fragments.append(frag)
                cur = []
            else:
                cur.append(ch)
        else:
            cur.append(ch)
        k += 1
    last_frag = "".join(cur).strip()
    if last_frag:
        fragments.append(last_frag)

    for frag in fragments:
        register_method_from_part(tname, frag, env)

    return None
