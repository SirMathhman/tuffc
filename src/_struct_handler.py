import re


def handle_struct_declaration(part: str, env: dict) -> tuple[str | None, str]:
    """Handle struct declarations. Returns (remainder, last_value) or (None, "") if not a struct."""
    if not part.lstrip().startswith("struct "):
        return None, ""

    # allow struct declaration possibly followed by other tokens
    m_start = re.match(r"^\s*struct\s+([A-Za-z_]\w*)\s*\{", part)
    if not m_start:
        raise ValueError("invalid struct declaration")
    sname = m_start.group(1)
    # find matching closing brace
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
        raise ValueError("invalid struct declaration (unmatched brace)")
    body = part[open_idx + 1 : j].strip()
    fields = []
    if body:
        for f in [p.strip() for p in body.split(",")]:
            fm = re.match(r"([A-Za-z_]\w*)\s*:\s*([A-Za-z_]\w*)", f)
            if not fm:
                raise ValueError("invalid struct field")
            fname = fm.group(1)
            ftype = fm.group(2)
            fields.append((fname, ftype))
    types = env.get("__types__", {})
    if sname in types:
        raise ValueError(f"struct '{sname}' already defined")
    types[sname] = fields
    env["__types__"] = types
    
    # if there is trailing text after the struct decl, put it back
    rest = part[j + 1 :].strip()
    return rest, ""
