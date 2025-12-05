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
