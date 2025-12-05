import re


def parse_pointer_spec(type_spec: str):
    """Parse a pointer type spec like '*I32' or '*mut I32'.

    Returns (is_pointer, pointed_mut, pointed_kind, bits) where is_pointer
    is boolean.
    """
    if not type_spec:
        return (False, False, None, None)
    type_spec = type_spec.strip()
    if not type_spec.startswith("*"):
        return (False, False, None, None)

    rest = re.sub(r"\s+", "", type_spec[1:])
    pointed_mut = False
    if rest.startswith("mut"):
        pointed_mut = True
        rest = rest[len("mut") :]

    if len(rest) < 2:
        raise ValueError("invalid pointer type")

    pointed_kind = rest[0].lower()
    bits = int(rest[1:])
    return (True, pointed_mut, pointed_kind, bits)


def handle_typed_pointer_initializer(
    env: dict, name: str, type_spec: str, init_expr: str, mut_flag: bool
) -> bool:
    m_addr = re.match(r"^\s*&\s*(mut\s+)?([A-Za-z_]\w*)\s*$", init_expr)
    if not m_addr:
        return False

    is_mut_addr = bool(m_addr.group(1))
    target = m_addr.group(2)
    if target not in env:
        raise ValueError("pointer to undeclared variable")

    (is_ptr, pointed_mut, pointed_kind, declared_bits) = parse_pointer_spec(type_spec)
    if not is_ptr:
        raise ValueError("not a pointer type")

    tval, tkind, tbits, _ = env[target]
    if tkind is None:
        tkind = "i"
        tbits = 32

    if tkind != pointed_kind or tbits != declared_bits:
        raise ValueError("pointer target type mismatch")

    if is_mut_addr and not pointed_mut:
        raise ValueError("cannot take &mut for non-mutable pointer type")

    if is_mut_addr and not env[target][3]:
        raise ValueError("cannot take &mut of an immutable variable")

    ptr_kind = "*"
    if pointed_mut:
        ptr_kind += "mut"
    ptr_kind += pointed_kind
    env[name] = (target, ptr_kind, declared_bits, mut_flag)
    return True


def handle_typed_pointer_noinit(
    env: dict, name: str, type_spec: str, mut_flag: bool
) -> bool:
    is_ptr, pointed_mut, pointed_kind, bits = parse_pointer_spec(type_spec)
    if not is_ptr:
        return False
    # normalize compact kind like '*mut' + kind
    ptr_kind = "*"
    if pointed_mut:
        ptr_kind += "mut"
    ptr_kind += pointed_kind
    env[name] = (None, ptr_kind, bits, True)
    return True


def try_deref_simple(name: str, env: dict) -> str:
    if name not in env:
        raise ValueError(f"dereference of undeclared variable '{name}'")
    val, kind, bits, _mut = env[name]
    if not (kind and isinstance(kind, str) and kind.startswith("*")):
        raise ValueError("dereference of non-pointer")
    target = val
    if target not in env:
        raise ValueError(f"pointer points to undeclared variable '{target}'")
    targ_val = env[target][0]
    if targ_val is None:
        raise ValueError(f"dereference of uninitialized variable '{target}'")
    return str(targ_val)


def try_deref_assign(part: str, env: dict) -> tuple[bool, str | None]:
    m = re.match(r"^\*\s*([A-Za-z_]\w*)\s*=\s*(.+)$", part)
    if not m:
        return (False, None)

    ptr_name = m.group(1)
    expr = m.group(2).strip()
    if ptr_name not in env:
        raise ValueError(f"assignment to undeclared pointer '{ptr_name}'")
    ptr_val, ptr_kind, ptr_bits, ptr_mutflag = env[ptr_name]
    if not (isinstance(ptr_kind, str) and ptr_kind.startswith("*")):
        raise ValueError("assignment through non-pointer")
    if not ptr_kind.startswith("*mut"):
        raise ValueError("assignment through immutable pointer not allowed")
    target = ptr_val
    if target not in env:
        raise ValueError("pointer points to undeclared variable")

    val_str = interpret_in_child(expr, env)
    try:
        val = int(val_str, 10)
    except ValueError:
        raise ValueError("invalid assignment value")

    t_val, t_kind, t_bits, t_mut = env[target]
    if t_kind is not None:
        if isinstance(t_kind, str) and t_kind.startswith("*"):
            t_cmp_kind = t_kind[1:]
        else:
            t_cmp_kind = t_kind
        if t_cmp_kind == "u":
            max_val = (1 << t_bits) - 1
            if val < 0 or val > max_val:
                raise ValueError("unsigned literal out of range")
        else:
            max_pos = (1 << (t_bits - 1)) - 1
            min_neg = -(1 << (t_bits - 1))
            if val < min_neg or val > max_pos:
                raise ValueError("signed literal out of range")

    if not env[target][3]:
        raise ValueError("assignment to immutable variable via pointer")

    env[target] = (val, env[target][1], env[target][2], env[target][3])
    return (True, str(val))


# small helper to call interpret without allowing it to mutate our env unexpectedly
def interpret_in_child(expr: str, env: dict) -> str:
    # evaluate expression using a copy of env to prevent weird side-effects
    from .interpret import interpret

    return interpret(expr, env)
