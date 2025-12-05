import re


def handle_in_keyword(part: str, env: dict) -> str | None:
    """Handle 'in' keyword for declaring input parameters to modules.

    Returns the remainder to process, or None if this wasn't an 'in' statement.
    """
    if not part.startswith("in "):
        return None

    # Mark the following statement as an input parameter
    inputs = env.get("__inputs__", {})
    remainder = part[3:].strip()  # Remove 'in ' prefix

    # Extract the variable name from the remainder
    # Parse: in let name : Type;
    if remainder.startswith("let "):
        m_in = re.match(
            r"let\s+([A-Za-z_]\w*)\s*:\s*(\*?(?:mut\s+)?[uUiI]\d+)\s*;?",
            remainder,
        )
        if m_in:
            var_name = m_in.group(1)
            var_type = m_in.group(2)
            inputs[var_name] = var_type
            env["__inputs__"] = inputs
            # Consume the entire 'in let' declaration
            return ""

    return remainder
