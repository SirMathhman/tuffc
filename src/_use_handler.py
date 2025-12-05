import re


def try_handle_use_statement(s: str, env: dict) -> str | None:
    """If s begins with a use statement, load the module/binding from __mapping__
    and return the trailing remainder. Otherwise return None.

    Supports:
    - `use lib::x;` - loads lib module and extracts binding x into current scope
    """
    stripped = s.lstrip()
    if not stripped.startswith("use "):
        return None

    # Parse: use module::binding;
    m = re.match(
        r"^\s*use\s+([A-Za-z_]\w*)::\s*([A-Za-z_]\w*)\s*;?\s*(.*)", s, re.DOTALL
    )
    if not m:
        raise ValueError("invalid use statement")

    module_name = m.group(1)
    binding_name = m.group(2)
    remainder = m.group(3)

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

    # Extract the binding from the module's environment
    # Only extract if it was marked as exported with 'out'
    if binding_name not in module_env:
        raise ValueError(
            f"binding '{binding_name}' not found in module '{module_name}'"
        )

    exported = module_env.get("__exported__", set())
    if binding_name not in exported:
        raise ValueError(
            f"binding '{binding_name}' is not exported from module '{module_name}'"
        )

    # Copy the binding into the current environment
    env[binding_name] = module_env[binding_name]

    # Return the remainder for further processing
    return remainder if remainder else ""
