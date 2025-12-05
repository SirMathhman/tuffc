import re


def try_evaluate_scoped_function_call(s: str, open_idx: int, close_idx: int, env: dict):
    """Detect and evaluate module-scoped function calls like `module::func(args)`.

    Returns (id_start, ret_val) where id_start is the index of the
    start of the module identifier. Returns None if this does not represent
    a scoped function call.
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
    func_name = s[id_start : name_start + 1]

    # check for :: before function name
    colon_pos = id_start - 1
    while colon_pos >= 0 and s[colon_pos].isspace():
        colon_pos -= 1
    if colon_pos < 1 or s[colon_pos - 1 : colon_pos + 1] != "::":
        return None

    # find module name end (before ::)
    mod_end = colon_pos - 2
    while mod_end >= 0 and s[mod_end].isspace():
        mod_end -= 1
    if mod_end < 0:
        return None
    id_start2 = mod_end
    while id_start2 >= 0 and re.match(r"[A-Za-z_0-9]", s[id_start2]):
        id_start2 -= 1
    id_start2 += 1
    mod_name = s[id_start2 : mod_end + 1]

    # look up module and function
    modules = env.get("__modules__", {})
    if mod_name not in modules:
        return None
    methods = modules[mod_name]
    if func_name not in methods:
        return None

    binding = methods[func_name]
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

    # build child env and evaluate body
    if len(args) != len(params):
        raise ValueError("scoped function call argument count mismatch")

    child_env = {}
    # bring types and any function definitions into the child environment
    if "__types__" in env:
        child_env["__types__"] = env["__types__"].copy()
    for nm, b in env.items():
        if isinstance(b, tuple) and len(b) == 4 and b[0] == "fn":
            child_env[nm] = b
    if "__impls__" in env:
        child_env["__impls__"] = {k: v.copy() for k, v in env["__impls__"].items()}
    if "__modules__" in env:
        # copy modules so nested scoped calls work
        child_env["__modules__"] = {
            k: {fn: fn_binding for fn, fn_binding in v.items()}
            for k, v in env["__modules__"].items()
        }

    from .interpret import interpret

    for (pname, ptype), aexpr in zip(params, args):
        aval_str = interpret(aexpr, env)
        try:
            aval = int(aval_str, 10)
        except ValueError:
            raise ValueError("invalid scoped function argument value")
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
    from ._functions import ReturnSignal

    try:
        parts = [body] if body is not None else []
        ret_val = evaluate_statement_parts(parts, child_env)
    except ReturnSignal as rs:
        ret_val = rs.value

    return (id_start2, ret_val)
