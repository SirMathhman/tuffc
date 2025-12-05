import re


_LEADING_NUMBER = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?")


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
    if ";" in s:
        parts = [p.strip() for p in s.split(";") if p.strip()]
        last = None
        for part in parts:
            if part.startswith("let "):
                # typed with initializer: `let [mut] name : U8 = expr`
                m = re.match(r"let\s+(mut\s+)?([A-Za-z_]\w*)\s*:\s*([uUiI]\d+)\s*=\s*(.+)", part)
                if m:
                    mut_flag = bool(m.group(1))
                    name = m.group(2)
                    type_spec = m.group(3)
                    init_expr = m.group(4).strip()
                    # If this is a typed declaration with an initializer,
                    # ensure any explicit suffixes or typed variables in the
                    # initializer match the declared type (kind and width).
                    declared_kind = type_spec[0].lower()
                    declared_bits = int(type_spec[1:])

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
                            if kkind != declared_kind or kbits != declared_bits:
                                raise ValueError(
                                    "initializer references variable with incompatible type"
                                )

                    val_str = interpret(init_expr, env)
                else:
                    # typed without initializer: `let name : U8`
                    m_typed_noinit = re.match(
                        r"let\s+(mut\s+)?([A-Za-z_]\w*)\s*:\s*([uUiI]\d+)\s*$",
                        part,
                    )
                    if m_typed_noinit:
                        mut_flag = bool(m_typed_noinit.group(1))
                        name = m_typed_noinit.group(2)
                        type_spec = m_typed_noinit.group(3)
                        # no initializer; store variable uninitialized
                        if name in env:
                            raise ValueError(f"variable '{name}' already declared")
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
    while "(" in s:
        open_idx = s.rfind("(")
        close_idx = s.find(")", open_idx)
        if close_idx == -1:
            raise ValueError("unmatched parentheses")

        inner = s[open_idx + 1 : close_idx]
        val = interpret(inner, env)
        s = s[:open_idx] + val + s[close_idx + 1 :]

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

    m = _LEADING_NUMBER.match(s)
    if not m:
        return s

    prefix = m.group(0)
    suffix = s[len(prefix) :]

    # Support simple two-term integer addition like "100U32 + 200U32".
    # If there's a plus sign after the first operand's suffix, parse the
    # right-hand operand and compute the result when both sides have
    # matching integer suffixes (same signedness and width).
    if "+" in suffix or "-" in suffix or "*" in suffix:
        # Parse a sequence of terms (number + optional suffix) separated by '+'.
        # Collect (num_str, suffix_str) for each term.
        terms = []
        pos = 0
        s_rest = s
        ops = []
        while True:
            # skip leading whitespace between terms
            while pos < len(s_rest) and s_rest[pos].isspace():
                pos += 1

            mterm = _LEADING_NUMBER.match(s_rest[pos:])
            if not mterm:
                raise ValueError("invalid operand in addition")

            num = mterm.group(0)
            pos += mterm.end()

            # find next operator (+ or -) in the remaining chunk
            rest = s_rest[pos:]
            plus_idx = rest.find("+")
            minus_idx = rest.find("-")
            star_idx = rest.find("*")
            # determine the nearest operator index that's not -1
            # pick nearest operator among +, -, *
            op_idx = -1
            op_char = None
            for idx, ch in ((plus_idx, "+"), (minus_idx, "-"), (star_idx, "*")):
                if idx != -1 and (op_idx == -1 or idx < op_idx):
                    op_idx = idx
                    op_char = ch

            if op_idx == -1:
                term_suffix = rest
                terms.append((num, term_suffix.strip()))
                break
            else:
                term_suffix = rest[:op_idx]
                terms.append((num, term_suffix.strip()))
                ops.append(op_char)
                # advance pos beyond operator and continue parsing next term
                pos += op_idx + 1

        # If none of the terms carry a [ui]<bits> suffix, perform plain integer sum.
        explicit = [
            t for t in terms if re.match(r"^[ui]\d+", t[1].strip(), re.IGNORECASE)
        ]
        if not explicit:
            # ensure all are integer-like prefixes
            for num, _suf in terms:
                if any(ch in num for ch in ".eE"):
                    raise ValueError("integer addition requires integer literals")
            # compute respecting '*' precedence
            values_plain = [int(num, 10) for num, _ in terms]
            # collapse '*' groups first
            stack = [values_plain[0]]
            new_ops = []
            for i, op in enumerate(ops):
                if op == "*":
                    stack[-1] = stack[-1] * values_plain[i + 1]
                else:
                    new_ops.append(op)
                    stack.append(values_plain[i + 1])

            total = stack[0]
            for i, op in enumerate(new_ops):
                if op == "+":
                    total += stack[i + 1]
                else:
                    total -= stack[i + 1]

            return str(total)

        # At least one term has an explicit suffix; determine effective kind/bits
        kinds_bits = []
        for num, suf in terms:
            m_bits = (
                re.match(r"^[ui](\d+)", suf.strip(), re.IGNORECASE) if suf else None
            )
            if m_bits:
                kinds_bits.append((suf.strip()[0].lower(), int(m_bits.group(1))))

        # all explicit suffixes must match in kind and bits
        if any(k != kinds_bits[0][0] or b != kinds_bits[0][1] for k, b in kinds_bits):
            raise ValueError("mismatched operand types")

        kind, bits = kinds_bits[0]

        # ensure all numeric prefixes are integers (no '.' or exponent)
        for num, _ in terms:
            if any(ch in num for ch in ".eE"):
                raise ValueError("integer addition requires integer literals")

        values = []
        try:
            for num, _ in terms:
                values.append(int(num, 10))
        except ValueError:
            raise ValueError("invalid integer literal")

        # negative unsigned check
        if kind == "u" and any(v < 0 for v in values):
            raise ValueError("negative unsigned literal not allowed")

        # apply '*' precedence first across values
        stack = [values[0]]
        new_ops = []
        for i, op in enumerate(ops):
            if op == "*":
                stack[-1] = stack[-1] * values[i + 1]
            else:
                new_ops.append(op)
                stack.append(values[i + 1])

        result = stack[0]
        for i, op in enumerate(new_ops):
            if op == "+":
                result += stack[i + 1]
            else:
                result -= stack[i + 1]

        if kind == "u":
            max_val = (1 << bits) - 1
            if result < 0 or result > max_val:
                raise ValueError("unsigned literal out of range")
        else:
            max_pos = (1 << (bits - 1)) - 1
            min_neg = -(1 << (bits - 1))
            if result < min_neg or result > max_pos:
                raise ValueError("signed literal out of range")

        return str(result)

        # Accept cases where either operand has an integer suffix and the
        # other is unsuffixed. Extract type/width for each operand and
        # enforce that the resulting effective types match.
        m_left_bits = (
            re.match(r"^[ui](\d+)", left_suffix, re.IGNORECASE) if left_suffix else None
        )
        m_right_bits = (
            re.match(r"^[ui](\d+)", suffix2, re.IGNORECASE) if suffix2 else None
        )

        # If neither side has a suffix, treat this as a plain integer addition
        # (e.g., "1 + 2"). Require integer-like prefixes and return the sum.
        if not (m_left_bits or m_right_bits):
            if any(ch in prefix for ch in ".eE") or any(ch in prefix2 for ch in ".eE"):
                raise ValueError("integer addition requires integer literals")

            try:
                v1 = int(prefix, 10)
                v2 = int(prefix2, 10)
            except ValueError:
                raise ValueError("invalid integer literal")

            return str(v1 + v2)

        # determine effective kind/bits: prefer explicit, otherwise inherit
        if m_left_bits:
            kind = left_suffix[0].lower()
            bits = int(m_left_bits.group(1))
        else:
            kind = suffix2[0].lower()
            bits = int(m_right_bits.group(1))

        # if both sides have explicit suffixes they must match
        if m_left_bits and m_right_bits:
            if left_suffix[0].lower() != suffix2[0].lower() or int(
                m_left_bits.group(1)
            ) != int(m_right_bits.group(1)):
                raise ValueError("mismatched operand types")

        # ensure integer prefixes (no '.' or exponent)
        if any(ch in prefix for ch in ".eE") or any(ch in prefix2 for ch in ".eE"):
            raise ValueError("integer addition requires integer literals")

        try:
            v1 = int(prefix, 10)
            v2 = int(prefix2, 10)
        except ValueError:
            raise ValueError("invalid integer literal")

        # check negative unsigned (already validated for left, validate right)
        if kind == "u" and (v1 < 0 or v2 < 0):
            raise ValueError("negative unsigned literal not allowed")

        result = v1 + v2

        if kind == "u":
            max_val = (1 << bits) - 1
            if result < 0 or result > max_val:
                raise ValueError("unsigned literal out of range")
        else:
            max_pos = (1 << (bits - 1)) - 1
            min_neg = -(1 << (bits - 1))
            if result < min_neg or result > max_pos:
                raise ValueError("signed literal out of range")

        return str(result)

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
