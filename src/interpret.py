import re

from ._arithmetic import evaluate_arithmetic, _LEADING_NUMBER


def interpret(s: str, env: dict | None = None) -> str:
    """Return the input string, stripping any trailing type-suffix when present.

    Examples:
    - "100" -> "100"
    - "100U8" -> "100"
    - "3.14F32" -> "3.14"

    The function keeps the numeric prefix (int/float with optional exponent)
    and returns it when present, otherwise returns the original string.
    """
    if not isinstance(s, str):
        raise TypeError("interpret expects a string")

    env = {} if env is None else env

    # If input contains multiple statements separated by ';', evaluate them
    # sequentially and return the value of the last statement.
    # Only treat s as multiple statements when there are top-level
    # semicolons (not ones enclosed in parentheses/braces or strings).
    parts = None
    if ";" in s:
        parts = []
        cur = []
        depth = 0
        in_string = False
        i = 0
        had_top_level = False
        while i < len(s):
            ch = s[i]
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
                elif ch == ";" and depth == 0:
                    had_top_level = True
                    part = "".join(cur).strip()
                    if part:
                        parts.append(part)
                    cur = []
                else:
                    cur.append(ch)
            else:
                cur.append(ch)
            i += 1

        last_part = "".join(cur).strip()
        if last_part:
            parts.append(last_part)

        if not had_top_level:
            parts = None

    if parts is not None:
        # parts was already prepared above; process each top-level part
        last = None
        for part in parts:
            if part.startswith("let "):
                # typed with initializer: `let [mut] name : U8 = expr`
                # Support typed declarations including pointer types such as
                # `let name : *I32 = &other;` as well as plain integer types
                # like `let name : I32 = 10`.
                m = re.match(
                    r"let\s+(mut\s+)?([A-Za-z_]\w*)\s*:\s*(\*(?:\s*mut\s*)?[uUiI]\d+|[uUiI]\d+)\s*=\s*(.+)",
                    part,
                )
                if m:
                    mut_flag = bool(m.group(1))
                    name = m.group(2)
                    type_spec = m.group(3)
                    init_expr = m.group(4).strip()
                    # If this is a typed declaration with an initializer,
                    # ensure any explicit suffixes or typed variables in the
                    # initializer match the declared type (kind and width).
                    declared_kind = type_spec[0].lower()
                    # If this is a pointer type the first character is '*'
                    # followed by the pointed type kind and width. Normalize
                    # pointer declarations into a `declared_kind` of '*'
                    # while `declared_bits` is the pointed width.
                    if declared_kind == "*":
                        # normalize by removing '*' and whitespace
                        rest = re.sub(r"\s+", "", type_spec[1:])
                        pointed_mut = False
                        if rest.startswith("mut"):
                            pointed_mut = True
                            rest = rest[len("mut"):]
                        if len(rest) < 2:
                            raise ValueError("invalid pointer type")
                        pointed_kind = rest[0].lower()
                        declared_bits = int(rest[1:])
                    else:
                        declared_bits = int(type_spec[1:])

                    # If declaring a pointer type, the initializer must be an
                    # address-of of the form `&name`. Validate the target
                    # variable exists and its type matches the pointed type.
                    if declared_kind == "*":
                        m_addr = re.match(r"^\s*&\s*(mut\s+)?([A-Za-z_]\w*)\s*$", init_expr)
                        if not m_addr:
                            raise ValueError("pointer initializer must be &identifier or &mut identifier")
                        is_mut_addr = bool(m_addr.group(1))
                        target = m_addr.group(2)
                        if target not in env:
                            raise ValueError("pointer to undeclared variable")
                        tval, tkind, tbits, _ = env[target]
                        # untyped value defaults to I32
                        if tkind is None:
                            tkind = "i"
                            tbits = 32
                        if tkind != pointed_kind or tbits != declared_bits:
                            raise ValueError("pointer target type mismatch")
                        # if initializer used &mut, require pointer type be mutable
                        if is_mut_addr and not pointed_mut:
                            raise ValueError("cannot take &mut for non-mutable pointer type")
                        # if initializer uses &mut, ensure the target variable
                        # is declared mutable.
                        if is_mut_addr and not env[target][3]:
                            raise ValueError("cannot take &mut of an immutable variable")
                        # store pointer by keeping the target identifier as
                        # the 'value' and mark the kind with a leading '*',
                        # include 'mut' in the kind string when pointer is mutable
                        ptr_kind = "*"
                        if pointed_mut:
                            ptr_kind += "mut"
                        ptr_kind += pointed_kind
                        env[name] = (target, ptr_kind, declared_bits, mut_flag)
                        last = ""
                        continue

                    # find explicit suffixes like U8, i32, etc. in the init expr
                    # find U/I suffixes even when attached to numeric prefixes (e.g. 2U8)
                    explicit = re.findall(r"(?i)([ui])(\d+)\b", init_expr)
                    if explicit:
                        for k, b in explicit:
                            if k.lower() != declared_kind or int(b) != declared_bits:
                                raise ValueError(
                                    "initializer suffixes must match declared type"
                                )

                    # find identifiers used in initializer and ensure any typed
                    # variables referenced are compatible with the declared type
                    idents = re.findall(r"\b([A-Za-z_]\w*)\b", init_expr)
                    for ident in idents:
                        if ident in env and env[ident][1] is not None:
                            kval, kkind, kbits, _kmut = env[ident]
                            # for pointer declarations the ident(s) we inspect
                            # are expected to be plain variables (not pointer
                            # types), so normalize any pointer kinds we
                            # encounter for the comparison.
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
                    # typed without initializer: `let name : U8`
                    m_typed_noinit = re.match(
                        r"let\s+(mut\s+)?([A-Za-z_]\w*)\s*:\s*(\*(?:\s*mut\s*)?[uUiI]\d+|[uUiI]\d+)\s*$",
                        part,
                    )
                    if m_typed_noinit:
                        mut_flag = bool(m_typed_noinit.group(1))
                        name = m_typed_noinit.group(2)
                        type_spec = m_typed_noinit.group(3)
                        # no initializer; store variable uninitialized
                        if name in env:
                            raise ValueError(f"variable '{name}' already declared")
                        # normalize pointer types into a compact kind string
                        if type_spec.startswith("*"):
                            rest = re.sub(r"\s+", "", type_spec[1:])
                            if rest.startswith("mut"):
                                kind = "*mut" + rest[len("mut"):][0].lower()
                                bits = int(rest[len("mut"):][1:])
                            else:
                                kind = "*" + rest[0].lower()
                                bits = int(rest[1:])
                        else:
                            kind = type_spec[0].lower()
                            bits = int(type_spec[1:])
                        if bits <= 0:
                            raise ValueError("invalid integer width")
                        # uninitialized declarations are considered assignable
                        env[name] = (None, kind, bits, True)
                        last = ""
                        continue
                    # support untyped let with initializer: `let name = expr`
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
                # `let` statements don't produce a visible value when they are
                # the final statement; return an empty string for those.
                last = ""
            else:
                # assignment? match `name = expr`
                # handle pointer-target assignment like '*p = expr'
                m_deref_assign = re.match(r"^\*\s*([A-Za-z_]\w*)\s*=\s*(.+)$", part)
                if m_deref_assign:
                    ptr_name = m_deref_assign.group(1)
                    expr = m_deref_assign.group(2).strip()
                    if ptr_name not in env:
                        raise ValueError(f"assignment to undeclared pointer '{ptr_name}'")
                    ptr_val, ptr_kind, ptr_bits, ptr_mutflag = env[ptr_name]
                    if not (isinstance(ptr_kind, str) and ptr_kind.startswith("*")):
                        raise ValueError("assignment through non-pointer")
                    # require pointer to be a mutable pointer type (i.e. '*mut')
                    if not ptr_kind.startswith("*mut"):
                        raise ValueError("assignment through immutable pointer not allowed")
                    target = ptr_val
                    if target not in env:
                        raise ValueError("pointer points to undeclared variable")
                    # compute rhs value
                    val_str = interpret(expr, env)
                    try:
                        val = int(val_str, 10)
                    except ValueError:
                        raise ValueError("invalid assignment value")
                    # perform range checks against the pointed variable type
                    t_val, t_kind, t_bits, t_mut = env[target]
                    if t_kind is not None:
                        # normalize pointer target kinds (strip '*')
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
                    # ensure target variable is mutable
                    if not env[target][3]:
                        raise ValueError("assignment to immutable variable via pointer")
                    # write back to target
                    env[target] = (val, env[target][1], env[target][2], env[target][3])
                    last = str(val)
                else:
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

                        # check typed variable range if applicable
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

                        # ensure assignment permitted: allow if variable is
                        # uninitialized (value None) or if it is mutable
                        prev_val, prev_kind, prev_bits, prev_mut = env[name]
                        if prev_val is not None and not prev_mut:
                            raise ValueError("assignment to immutable variable")

                        env[name] = (val, kind, bits, prev_mut)
                        last = str(val)
                    else:
                        last = interpret(part, env)

        return last if last is not None else ""

    # Provide a `typeOf(expr)` convenience when the entire input is a
    # typeOf(...) invocation. This must be handled before the generic
    # parentheses evaluation (which would otherwise strip the parens).
    m_typeof = re.match(r"^\s*typeOf\s*\((.*)\)\s*$", s)
    if m_typeof:
        inner = m_typeof.group(1).strip()

        # If it's a simple identifier, look up its declared type.
        if re.match(r"^[A-Za-z_]\w*$", inner):
            if inner in env:
                kind, bits = env[inner][1], env[inner][2]
                if kind is None:
                    # untyped variable defaults to I32 for integers
                    val = env[inner][0]
                    if isinstance(val, int):
                        return "I32"
                    return "F64"
                return kind.upper() + str(bits)
            # unknown identifier — treat as I32 by default
            return "I32"

        # If it's a numeric literal or expression, attempt to detect an
        # explicit suffix like U8/I32/F32 in the text. Prefer explicit
        # suffix when present.
        # find U/I/F suffix matches (e.g. 2U8, 3.14F32)
        explicit = re.findall(r"(?i)([uif])(\d+)\b", inner)
        if explicit:
            k, b = explicit[0]
            return k.upper() + str(int(b))

        # otherwise if it's a plain integer literal return I32, float -> F64
        mnum = _LEADING_NUMBER.match(inner)
        if mnum:
            num = mnum.group(0)
            if any(ch in num for ch in ".eE"):
                return "F64"
            return "I32"

        # fallback
        return "I32"

    # Evaluate innermost parenthesized expressions first, replacing them
    # with their evaluated result. This allows "(1 + 10) * 2U8" to become
    # "11 * 2U8" which the rest of the parser handles.
    # Support curly-brace grouping `{ ... }` same as parentheses.
    braced_occurred = False
    while "{" in s:
        open_idx = s.rfind("{")
        close_idx = s.find("}", open_idx)
        if close_idx == -1:
            raise ValueError("unmatched brace")

        inner = s[open_idx + 1 : close_idx]
        # Evaluate block contents in a local copy of the environment so
        # variables declared inside a `{ ... }` block do not leak out.
        # However, assignments to variables that already exist in the
        # outer environment should affect the outer environment when the
        # variable is assignable (e.g. `let mut x = 0; { x = 10; }`). To
        # accomplish this propagate any changes for variables that were
        # present in the outer env after evaluating the block.
        child_env = env.copy()
        val = interpret(inner, child_env)
        # Propagate any modifications to variables that existed in the
        # parent environment. New variables declared inside the block
        # remain local to the child_env and are not copied out.
        for nm, child_binding in child_env.items():
            if nm in env and child_binding != env[nm]:
                env[nm] = child_binding
        braced_occurred = True
        s = s[:open_idx] + val + s[close_idx + 1 :]

    while "(" in s:
        open_idx = s.rfind("(")
        close_idx = s.find(")", open_idx)
        if close_idx == -1:
            raise ValueError("unmatched parentheses")

        inner = s[open_idx + 1 : close_idx]
        val = interpret(inner, env)
        s = s[:open_idx] + val + s[close_idx + 1 :]

    # Support simple dereference expressions where the entire input is a
    # prefix '*' followed by an identifier (e.g. `*y`). This is intentionally
    # limited — parsing unary '*' in the middle of arithmetic expressions
    # would require a proper tokenizer. For our current tests this is
    # sufficient.
    m_deref = re.match(r"^\s*\*\s*([A-Za-z_]\w*)\s*$", s)
    if m_deref:
        name = m_deref.group(1)
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

    # substitute variables from env into the expression
    if env:
        # replace longest names first to avoid partial matches
        for name in sorted(env.keys(), key=len, reverse=True):
            s = re.sub(r"\b" + re.escape(name) + r"\b", str(env[name][0]), s)

    # if the whole string is an identifier, return its value
    ident_full = re.match(r"^[A-Za-z_]\w*$", s.strip())
    if ident_full:
        name = ident_full.group(0)
        if name in env:
            return str(env[name][0])
        # If the input had a braced block that was evaluated separately,
        # an identifier that wasn't declared in the outer environment
        # should be considered an error rather than left as-is.
        if braced_occurred:
            raise ValueError(f"use of undeclared variable '{name}'")

    m = _LEADING_NUMBER.match(s)
    if not m:
        return s

    prefix = m.group(0)
    suffix = s[len(prefix) :]

    # Try to evaluate as arithmetic expression (+, -, *)
    arith_result = evaluate_arithmetic(s, env)
    if arith_result is not None:
        return arith_result

    # Negative numbers with an unsigned suffix (e.g. "-100U8") are invalid.
    if suffix and suffix[0].lower() == "u" and prefix.startswith("-"):
        raise ValueError("negative unsigned literal not allowed")

    # If suffix indicates an integer width (e.g. U8 or I16), validate range.
    # Only validate integer numeric prefixes (no '.' or exponent).
    if suffix and suffix[0].lower() in ("u", "i"):
        m_bits = re.match(r"^[ui](\d+)", suffix, re.IGNORECASE)
        if m_bits:
            # ensure prefix is an integer literal
            if any(ch in prefix for ch in ".eE"):
                raise ValueError("integer-suffixed literal must be integer")

            bits = int(m_bits.group(1))
            if bits <= 0:
                raise ValueError("invalid integer width")

            try:
                val = int(prefix, 10)
            except ValueError:
                raise ValueError("invalid integer literal")

            if suffix[0].lower() == "u":
                max_val = (1 << bits) - 1
                if val < 0 or val > max_val:
                    raise ValueError("unsigned literal out of range")
            else:
                # signed: range is -(2^(bits-1)) .. 2^(bits-1)-1
                max_pos = (1 << (bits - 1)) - 1
                min_neg = -(1 << (bits - 1))
                if val < min_neg or val > max_pos:
                    raise ValueError("signed literal out of range")

    return prefix
