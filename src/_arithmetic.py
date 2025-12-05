"""
Arithmetic expression evaluation helpers for the interpreter.
"""
import re


_LEADING_NUMBER = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?")


def evaluate_arithmetic(s: str, env: dict) -> str:
    """
    Evaluate arithmetic expressions with +, -, * operators.
    
    Parses multi-term expressions, respects operator precedence (* before +/-),
    and validates type consistency (all suffixes must match).
    
    Returns the evaluated result as a string.
    """
    m = _LEADING_NUMBER.match(s)
    if not m:
        return None  # Not an arithmetic expression
    
    prefix = m.group(0)
    suffix = s[len(prefix) :]

    if not ("+" in suffix or "-" in suffix or "*" in suffix):
        return None  # No operators, not arithmetic

    # Parse a sequence of terms (number + optional suffix) separated by operators.
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
