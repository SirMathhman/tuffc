import re


def handle_out_keyword(part: str, env: dict) -> str | None:
    """Handle 'out' keyword for exporting variables from modules.
    
    Returns the remainder to process, or None if this wasn't an 'out' statement.
    """
    if not part.startswith("out "):
        return None

    # Mark the following statement as exported
    exported = env.get("__exported__", set())
    remainder = part[4:].strip()  # Remove 'out ' prefix

    # Extract the variable name from the remainder
    if remainder.startswith("let "):
        # Parse: out let name = ...
        m_out = re.match(
            r"let\s+(?:mut\s+)?([A-Za-z_]\w*)\s*(?::\s*\*?(?:mut\s+)?[uUiI]\d+)?\s*=",
            remainder,
        )
        if m_out:
            var_name = m_out.group(1)
            exported.add(var_name)
            env["__exported__"] = exported

    return remainder
