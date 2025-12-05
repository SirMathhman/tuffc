import re


_SUFFIX_RE = re.compile(r"^([+-]?\d+)(?:U8|U16|U32|U64|I8|I16|I32|I64)$")


def interpret(s: str) -> str:
    """Return the input string unchanged except strip case-sensitive integer
    type suffixes.

    Behavior:
    - Trims surrounding whitespace then checks for a whole-string match of a
      signed/unsigned integer followed immediately by one of the case-sensitive
      suffixes: U8, U16, U32, U64, I8, I16, I32, I64.
    - If matched, returns just the numeric portion (preserving leading sign).
    - Otherwise returns the original input unchanged.

    Examples:
        interpret("100U8") -> "100"
        interpret("  -42I32 ") -> "-42"
        interpret("100u8") -> "100u8"  # not stripped (case-sensitive)
    """
    if not isinstance(s, str):
        return s

    ts = s.strip()
    m = _SUFFIX_RE.match(ts)
    if m:
        return m.group(1)
    return s
