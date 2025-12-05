import re


def evaluate_statement_parts(parts: list[str], env: dict) -> str:
    """Evaluate a list of top-level statement parts and return last result.

    This mirrors the original 'parts is not None' behaviour implemented in
    the interpreter but lives here to keep interpret.py small.
    """
    from . import _pointers
    from .interpret import interpret

    last = None
    i = 0
    while i < len(parts):
        part = parts[i]
        # If this part starts an if-statement and the next top-level part
        # begins with 'else', treat them together as a single if-statement
        # so branches can contain assignments or other statements.
        if part.lstrip().startswith("if") and i + 1 < len(parts) and parts[i + 1].lstrip().startswith("else"):
            # extract condition and then-expression from the 'if' part
            m_if = re.match(r"^\s*if\s*\((.*)\)\s*(.*)$", part)
            if not m_if:
                raise ValueError("invalid if statement")
            cond = m_if.group(1).strip()
            then_expr = m_if.group(2).strip()
            else_part = parts[i + 1].lstrip()
            # remove the leading 'else' token from else_part
            if not else_part.startswith("else"):
                raise ValueError("malformed else part")
            else_expr = else_part[len("else"):].strip()

            cond_val = interpret(cond, env)
            if cond_val == "true":
                chosen = then_expr
            elif cond_val == "false":
                chosen = else_expr
            else:
                try:
                    chosen = then_expr if int(cond_val, 10) != 0 else else_expr
                except Exception:
                    chosen = else_expr

            # evaluate chosen branch as a statement part (so assignments work)
            last = evaluate_statement_parts([chosen], env)
            i += 2
            continue

        part = parts[i]
        i += 1
        if part.startswith("let "):
            m = re.match(
                r"let\s+(mut\s+)?([A-Za-z_]\w*)\s*:\s*(\*(?:\s*mut\s*)?[uUiI]\d+|[uUiI]\d+)\s*=\s*(.+)",
                part,
            )
            if m:
                mut_flag = bool(m.group(1))
                name = m.group(2)
                type_spec = m.group(3)
                init_expr = m.group(4).strip()
                declared_kind = type_spec[0].lower()
                if declared_kind == "*":
                    handled = _pointers.handle_typed_pointer_initializer(
                        env, name, type_spec, init_expr, mut_flag
                    )
                    if handled:
                        last = ""
                        continue
                else:
                    declared_bits = int(type_spec[1:])

                explicit = re.findall(r"(?i)([ui])(\d+)\b", init_expr)
                if explicit:
                    for k, b in explicit:
                        if k.lower() != declared_kind or int(b) != declared_bits:
                            raise ValueError(
                                "initializer suffixes must match declared type"
                            )

                idents = re.findall(r"\b([A-Za-z_]\w*)\b", init_expr)
                for ident in idents:
                    if ident in env and env[ident][1] is not None:
                        kval, kkind, kbits, _kmut = env[ident]
                        if kkind and kkind.startswith("*"):
                            kcomp = kkind[1:]
                        else:
                            kcomp = kkind
                        if kcomp != declared_kind or kbits != declared_bits:
                            raise ValueError(
                                "initializer references variable with incompatible type"
                            )

                val_str = interpret(init_expr, env)
            else:
                m_typed_noinit = re.match(
                    r"let\s+(mut\s+)?([A-Za-z_]\w*)\s*:\s*(\*(?:\s*mut\s*)?[uUiI]\d+|[uUiI]\d+)\s*$",
                    part,
                )
                if m_typed_noinit:
                    mut_flag = bool(m_typed_noinit.group(1))
                    name = m_typed_noinit.group(2)
                    type_spec = m_typed_noinit.group(3)
                    if name in env:
                        raise ValueError(f"variable '{name}' already declared")
                    handled = _pointers.handle_typed_pointer_noinit(
                        env, name, type_spec, mut_flag
                    )
                    if handled:
                        last = ""
                        continue
                    kind = type_spec[0].lower()
                    bits = int(type_spec[1:])
                    if bits <= 0:
                        raise ValueError("invalid integer width")
                    env[name] = (None, kind, bits, True)
                    last = ""
                    continue

                m2 = re.match(r"let\s+(mut\s+)?([A-Za-z_]\w*)\s*=\s*(.+)", part)
                if not m2:
                    raise ValueError("invalid let statement")
                mut_flag = bool(m2.group(1))
                name = m2.group(2)
                type_spec = None
                init_expr = m2.group(3).strip()
                val_str = interpret(init_expr, env)

            try:
                val = int(val_str, 10)
            except ValueError:
                raise ValueError("invalid initializer for variable")

            if type_spec is not None:
                kind = type_spec[0].lower()
                bits = int(type_spec[1:])
                if bits <= 0:
                    raise ValueError("invalid integer width")

                if kind == "u":
                    max_val = (1 << bits) - 1
                    if val < 0 or val > max_val:
                        raise ValueError("unsigned literal out of range")
                else:
                    max_pos = (1 << (bits - 1)) - 1
                    min_neg = -(1 << (bits - 1))
                    if val < min_neg or val > max_pos:
                        raise ValueError("signed literal out of range")

                if name in env:
                    raise ValueError(f"variable '{name}' already declared")

                env[name] = (val, kind, bits, mut_flag)
            else:
                if name in env:
                    raise ValueError(f"variable '{name}' already declared")

                env[name] = (val, None, None, mut_flag)

            last = ""
        else:
            m_deref_assign = re.match(r"^\*\s*([A-Za-z_]\w*)\s*=\s*(.+)$", part)
            if m_deref_assign:
                handled, maybe_last = _pointers.try_deref_assign(part, env)
                if handled:
                    last = maybe_last
                    continue

            m_assign = re.match(r"^([A-Za-z_]\w*)\s*=\s*(.+)$", part)
            if m_assign:
                name = m_assign.group(1)
                expr = m_assign.group(2).strip()
                if name not in env:
                    raise ValueError(f"assignment to undeclared variable '{name}'")
                val_str = interpret(expr, env)
                try:
                    val = int(val_str, 10)
                except ValueError:
                    raise ValueError("invalid assignment value")

                kind, bits = env[name][1], env[name][2]
                if kind is not None:
                    if kind == "u":
                        max_val = (1 << bits) - 1
                        if val < 0 or val > max_val:
                            raise ValueError("unsigned literal out of range")
                    else:
                        max_pos = (1 << (bits - 1)) - 1
                        min_neg = -(1 << (bits - 1))
                        if val < min_neg or val > max_pos:
                            raise ValueError("signed literal out of range")

                prev_val, prev_kind, prev_bits, prev_mut = env[name]
                if prev_val is not None and not prev_mut:
                    raise ValueError("assignment to immutable variable")

                env[name] = (val, kind, bits, prev_mut)
                last = str(val)
            else:
                last = interpret(part, env)

    return last if last is not None else ""
