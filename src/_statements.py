import re
from ._functions import ReturnSignal, register_function_from_part


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
        # Function declaration: delegate to helper to register in env
        if part.lstrip().startswith("fn "):
            rest2 = register_function_from_part(part, env)
            last = ""
            if rest2:
                parts[i] = rest2
                continue
            i += 1
            continue
        # return statement inside functions: `return expr` or `return`.
        if part.lstrip().startswith("return"):
            m_ret = re.match(r"^\s*return\s*(.*)$", part, re.DOTALL)
            if not m_ret:
                raise ValueError("invalid return statement")
            expr = m_ret.group(1).strip()
            if not expr:
                raise ReturnSignal("")
            # evaluate return expression using interpret from the current env
            val = interpret(expr, env)
            raise ReturnSignal(val)
        # Struct declaration: `struct Name { field : Type, ... }`
        # Impl block: `impl Type { fn name(params...) => ... }` (methods)
        if part.lstrip().startswith("impl "):
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
            # iterate over top-level semicolon-separated fragments and register
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

            last = ""
            rest = part[j + 1 :].strip()
            if rest:
                parts[i] = rest
                continue
            i += 1
            continue
        # Module declaration: `module Name { ... }`
        if part.lstrip().startswith("module "):
            from ._module_handler import evaluate_module_declaration
            rest, last = evaluate_module_declaration(part, env)
            if rest:
                parts[i] = rest
                continue
            i += 1
            continue
        if part.lstrip().startswith("struct "):
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
            last = ""
            # if there is trailing text after the struct decl, put it back
            rest = part[j + 1 :].strip()
            if rest:
                parts[i] = rest
                continue
            i += 1
            continue
        # If this part starts an if-statement and it's a single-part if
        # (no else present in the same part and next part does not begin
        # with 'else'), evaluate the then-branch as statements.
        if part.lstrip().startswith("if") and not part.lstrip().startswith("if"):
            pass

        # while loops: `while (cond) stmt` where stmt is a single top-level part
        if part.lstrip().startswith("while"):
            m_while = re.match(r"^\s*while\s*\((.*)\)\s*(.*)$", part)
            if not m_while:
                raise ValueError("invalid while statement")
            cond = m_while.group(1).strip()
            body = m_while.group(2).strip()
            # Loop until condition false. Evaluate cond via interpret.
            while True:
                cond_val = interpret(cond, env)
                if cond_val == "false":
                    break
                if cond_val != "true":
                    try:
                        if int(cond_val, 10) == 0:
                            break
                    except Exception:
                        break
                # execute body as a statement (may be assignment or block)
                evaluate_statement_parts([body], env)
            i += 1
            continue

        # If this part starts an if-statement and the next top-level part
        # begins with 'else', treat them together as a single if-statement
        # so branches can contain assignments or other statements.
        # Handle an if-statement that is represented entirely within this
        # part (i.e. `if (cond) stmt` with no else). We will execute the
        # then-branch as statements when the condition is true.
        if part.lstrip().startswith("if") and (
            i + 1 >= len(parts) or not parts[i + 1].lstrip().startswith("else")
        ):
            m_if_single = re.match(r"^\s*if\s*\((.*)\)\s*(.*)$", part)
            if not m_if_single:
                # Not a standalone single-part if, fall through
                pass
            else:
                cond = m_if_single.group(1).strip()
                then_expr = m_if_single.group(2).strip()
                cond_val = interpret(cond, env)
                if cond_val == "true":
                    last = evaluate_statement_parts([then_expr], env)
                i += 1
                continue

        if (
            part.lstrip().startswith("if")
            and i + 1 < len(parts)
            and parts[i + 1].lstrip().startswith("else")
        ):
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
            else_expr = else_part[len("else") :].strip()

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

                # support struct literal initializer `TypeName { a, b }`
                m_struct_init = re.match(
                    r"^([A-Za-z_]\w*)\s*\{(.*)\}$", init_expr, re.DOTALL
                )
                if m_struct_init:
                    sname = m_struct_init.group(1)
                    inner = m_struct_init.group(2).strip()
                    types = env.get("__types__", {})
                    if sname not in types:
                        raise ValueError(f"unknown struct type '{sname}'")
                    fdefs = types[sname]
                    # split by comma (simple top-level split)
                    vals = [p.strip() for p in inner.split(",")] if inner else []
                    if len(vals) != len(fdefs):
                        raise ValueError("struct initializer field count mismatch")
                    obj = {}
                    for (fname, _ftype), vexpr in zip(fdefs, vals):
                        vstr = interpret(vexpr, env)
                        try:
                            v = int(vstr, 10)
                        except ValueError:
                            raise ValueError("invalid struct field initializer")
                        obj[fname] = v
                    env[name] = (obj, f"struct:{sname}", None, mut_flag)
                    last = ""
                    continue
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
                # support struct literal initializer `TypeName { a, b }` for
                # untyped `let` forms too (e.g. `let s = Point { 1, 2 }`).
                m_struct_init = re.match(
                    r"^([A-Za-z_]\w*)\s*\{(.*)\}$", init_expr, re.DOTALL
                )
                if m_struct_init:
                    sname = m_struct_init.group(1)
                    inner = m_struct_init.group(2).strip()
                    types = env.get("__types__", {})
                    if sname not in types:
                        raise ValueError(f"unknown struct type '{sname}'")
                    fdefs = types[sname]
                    vals = [p.strip() for p in inner.split(",")] if inner else []
                    if len(vals) != len(fdefs):
                        raise ValueError("struct initializer field count mismatch")
                    obj = {}
                    for (fname, _ftype), vexpr in zip(fdefs, vals):
                        vstr = interpret(vexpr, env)
                        try:
                            v = int(vstr, 10)
                        except ValueError:
                            raise ValueError("invalid struct field initializer")
                        obj[fname] = v
                    if name in env:
                        raise ValueError(f"variable '{name}' already declared")
                    env[name] = (obj, f"struct:{sname}", None, mut_flag)
                    last = ""
                    continue

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

            m_comp_assign = re.match(r"^([A-Za-z_]\w*)\s*\+=\s*(.+)$", part)
            if m_comp_assign:
                name = m_comp_assign.group(1)
                expr = m_comp_assign.group(2).strip()
                if name not in env:
                    raise ValueError(f"assignment to undeclared variable '{name}'")
                prev_val, prev_kind, prev_bits, prev_mut = env[name]
                if prev_val is None:
                    raise ValueError("compound assignment on uninitialized variable")
                if not prev_mut:
                    raise ValueError("assignment to immutable variable")

                rhs_str = interpret(expr, env)
                try:
                    rhs_val = int(rhs_str, 10)
                except ValueError:
                    raise ValueError("invalid assignment value")

                if isinstance(prev_kind, str) and prev_kind.startswith("*"):
                    raise ValueError(
                        "compound assignment not supported for pointer types"
                    )

                new_val = prev_val + rhs_val

                # Range checks for typed variable
                if prev_kind is not None:
                    if prev_kind == "u":
                        max_val = (1 << prev_bits) - 1
                        if new_val < 0 or new_val > max_val:
                            raise ValueError("unsigned literal out of range")
                    else:
                        max_pos = (1 << (prev_bits - 1)) - 1
                        min_neg = -(1 << (prev_bits - 1))
                        if new_val < min_neg or new_val > max_pos:
                            raise ValueError("signed literal out of range")

                env[name] = (new_val, prev_kind, prev_bits, prev_mut)
                last = str(new_val)
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
