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
        plus_pos = suffix.find("+")
        left_suffix = suffix[:plus_pos].strip()
        right_part = suffix[plus_pos + 1 :].strip()

        # rebuild exact operand strings
        left_full = prefix + left_suffix

        # parse second operand's leading number and suffix
        m2 = _LEADING_NUMBER.match(right_part)
        if not m2:
            raise ValueError("invalid right-hand operand")

        prefix2 = m2.group(0)
        suffix2 = right_part[len(prefix2) :]

        # both operands must use integer suffixes
        if not (left_suffix and left_suffix[0].lower() in ("u", "i") and suffix2 and suffix2[0].lower() in ("u", "i")):
            raise ValueError("both operands must be integer-suffixed")

        m_left_bits = re.match(r"^[ui](\d+)", left_suffix, re.IGNORECASE)
        m_right_bits = re.match(r"^[ui](\d+)", suffix2, re.IGNORECASE)
        if not (m_left_bits and m_right_bits):
            raise ValueError("invalid integer width in operands")

        # must match type and width
        if left_suffix[0].lower() != suffix2[0].lower() or int(m_left_bits.group(1)) != int(m_right_bits.group(1)):
            raise ValueError("mismatched operand types")

        # ensure integer prefixes (no '.' or exponent)
        if any(ch in prefix for ch in ".eE") or any(ch in prefix2 for ch in ".eE"):
            raise ValueError("integer addition requires integer literals")

        bits = int(m_left_bits.group(1))

        try:
            v1 = int(prefix, 10)
            v2 = int(prefix2, 10)
        except ValueError:
            raise ValueError("invalid integer literal")

        # check negative unsigned (already validated for left, validate right)
        if left_suffix[0].lower() == "u" and (v1 < 0 or v2 < 0):
            raise ValueError("negative unsigned literal not allowed")

        result = v1 + v2

        if left_suffix[0].lower() == "u":
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
