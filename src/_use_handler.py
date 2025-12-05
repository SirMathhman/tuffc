import re


def try_handle_use_statement(s: str, env: dict) -> str | None:
    """If s begins with a use statement, load the module/binding from __mapping__
    and return the trailing remainder. Otherwise return None.

    Supports:
    - `from lib use { x };` - loads lib module and extracts binding x into current scope
    - `from lib use { x, y };` - extracts multiple bindings
    - `from lib { arg } use x;` - passes arg to module as input parameter
    - `from lib { arg1, arg2 } use { x, y };` - multiple args and imports
    """
    stripped = s.lstrip()
    if not stripped.startswith("from "):
        return None

    # Parse: from module { arg1, arg2, ... } use { binding1, binding2, ... };
    # or: from module { arg1, arg2, ... } use binding1, binding2, ... ;
    # or: from module use { binding1, binding2, ... };
    # Try with curly braces around bindings first
    m = re.match(
        r"^\s*from\s+([A-Za-z_]\w*)(?:\s*\{([^}]*)\})?\s+use\s*\{([^}]+)\}\s*;?\s*(.*)",
        s,
        re.DOTALL,
    )
    if m:
        module_name = m.group(1)
        args_str = m.group(2)
        bindings_str = m.group(3)
        remainder = m.group(4)
    else:
        # Try without curly braces around bindings (e.g., `use x` or `use x, y`)
        m = re.match(
            r"^\s*from\s+([A-Za-z_]\w*)(?:\s*\{([^}]*)\})?\s+use\s+([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*;?\s*(.*)",
            s,
            re.DOTALL,
        )
        if not m:
            raise ValueError("invalid use statement")
        
        module_name = m.group(1)
        args_str = m.group(2)
        bindings_str = m.group(3)
        remainder = m.group(4)

    # Parse the arguments list (if provided)
    module_args = []
    if args_str:
        module_args = [a.strip() for a in args_str.split(",") if a.strip()]

    # Parse the bindings list
    binding_names = [b.strip() for b in bindings_str.split(",") if b.strip()]

    # Get mapping from env
    mapping = env.get("__mapping__", {})
    if module_name not in mapping:
        raise ValueError(f"module '{module_name}' not found in mapping")

    # Load the module by interpreting it
    from .interpret import interpret

    module_code = mapping[module_name]
    
    # First pass: interpret to collect input declarations
    # During this pass, the in_handler will bind dummy values (0) for input variables
    # so that other statements in the module don't fail
    module_env = {"__mapping__": mapping, "__exported__": set(), "__inputs__": {}}
    interpret(module_code, module_env)
    
    # Bind input parameters from provided arguments
    inputs = module_env.get("__inputs__", {})
    input_names = list(inputs.keys())
    
    if len(module_args) != len(input_names):
        raise ValueError(
            f"module '{module_name}' expects {len(input_names)} input(s), "
            f"got {len(module_args)}"
        )
    
    # Second pass: create fresh environment with input variables bound
    module_env = {"__mapping__": mapping, "__exported__": set(), "__inputs__": inputs}
    
    # Evaluate arguments in the current environment and bind as module variables
    for input_name, arg_expr in zip(input_names, module_args):
        arg_val_str = interpret(arg_expr, env)
        try:
            arg_val = int(arg_val_str, 10)
        except ValueError:
            raise ValueError(f"invalid module input argument: {arg_expr}")
        
        input_type = inputs[input_name]
        kind = input_type[0].lower()
        bits = int(input_type[1:]) if len(input_type) > 1 else None
        module_env[input_name] = (arg_val, kind, bits, False)
    
    # Now interpret the module code with inputs available
    interpret(module_code, module_env)

    # Extract the bindings from the module's environment
    # Only extract if it was marked as exported with 'out'
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
