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
    # bring types and any function definitions into the child environment so
    # function bodies can call other functions visible at call-time.
    if "__types__" in env:
        child_env["__types__"] = env["__types__"].copy()
    for nm, binding in env.items():
        if isinstance(binding, tuple) and len(binding) == 4 and binding[0] == "fn":
            child_env[nm] = binding
    if "__impls__" in env:
        # copy method implementations through so nested calls work
        child_env["__impls__"] = {k: v.copy() for k, v in env["__impls__"].items()}

    from .interpret import interpret

    for (pname, ptype), aexpr in zip(params, args):
        aval_str = interpret(aexpr, env)
        try:
            aval = int(aval_str, 10)
        except ValueError:
            raise ValueError("invalid function argument value")
        if ptype is None:
            # infer type from argument expression
            tstr = interpret(f"typeOf({aexpr})", env)
            pkind = tstr[0].lower()
            pbits = int(tstr[1:]) if len(tstr) > 1 else None
        else:
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


def try_evaluate_method_call(s: str, open_idx: int, close_idx: int, env: dict):
    """Detect and evaluate method-style calls like `obj.method(args)`.

    Returns (obj_start, ret_val) where obj_start is the index of the
    start of the object expression (so the caller can replace the whole
    `obj.method(args)` with the return value). Returns None if this
    parentheses do not form a method call.
    """
    # locate method name (same as function call)
    name_start = open_idx - 1
    while name_start >= 0 and s[name_start].isspace():
        name_start -= 1
    if name_start < 0 or not re.match(r"[A-Za-z0-9_]", s[name_start]):
        return None
    id_start = name_start
    while id_start >= 0 and re.match(r"[A-Za-z_0-9]", s[id_start]):
        id_start -= 1
    id_start += 1
    method_name = s[id_start : name_start + 1]

    # find '.' separating object and method name
    dot_pos = id_start - 1
    while dot_pos >= 0 and s[dot_pos].isspace():
        dot_pos -= 1
    if dot_pos < 0 or s[dot_pos] != ".":
        return None

    # find object expression start
    obj_end = dot_pos - 1
    while obj_end >= 0 and s[obj_end].isspace():
        obj_end -= 1
    if obj_end < 0:
        return None

    # handle parenthesized/object expressions or identifiers/numeric literals
    if s[obj_end] == ")":
        depth = 0
        j = obj_end
        while j >= 0:
            ch = s[j]
            if ch == ")":
                depth += 1
            elif ch == "(":
                depth -= 1
                if depth == 0:
                    break
            j -= 1
        if j < 0:
            return None
        obj_start = j
    else:
        obj_start = obj_end
        while obj_start >= 0 and re.match(r"[A-Za-z0-9_\.\+\-]", s[obj_start]):
            obj_start -= 1
        obj_start += 1

    obj_expr = s[obj_start:dot_pos].strip()

    # determine the object's type
    from .interpret import interpret

    obj_val = interpret(obj_expr, env)
    tstr = interpret(f"typeOf({obj_expr})", env)
    # look up impls for this type
    impls = env.get("__impls__", {})
    if tstr not in impls:
        raise ValueError(f"type '{tstr}' has no methods")
    methods = impls[tstr]
    if method_name not in methods:
        raise ValueError(f"type '{tstr}' has no method '{method_name}'")

    binding = methods[method_name]
    _, params, _ret, body = binding

    # parse args similar to function call
    inner = s[open_idx + 1 : close_idx]
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

    # first param often represents 'this'
    if len(args) + 1 != len(params):
        # allow explicit 'this' passed also by user (len equal) or implicit (object->this)
        # If params length equals args length, maybe 'this' was provided explicitly.
        if not (len(args) == len(params) - 1):
            raise ValueError("method call argument count mismatch")

    child_env = {}
    if "__types__" in env:
        child_env["__types__"] = env["__types__"].copy()
    # copy functions and impls so method body can call them
    for nm, b in env.items():
        if isinstance(b, tuple) and len(b) == 4 and b[0] == "fn":
            child_env[nm] = b
    if "__impls__" in env:
        child_env["__impls__"] = {k: v.copy() for k, v in env["__impls__"].items()}

    # bind params: 'this' comes from obj_val first
    # convert obj_val to int when possible
    try:
        obj_int = int(obj_val, 10)
    except Exception:
        raise ValueError("invalid method receiver value")

    # if params include a 'this' param, assign it first
    param_iter = iter(params)
    assigned = 0
    for pname, ptype in params:
        if assigned == 0:
            # bind this
            if ptype is None:
                # infer kind from tstr
                pkind = tstr[0].lower()
                pbits = int(tstr[1:]) if len(tstr) > 1 else None
            else:
                pkind = ptype[0].lower()
                pbits = int(ptype[1:]) if len(ptype) > 1 else None
            child_env[pname] = (obj_int, pkind, pbits, False)
            assigned += 1
            continue
        # remaining params bind from args
        ai = assigned - 1
        aexpr = args[ai]
        aval_str = interpret(aexpr, env)
        try:
            aval = int(aval_str, 10)
        except ValueError:
            raise ValueError("invalid method argument value")
        if ptype is None:
            tstr_a = interpret(f"typeOf({aexpr})", env)
            pkind = tstr_a[0].lower()
            pbits = int(tstr_a[1:]) if len(tstr_a) > 1 else None
        else:
            pkind = ptype[0].lower()
            pbits = int(ptype[1:]) if len(ptype) > 1 else None
        child_env[pname] = (aval, pkind, pbits, False)
        assigned += 1

    from ._statements import evaluate_statement_parts

    try:
        parts = [body] if body is not None else []
        ret_val = evaluate_statement_parts(parts, child_env)
    except ReturnSignal as rs:
        ret_val = rs.value

    return (obj_start, ret_val)
