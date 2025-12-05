import re


_LEADING_NUMBER = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?")


def interpret(s: str) -> str:
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

    m = _LEADING_NUMBER.match(s)
    if not m:
        return s

    prefix = m.group(0)
    suffix = s[len(prefix) :]

    # Support simple two-term integer addition like "100U32 + 200U32".
    # If there's a plus sign after the first operand's suffix, parse the
    # right-hand operand and compute the result when both sides have
    # matching integer suffixes (same signedness and width).
    if "+" in suffix:
        # Parse a sequence of terms (number + optional suffix) separated by '+'.
        # Collect (num_str, suffix_str) for each term.
        terms = []
        pos = 0
        s_rest = s
        while True:
            # skip leading whitespace between terms
            while pos < len(s_rest) and s_rest[pos].isspace():
                pos += 1

            mterm = _LEADING_NUMBER.match(s_rest[pos:])
            if not mterm:
                raise ValueError("invalid operand in addition")

            num = mterm.group(0)
            pos += mterm.end()

            # find next '+' in the remaining chunk
            rest = s_rest[pos:]
            plus_idx = rest.find("+")
            if plus_idx == -1:
                term_suffix = rest
                terms.append((num, term_suffix.strip()))
                break
            else:
                term_suffix = rest[:plus_idx]
                terms.append((num, term_suffix.strip()))
                # advance pos beyond '+' and continue parsing next term
                pos += plus_idx + 1

        # If none of the terms carry a [ui]<bits> suffix, perform plain integer sum.
        explicit = [
            t for t in terms if re.match(r"^[ui]\d+", t[1].strip(), re.IGNORECASE)
        ]
        if not explicit:
            # ensure all are integer-like prefixes
            for num, _suf in terms:
                if any(ch in num for ch in ".eE"):
                    raise ValueError("integer addition requires integer literals")
            total = sum(int(num, 10) for num, _ in terms)
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

        result = sum(values)

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
