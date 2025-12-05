import re


class ReturnSignal(Exception):
    def __init__(self, value: str):
        super().__init__("return")
        self.value = value


def register_function_from_part(part: str, env: dict) -> str:
    """Parse a function declaration from a part and register it in env.

    Returns the trailing remainder after the function declaration (may be
    empty string). Raises ValueError for invalid declarations.
    """
    m_start = re.match(r"^\s*fn\s+([A-Za-z_]\w*)\s*\(", part)
    if not m_start:
        raise ValueError("invalid function declaration")
    fname = m_start.group(1)
    open_idx = part.find("(", m_start.end() - 1)
    depth = 0
    j = open_idx
    in_string = False
    while j < len(part):
        ch = part[j]
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
    if j >= len(part) or part[j] != ")":
        raise ValueError("invalid function declaration (unmatched paren)")

    params_body = part[open_idx + 1 : j].strip()
    params = []
    if params_body:
        for p in [q.strip() for q in params_body.split(",")]:
            pm = re.match(r"([A-Za-z_]\w*)\s*:\s*([A-Za-z_]\w*)", p)
            if not pm:
                raise ValueError("invalid function parameter")
            pname = pm.group(1)
            ptype = pm.group(2)
            params.append((pname, ptype))

    rest = part[j + 1 :].lstrip()
    m_ret = re.match(r"^:\s*([A-Za-z_]\w*)\b", rest)
    ret_spec = None
    if m_ret:
        ret_spec = m_ret.group(1)
        rest = rest[m_ret.end() :].lstrip()

    if not rest.startswith("=>"):
        raise ValueError("invalid function declaration (missing =>)")
    rest = rest[2:].lstrip()

    if rest.startswith("{"):
        b_open = part.find("{", part.find("=>"))
        depth = 0
        j2 = b_open
        in_string = False
        while j2 < len(part):
            ch = part[j2]
            if ch == '"':
                in_string = not in_string
            elif not in_string:
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        break
            j2 += 1
        if j2 >= len(part) or part[j2] != "}":
            raise ValueError("invalid function declaration (unmatched brace)")

        body = part[b_open + 1 : j2].strip()
        rest2 = part[j2 + 1 :].strip()
    else:
        body = rest
        rest2 = ""

    fentry = ("fn", params, ret_spec, body)
    if fname in env:
        raise ValueError(f"function '{fname}' already defined")
    env[fname] = fentry

    return rest2


def try_handle_top_level_fn(s: str, env: dict) -> str | None:
    """If s begins with a top-level function declaration, register it and
    return the trailing remainder (possibly empty). Otherwise return None.
    """
    stripped = s.lstrip()
    if not stripped.startswith("fn"):
        return None
    rest = register_function_from_part(s, env)
    return rest


def try_evaluate_function_call(s: str, open_idx: int, close_idx: int, env: dict):
    """If the parentheses at open_idx/close_idx represent a function call
    (identifier immediately preceding '(' and env contains a function
    binding), evaluate the call and return (id_start, ret_val). Otherwise
    return None.
    """
    # find name before '(' skipping whitespace
    name_start = open_idx - 1
    while name_start >= 0 and s[name_start].isspace():
        name_start -= 1
    if name_start < 0 or not re.match(r"[A-Za-z0-9_]", s[name_start]):
        return None
    id_start = name_start
    while id_start >= 0 and re.match(r"[A-Za-z_0-9]", s[id_start]):
        id_start -= 1
    id_start += 1
    candidate = s[id_start : name_start + 1]
    if candidate not in env:
        return None
    binding = env[candidate]
    if not (isinstance(binding, tuple) and len(binding) == 4 and binding[0] == "fn"):
        return None

    inner = s[open_idx + 1 : close_idx]
    # split args at top-level commas
    args = []
    cur = []
    depth = 0
    in_string = False
    k = 0
    while k < len(inner):
        ch = inner[k]
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
            elif ch == "," and depth == 0:
                args.append("".join(cur).strip())
                cur = []
            else:
                cur.append(ch)
        else:
            cur.append(ch)
        k += 1
    last_arg = "".join(cur).strip()
    if last_arg:
        args.append(last_arg)

    # build child env and evaluate body
    _, params, _ret, body = binding
    if len(args) != len(params):
        raise ValueError("function call argument count mismatch")

    child_env = {}
    if "__types__" in env:
        child_env["__types__"] = env["__types__"].copy()

    from .interpret import interpret

    for (pname, ptype), aexpr in zip(params, args):
        aval_str = interpret(aexpr, env)
        try:
            aval = int(aval_str, 10)
        except ValueError:
            raise ValueError("invalid function argument value")
        pkind = ptype[0].lower()
        pbits = int(ptype[1:]) if len(ptype) > 1 else None
        child_env[pname] = (aval, pkind, pbits, False)

    from ._statements import evaluate_statement_parts

    try:
        parts = [body] if body is not None else []
        ret_val = evaluate_statement_parts(parts, child_env)
    except ReturnSignal as rs:
        ret_val = rs.value

    return (id_start, ret_val)
