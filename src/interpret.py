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
                m = re.match(r"let\s+([A-Za-z_]\w*)\s*:\s*([uUiI]\d+)\s*=\s*(.+)", part)
                if not m:
                    raise ValueError("invalid let statement")
                name = m.group(1)
                type_spec = m.group(2)
                init_expr = m.group(3).strip()
                val_str = interpret(init_expr, env)
                try:
                    val = int(val_str, 10)
                except ValueError:
                    raise ValueError("invalid initializer for variable")

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

                env[name] = (val, kind, bits)
                # `let` statements don't produce a visible value when they are
                # the final statement; return an empty string for those.
                last = ""
            else:
                last = interpret(part, env)

        return last if last is not None else ""

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
