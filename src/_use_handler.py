import re


def try_handle_use_statement(s: str, env: dict) -> str | None:
    """If s begins with a use statement, load the module/binding from __mapping__
    and return the trailing remainder. Otherwise return None.

    Supports:
    - `from lib use { x };` - loads lib module and extracts binding x into current scope
    - `from lib use { x, y };` - extracts multiple bindings
    """
    stripped = s.lstrip()
    if not stripped.startswith("from "):
        return None

    # Parse: from module use { binding1, binding2, ... };
    m = re.match(
        r"^\s*from\s+([A-Za-z_]\w*)\s+use\s*\{([^}]+)\}\s*;?\s*(.*)", s, re.DOTALL
    )
    if not m:
        raise ValueError("invalid use statement")

    module_name = m.group(1)
    bindings_str = m.group(2)
    remainder = m.group(3)

    # Parse the bindings list
    binding_names = [b.strip() for b in bindings_str.split(",") if b.strip()]

    # Get mapping from env
    mapping = env.get("__mapping__", {})
    if module_name not in mapping:
        raise ValueError(f"module '{module_name}' not found in mapping")

    # Load the module by interpreting it
    from .interpret import interpret

    module_code = mapping[module_name]
    # Create a child env to evaluate the module in isolation
    module_env = {"__mapping__": mapping, "__exported__": set()}
    interpret(module_code, module_env)

    # Extract the bindings from the module's environment
    exported = module_env.get("__exported__", set())
    for binding_name in binding_names:
        if binding_name not in module_env:
            raise ValueError(
                f"binding '{binding_name}' not found in module '{module_name}'"
            )

        if binding_name not in exported:
            raise ValueError(
                f"binding '{binding_name}' is not exported from module '{module_name}'"
            )

        # Copy the binding into the current environment
        env[binding_name] = module_env[binding_name]

    # Return the remainder for further processing
    return remainder if remainder else ""
