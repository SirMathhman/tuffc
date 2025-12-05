import re


class ReturnSignal(Exception):
    def __init__(self, value: str):
        super().__init__("return")
        self.value = value


def parse_function_from_part(part: str):
    """Parse a function declaration from a part and return a tuple
    (fname, params, ret_spec, body, rest2). Does not register into env.
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
            # allow parameter with optional type `name` or `name : Type`
            pm = re.match(r"([A-Za-z_]\w*)(?:\s*:\s*([A-Za-z_]\w*))?", p)
            if not pm:
                raise ValueError("invalid function parameter")
            pname = pm.group(1)
            ptype = pm.group(2) if pm.group(2) else None
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

    return (fname, params, ret_spec, body, rest2)


def register_function_from_part(part: str, env: dict) -> str:
    """Parse a function declaration from a part and register it in env.

    Returns the trailing remainder after the function declaration (may be
    empty string). Raises ValueError for invalid declarations.
    """
    fname, params, ret_spec, body, rest2 = parse_function_from_part(part)
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


def try_handle_top_level_module(s: str, env: dict) -> str | None:
    """If s begins with a top-level module declaration, register functions
    into env['__modules__'] and return the trailing remainder (possibly
    empty). Otherwise return None.
    """
    stripped = s.lstrip()
    if not stripped.startswith("module"):
        return None
    m_start = re.match(r"^\s*module\s+([A-Za-z_]\w*)\s*\{", s)
    if not m_start:
        raise ValueError("invalid module declaration")
    mod_name = m_start.group(1)
    open_idx = s.find("{", m_start.end() - 1)
    depth = 0
    j = open_idx
    in_string = False
    while j < len(s):
        ch = s[j]
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
    if j >= len(s) or s[j] != "}":
        raise ValueError("invalid module declaration (unmatched brace)")

    body = s[open_idx + 1 : j].strip()
    # split into semicolon-separated function fragments (top-level)
    fragments = []
    cur = []
    depth = 0
    in_string = False
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

    modules = env.get("__modules__", {})
    methods = modules.get(mod_name, {})
    for frag in fragments:
        fname, params, ret_spec, body_fn, _ = parse_function_from_part(frag)
        methods[fname] = ("fn", params, ret_spec, body_fn)

    modules[mod_name] = methods
    env["__modules__"] = modules

    rest = s[j + 1 :].strip()
    return rest


def try_handle_top_level_impl(s: str, env: dict) -> str | None:
    """If s begins with a top-level impl declaration, register its methods
    into env['__impls__'] and return the trailing remainder (possibly
    empty). Otherwise return None.
    """
    stripped = s.lstrip()
    if not stripped.startswith("impl"):
        return None
    m_start = re.match(r"^\s*impl\s+([A-Za-z_]\w*)\s*\{", s)
    if not m_start:
        raise ValueError("invalid impl declaration")
    tname = m_start.group(1)
    open_idx = s.find("{", m_start.end() - 1)
    depth = 0
    j = open_idx
    in_string = False
    while j < len(s):
        ch = s[j]
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
    if j >= len(s) or s[j] != "}":
        raise ValueError("invalid impl declaration (unmatched brace)")

    body = s[open_idx + 1 : j].strip()
    # split into semicolon-separated function fragments (top-level)
    fragments = []
    cur = []
    depth = 0
    in_string = False
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

    rest = s[j + 1 :].strip()
    return rest


def register_method_from_part(type_name: str, part: str, env: dict) -> str:
    """Parse a function declaration from `part` and register it as a method
    for `type_name` under env['__impls__'].

    Returns any trailing remainder after the function declaration.
    """
    fname, params, ret_spec, body, rest2 = parse_function_from_part(part)
    impls = env.get("__impls__", {})
    methods = impls.get(type_name, {})
    if fname in methods:
        raise ValueError(f"method '{fname}' already defined for type '{type_name}'")
    methods[fname] = ("fn", params, ret_spec, body)
    impls[type_name] = methods
    env["__impls__"] = impls
    return rest2


# Import and re-export function call evaluators for backward compatibility
from ._functions_calls import (
    try_evaluate_function_call,
    try_evaluate_method_call,
)  # noqa: E402
from ._functions_scoped import try_evaluate_scoped_function_call  # noqa: E402
