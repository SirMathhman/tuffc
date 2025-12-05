import re
from ._functions import parse_function_from_part


def evaluate_module_declaration(part: str, env: dict) -> tuple[str | None, str]:
    """Handle module declaration. Returns (remainder, last_value) or (None, "") if not a module."""
    if not part.lstrip().startswith("module "):
        return None, ""

    m_start = re.match(r"^\s*module\s+([A-Za-z_]\w*)\s*\{", part)
    if not m_start:
        raise ValueError("invalid module declaration")
    mod_name = m_start.group(1)
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
        raise ValueError("invalid module declaration (unmatched brace)")

    body = part[open_idx + 1 : j].strip()
    # parse top-level semicolon separated fragments inside module
    frags = [p.strip() for p in re.split(r";(?![^{}]*})", body) if p.strip()]
    modules = env.get("__modules__", {})
    methods = modules.get(mod_name, {})

    for frag in frags:
        # only support fn declarations inside modules for now
        fname, params, ret_spec, body_fn, rest2 = parse_function_from_part(frag)
        methods[fname] = ("fn", params, ret_spec, body_fn)

    modules[mod_name] = methods
    env["__modules__"] = modules
    rest = part[j + 1 :].strip()
    return rest, ""
