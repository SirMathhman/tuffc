use std::collections::HashMap;
use std::io::{self, Write};

#[derive(Debug)]
struct InterpreterError {
    code_snippet: String,
    error_message: String,
    explanation: String,
    fix: String,
}

#[derive(Debug, Clone)]
struct Context {
    variables: HashMap<String, (i32, String, bool)>, // (value, type, is_mutable)
}

impl Context {
    fn new() -> Self {
        Context {
            variables: HashMap::new(),
        }
    }

    fn with_var(mut self, name: String, value: i32, var_type: String, is_mutable: bool) -> Self {
        self.variables.insert(name, (value, var_type, is_mutable));
        self
    }

    fn get_var(&self, name: &str) -> Option<(i32, String)> {
        self.variables
            .get(name)
            .map(|(val, ty, _)| (*val, ty.clone()))
    }

    fn set_var(
        &mut self,
        name: String,
        value: i32,
        value_type: &str,
    ) -> Result<(), InterpreterError> {
        if let Some((_, ty, is_mutable)) = self.variables.get(&name) {
            if !is_mutable {
                return Err(InterpreterError {
                    code_snippet: format!("{} = {}", name, value),
                    error_message: format!("Cannot assign to immutable variable '{}'", name),
                    explanation: "Variables declared without the 'mut' keyword are immutable and cannot be reassigned.".to_string(),
                    fix: "Declare the variable with 'mut' keyword, e.g., 'let mut x = 0;'".to_string(),
                });
            }

            // Check for type narrowing
            let target_width = get_type_width(ty);
            let source_width = get_type_width(value_type);
            if source_width > target_width {
                return Err(InterpreterError {
                    code_snippet: format!("{} = {};", name, value),
                    error_message: format!("Cannot assign {} to {}", value_type, ty),
                    explanation: "Narrowing type conversions are not allowed.".to_string(),
                    fix: "Use a larger target type or change the source type.".to_string(),
                });
            }

            let ty_clone = ty.clone();
            self.variables.insert(name, (value, ty_clone, true));
            Ok(())
        } else {
            Err(InterpreterError {
                code_snippet: format!("{} = {}", name, value),
                error_message: format!("Undefined variable '{}'", name),
                explanation: "The variable has not been declared in the current scope.".to_string(),
                fix: "Declare the variable with a 'let' statement before assigning to it."
                    .to_string(),
            })
        }
    }
}

fn validate_and_parse_with_suffix(
    input: &str,
    suffix: &str,
    min: i32,
    max: i32,
    is_unsigned: bool,
) -> Option<Result<i32, InterpreterError>> {
    let without_suffix = input.strip_suffix(suffix)?;

    if is_unsigned && without_suffix.starts_with('-') {
        return Some(Err(InterpreterError {
            code_snippet: input.to_string(),
            error_message: "Negative value with unsigned type suffix".to_string(),
            explanation: "Unsigned types (U8, U16, U32, U64) cannot represent negative numbers. The language semantics require unsigned types to only hold non-negative values.".to_string(),
            fix: "Use a signed type suffix (I8, I16, I32, I64) for negative numbers, or remove the negative sign.".to_string(),
        }));
    }

    match without_suffix.parse::<i32>() {
        Ok(val) => {
            if val < min || val > max {
                Some(Err(InterpreterError {
                    code_snippet: input.to_string(),
                    error_message: format!("Value {} is out of range for type {}", val, suffix),
                    explanation: format!("The {} type can only hold values between {} and {} (inclusive). The language semantics enforce these bounds to prevent data loss.", suffix, min, max),
                    fix: format!("Use a larger type that can accommodate this value, or use a value in the range [{}, {}].", min, max),
                }))
            } else {
                Some(Ok(val))
            }
        }
        Err(_) => None,
    }
}

fn extract_value_and_type(
    input: &str,
    context: &Context,
) -> Result<(i32, String), InterpreterError> {
    // Check if it's a variable reference
    let trimmed = input.trim();
    if !trimmed.chars().any(|c| {
        c.is_whitespace() || matches!(c, '+' | '-' | '*' | '/' | '(' | ')' | '{' | '}' | ':')
    }) {
        if let Some((val, var_type)) = context.get_var(trimmed) {
            return Ok((val, var_type));
        }
    }

    // Try parsing as boolean first
    if trimmed == "true" {
        return Ok((1, "Bool".to_string()));
    }
    if trimmed == "false" {
        return Ok((0, "Bool".to_string()));
    }

    // Try parsing as a plain integer first
    if let Ok(val) = input.parse::<i32>() {
        return Ok((val, "I32".to_string()));
    }

    // Try parsing with type suffixes (e.g., "100U8", "42I32")
    let all_suffixes = [
        ("U8", 0i32, 255i32),
        ("U16", 0, 65535),
        ("U32", 0, u32::MAX as i32),
        ("U64", 0, i32::MAX),
        ("I8", -128i32, 127i32),
        ("I16", -32768, 32767),
        ("I32", i32::MIN, i32::MAX),
        ("I64", i32::MIN, i32::MAX),
    ];

    for (suffix, min, max) in &all_suffixes {
        let is_unsigned = suffix.starts_with('U');
        if let Some(result) = validate_and_parse_with_suffix(input, suffix, *min, *max, is_unsigned)
        {
            match result {
                Ok(val) => return Ok((val, suffix.to_string())),
                Err(e) => return Err(e),
            }
        }
    }

    Err(InterpreterError {
        code_snippet: input.to_string(),
        error_message: "Failed to parse input as integer".to_string(),
        explanation: "The input could not be parsed as a valid integer, optionally with a type suffix (U8, U16, U32, U64, I8, I16, I32, I64).".to_string(),
        fix: "Provide a valid integer value, optionally with a type suffix.".to_string(),
    })
}

fn extract_if_else_type(input: &str, context: &Context) -> Option<String> {
    if let Some((_condition, true_expr, false_expr)) = parse_if_else_parts(input) {
        // Extract type from true branch
        let true_type = if let Ok((_, ty)) = extract_value_and_type(&true_expr, context) {
            ty
        } else {
            "I32".to_string()
        };

        // Extract type from false branch
        let false_type = if let Ok((_, ty)) = extract_value_and_type(&false_expr, context) {
            ty
        } else {
            "I32".to_string()
        };

        // Return type if they match (already validated by if-else handler)
        if true_type == false_type {
            return Some(true_type);
        }
    }
    None
}

fn get_type_bounds(type_name: &str) -> Option<(i32, i32)> {
    match type_name {
        "U8" => Some((0, 255)),
        "U16" => Some((0, 65535)),
        "U32" => Some((0, u32::MAX as i32)),
        "U64" => Some((0, i32::MAX)),
        "I8" => Some((-128, 127)),
        "I16" => Some((-32768, 32767)),
        "I32" => Some((i32::MIN, i32::MAX)),
        "I64" => Some((i32::MIN, i32::MAX)),
        "Bool" => Some((0, 1)),
        _ => None,
    }
}

fn get_type_width(type_name: &str) -> u8 {
    match type_name {
        "I8" | "U8" => 8,
        "I16" | "U16" => 16,
        "I32" | "U32" => 32,
        "I64" | "U64" => 64,
        "Bool" => 1,
        _ => 0,
    }
}

fn is_valid_type(type_name: &str) -> bool {
    matches!(
        type_name,
        "U8" | "U16" | "U32" | "U64" | "I8" | "I16" | "I32" | "I64" | "Bool"
    )
}

fn get_effective_type<'a>(left_type: &'a str, right_type: &'a str) -> &'a str {
    // If one operand is default I32 (untyped), use the other's type
    match (left_type, right_type) {
        ("I32", other) if other != "I32" => other,
        (other, "I32") if other != "I32" => other,
        _ => get_wider_type(left_type, right_type),
    }
}

fn get_wider_type<'a>(left_type: &'a str, right_type: &'a str) -> &'a str {
    let left_width = get_type_width(left_type);
    let right_width = get_type_width(right_type);

    if right_width > left_width {
        right_type
    } else {
        left_type
    }
}

fn validate_result_in_type(
    result: i32,
    type_name: &str,
    code_snippet: &str,
) -> Result<i32, InterpreterError> {
    if let Some((min, max)) = get_type_bounds(type_name) {
        if result < min || result > max {
            return Err(InterpreterError {
                code_snippet: code_snippet.to_string(),
                error_message: format!("Arithmetic overflow: result {} is out of range for type {}", result, type_name),
                explanation: format!("The {} type can only hold values between {} and {} (inclusive). The arithmetic operation produced a result outside this range, causing an overflow. The language semantics enforce these bounds to prevent data loss.", type_name, min, max),
                fix: format!("Use a larger type for the operation, or adjust the operands to produce a result in the range [{}, {}].", min, max),
            });
        }
    }
    Ok(result)
}

fn apply_operation(
    left_val: i32,
    left_type: &str,
    op_char: char,
    right_val: i32,
    right_type: &str,
    code_snippet: &str,
) -> Result<i32, InterpreterError> {
    // Check that operands are not boolean types
    if left_type == "Bool" || right_type == "Bool" {
        return Err(InterpreterError {
            code_snippet: code_snippet.to_string(),
            error_message: "Cannot use boolean values in arithmetic operations".to_string(),
            explanation: "Boolean values (true/false) cannot be used as operands in arithmetic operations (+, -, *, /).".to_string(),
            fix: "Use integer or other numeric types instead of boolean types.".to_string(),
        });
    }

    let result_val = match op_char {
        '+' => left_val + right_val,
        '-' => left_val - right_val,
        '*' => left_val * right_val,
        '/' => {
            if right_val == 0 {
                return Err(InterpreterError {
                    code_snippet: code_snippet.to_string(),
                    error_message: "Division by zero".to_string(),
                    explanation: "Dividing by zero is undefined in mathematics and not allowed in this language.".to_string(),
                    fix: "Use a non-zero divisor.".to_string(),
                });
            }
            left_val / right_val
        }
        _ => return Ok(left_val),
    };

    // Use the effective type for validation
    let result_type = get_effective_type(left_type, right_type);
    validate_result_in_type(result_val, result_type, code_snippet)
}

fn find_at_depth_zero<F>(input: &str, mut predicate: F) -> Option<(usize, char)>
where
    F: FnMut(char, usize) -> bool,
{
    let mut paren_depth = 0;
    let mut brace_depth = 0;

    for (pos, ch) in input.char_indices() {
        match ch {
            '(' => paren_depth += 1,
            ')' => paren_depth -= 1,
            '{' => brace_depth += 1,
            '}' => brace_depth -= 1,
            _ => {
                if paren_depth == 0 && brace_depth == 0 && predicate(ch, pos) {
                    return Some((pos, ch));
                }
            }
        }
    }

    None
}

fn find_char_at_depth_zero(input: &str, target_char: char) -> Option<usize> {
    find_at_depth_zero(input, |ch, _pos| ch == target_char).map(|(pos, _)| pos)
}

fn find_operator_at_depth(
    input: &str,
    operators: &[char],
    exclude_unary_minus: bool,
) -> Option<(usize, char)> {
    let operators_copy = operators.to_vec();
    find_at_depth_zero(input, move |ch, pos| {
        if !operators_copy.contains(&ch) {
            return false;
        }
        if exclude_unary_minus
            && ch == '-'
            && (pos == 0 || input[..pos].trim().ends_with(['+', '-', '*', '/']))
        {
            return false;
        }
        true
    })
}

fn find_lowest_precedence_operator(input: &str) -> Option<(usize, char)> {
    // First pass: look for low-precedence operators (+ and -) outside parentheses and braces
    if let Some(result) = find_operator_at_depth(input, &['+', '-'], true) {
        return Some(result);
    }

    // Second pass: look for high-precedence operators (* and /) outside parentheses and braces
    find_operator_at_depth(input, &['*', '/'], false)
}

fn find_is_operator(input: &str) -> Option<usize> {
    find_at_depth_zero(input, |ch, pos| {
        if ch == ' ' && pos + 4 <= input.len() {
            let after_space = &input[pos + 1..];
            after_space.starts_with("is ")
        } else {
            false
        }
    })
    .map(|(pos, _)| pos)
}

fn find_if_keyword(input: &str) -> Option<usize> {
    find_at_depth_zero(input, |_ch, pos| {
        if (pos == 0 || input[..pos].ends_with(' ')) && pos + 3 <= input.len() {
            let from_pos = if pos == 0 { 0 } else { pos + 1 };
            input[from_pos..].starts_with("if ")
        } else {
            false
        }
    })
    .map(|(pos, _)| if pos == 0 { 0 } else { pos + 1 })
}

fn find_else_keyword(input: &str) -> Option<usize> {
    find_at_depth_zero(input, |ch, pos| {
        if ch == ' ' && pos + 5 <= input.len() {
            let after_space = &input[pos + 1..];
            after_space.starts_with("else ")
        } else {
            false
        }
    })
    .map(|(pos, _)| pos)
}

fn parse_if_else_parts(input: &str) -> Option<(String, String, String)> {
    let trimmed = input.trim();
    if let Some(if_pos) = find_if_keyword(trimmed) {
        if if_pos == 0 || trimmed[..if_pos].ends_with(' ') {
            let after_if = if if_pos == 0 { 3 } else { if_pos + 3 };
            let rest = trimmed[after_if..].trim();

            if rest.starts_with('(') {
                // Find the matching closing paren
                let mut paren_depth = 0;
                let mut cond_end = None;
                for (i, ch) in rest.char_indices() {
                    match ch {
                        '(' => paren_depth += 1,
                        ')' => {
                            paren_depth -= 1;
                            if paren_depth == 0 {
                                cond_end = Some(i);
                                break;
                            }
                        }
                        _ => {}
                    }
                }

                if let Some(cond_end_pos) = cond_end {
                    let condition_str = rest[1..cond_end_pos].trim();
                    let after_cond = rest[cond_end_pos + 1..].trim();

                    // Check if there's an else keyword
                    if let Some(else_pos) = find_else_keyword(after_cond) {
                        let true_expr = after_cond[..else_pos].trim();
                        let else_part = after_cond[else_pos + 1..].trim();

                        if let Some(false_expr_start) = else_part.strip_prefix("else ") {
                            // Find the semicolon that ends the false branch
                            if let Some(semi_pos) = find_char_at_depth_zero(false_expr_start, ';') {
                                // Include the semicolon in the false expression
                                let false_expr = &false_expr_start[..=semi_pos];
                                return Some((
                                    condition_str.to_string(),
                                    true_expr.to_string(),
                                    false_expr.trim().to_string(),
                                ));
                            } else {
                                // If no semicolon, take the whole thing
                                return Some((
                                    condition_str.to_string(),
                                    true_expr.to_string(),
                                    false_expr_start.trim().to_string(),
                                ));
                            }
                        }
                    } else {
                        // No else clause - find the end of the true branch
                        // The true branch ends at a semicolon or space followed by non-if content
                        if let Some(semi_pos) = find_char_at_depth_zero(after_cond, ';') {
                            let true_expr = after_cond[..semi_pos].trim();
                            return Some((
                                condition_str.to_string(),
                                true_expr.to_string(),
                                "0".to_string(), // Default false branch returns 0
                            ));
                        } else {
                            // No semicolon - take the whole thing as true branch
                            return Some((
                                condition_str.to_string(),
                                after_cond.to_string(),
                                "0".to_string(), // Default false branch returns 0
                            ));
                        }
                    }
                }
            }
        }
    }
    None
}

fn is_narrowing_conversion(value_expr: &str, target_type: &str) -> Result<(), (String, String)> {
    let target_width = get_type_width(target_type);

    let type_suffixes = [
        ("U64", 64),
        ("I64", 64),
        ("U32", 32),
        ("I32", 32),
        ("U16", 16),
        ("I16", 16),
        ("U8", 8),
        ("I8", 8),
    ];

    for (suffix, width) in &type_suffixes {
        if value_expr.contains(suffix) && *width > target_width {
            return Err((suffix.to_string(), target_type.to_string()));
        }
    }

    Ok(())
}

fn is_fully_wrapped(input: &str) -> bool {
    if (!input.starts_with('(') && !input.starts_with('{'))
        || (!input.ends_with(')') && !input.ends_with('}'))
    {
        return false;
    }

    // Check that delimiters don't close before the end
    let mut paren_depth = 0;
    let mut brace_depth = 0;
    let len = input.len();

    for (i, ch) in input.char_indices() {
        match ch {
            '(' => paren_depth += 1,
            ')' => {
                paren_depth -= 1;
                if paren_depth == 0 && brace_depth == 0 && i < len - 1 {
                    return false;
                }
            }
            '{' => brace_depth += 1,
            '}' => {
                brace_depth -= 1;
                if paren_depth == 0 && brace_depth == 0 && i < len - 1 {
                    return false;
                }
            }
            _ => {}
        }
    }
    true
}

fn interpret_with_context(input: &str, mut context: Context) -> Result<i32, InterpreterError> {
    let input = input.trim();

    // Strip outer parentheses or braces if they wrap the entire expression
    let input = if is_fully_wrapped(input) {
        input[1..input.len() - 1].trim()
    } else {
        input
    };

    // If empty after stripping, return 0
    if input.is_empty() {
        return Ok(0);
    }

    // Handle case: expression followed by space and let statement, like "{} let x = 0; x"
    // First check if we have a pattern like "something let " where something doesn't contain let
    if !input.starts_with("let ") {
        if let Some(space_let_pos) = input.find(" let ") {
            let before_let = input[..space_let_pos].trim();
            let after_space = input[space_let_pos + 1..].trim(); // Skip the space

            // Try to evaluate the part before "let" as a standalone expression
            if let Ok(_val) = interpret_with_context(before_let, context.clone()) {
                // Successfully evaluated the expression before "let", now evaluate the rest
                return interpret_with_context(after_space, context);
            }
        }
    }

    // Handle case: fully wrapped expression followed by space, like "{} x" or "{ x = 100; } x"
    // Check if input starts with a fully wrapped expression followed by space
    if !input.starts_with("let ") && (input.starts_with('{') || input.starts_with('(')) {
        // Find where the wrapping expression ends
        let mut depth_paren = 0;
        let mut depth_brace = 0;
        let mut wrapped_end = None;

        for (pos, ch) in input.char_indices() {
            match ch {
                '(' => depth_paren += 1,
                ')' => {
                    depth_paren -= 1;
                    if depth_paren == 0 && depth_brace == 0 && pos > 0 {
                        wrapped_end = Some(pos);
                        break;
                    }
                }
                '{' => depth_brace += 1,
                '}' => {
                    depth_brace -= 1;
                    if depth_paren == 0 && depth_brace == 0 && pos > 0 {
                        wrapped_end = Some(pos);
                        break;
                    }
                }
                _ => {}
            }
        }

        if let Some(end_pos) = wrapped_end {
            let remaining = input[end_pos + 1..].trim();
            // Only proceed if there's remaining content and it's not starting with an operator
            if !remaining.is_empty()
                && !remaining
                    .chars()
                    .next()
                    .is_some_and(|c| matches!(c, '+' | '-' | '*' | '/' | ';'))
            {
                let wrapped_expr = &input[..=end_pos];
                // Evaluate the wrapped expression AND the remaining content as a sequence
                // by concatenating them with a semicolon
                let sequence_to_eval = format!("{}; {}", wrapped_expr, remaining);
                return interpret_with_context(&sequence_to_eval, context);
            }
        }
    }

    // Handle let statements: let [mut] name : type = expr; rest
    if input.starts_with("let ") {
        // Find the semicolon that separates the let statement from the rest
        let semicolon_pos = find_char_at_depth_zero(input, ';').ok_or_else(|| InterpreterError {
            code_snippet: input.to_string(),
            error_message: "Let statement must end with semicolon".to_string(),
            explanation: "Variable declarations must be followed by a semicolon and then the expression to evaluate.".to_string(),
            fix: "Add a semicolon after the variable assignment.".to_string(),
        })?;

        let let_part = input[4..semicolon_pos].trim(); // Skip "let "
        let rest = input[semicolon_pos + 1..].trim();

        // Check for mut keyword
        let (is_mutable, name_and_type_str) = if let Some(stripped) = let_part.strip_prefix("mut ")
        {
            (true, stripped.trim())
        } else {
            (false, let_part)
        };

        // Find the equals sign at depth 0 (outside braces and parens)
        let eq_pos =
            find_char_at_depth_zero(name_and_type_str, '=').ok_or_else(|| InterpreterError {
                code_snippet: input.to_string(),
                error_message: "Variable declaration must have an assignment".to_string(),
                explanation: "Format should be: let [mut] name : type = value;".to_string(),
                fix: "Add an assignment with = operator.".to_string(),
            })?;

        let name_and_type = name_and_type_str[..eq_pos].trim();
        let value_expr = name_and_type_str[eq_pos + 1..].trim();

        // Parse name : type (where type is optional)
        let (var_name, mut var_type) = if let Some(colon_pos) = name_and_type.find(':') {
            let name = name_and_type[..colon_pos].trim().to_string();
            let ty = name_and_type[colon_pos + 1..].trim().to_string();

            // Validate the type annotation
            if !is_valid_type(&ty) {
                return Err(InterpreterError {
                    code_snippet: input.to_string(),
                    error_message: format!("Unknown type '{}'", ty),
                    explanation: "The type must be one of: U8, U16, U32, U64, I8, I16, I32, I64."
                        .to_string(),
                    fix: "Use a valid type annotation or omit the type to let it be inferred."
                        .to_string(),
                });
            }

            (name, ty)
        } else {
            // No type annotation, default to I32 (will be refined after evaluating the expression)
            (name_and_type.to_string(), "I32".to_string())
        };

        // Evaluate the value expression to get both the value and its inferred type
        let ctx = context.clone();
        let val = interpret_with_context(value_expr, ctx)?;

        // If no explicit type annotation, infer it from the expression
        if !name_and_type.contains(':') {
            // Try to extract the type from the value expression
            if let Ok((_, inferred_type)) = extract_value_and_type(value_expr, &context) {
                var_type = inferred_type;
            }
        } else {
            // If explicit type annotation, check if-else expressions have matching type
            if let Some(if_else_type) = extract_if_else_type(value_expr, &context) {
                if if_else_type != var_type {
                    return Err(InterpreterError {
                        code_snippet: input.to_string(),
                        error_message: format!("Cannot assign {} to {}", if_else_type, var_type),
                        explanation: "The if-else expression returns a different type than the declared variable type.".to_string(),
                        fix: "Ensure the if-else branches return the declared type, or change the variable type annotation.".to_string(),
                    });
                }
            }
        }

        // Validate the value is within the type bounds of the declared type
        validate_result_in_type(val, &var_type, input)?;

        // Check for explicit type mismatch - disallow narrowing conversions from sized types
        if let Err((source_type, _)) = is_narrowing_conversion(value_expr, &var_type) {
            return Err(InterpreterError {
                code_snippet: input.to_string(),
                error_message: format!("Cannot assign {} to {}", source_type, var_type),
                explanation: "Narrowing type conversions are not allowed.".to_string(),
                fix: "Use a larger target type or change the source type.".to_string(),
            });
        }

        // Check if the value_expr is a simple variable reference, and if so, check its type
        let trimmed_expr = value_expr.trim();
        if !trimmed_expr
            .chars()
            .any(|c| matches!(c, '+' | '-' | '*' | '/' | '(' | ')' | '{' | '}'))
        {
            if let Some((_, var_value_type)) = context.get_var(trimmed_expr) {
                // Check if assigning this variable type to the target type is a narrowing conversion
                let source_width = get_type_width(&var_value_type);
                let target_width = get_type_width(&var_type);
                if source_width > target_width {
                    return Err(InterpreterError {
                        code_snippet: input.to_string(),
                        error_message: format!("Cannot assign {} to {}", var_value_type, var_type),
                        explanation: "Narrowing type conversions are not allowed.".to_string(),
                        fix: "Use a larger target type or change the source type.".to_string(),
                    });
                }
            }
        }

        // Check for duplicate variable declarations
        if context.get_var(&var_name).is_some() {
            return Err(InterpreterError {
                code_snippet: format!("let {} : {} = ...", var_name, var_type),
                error_message: format!("Variable '{}' is already defined", var_name),
                explanation:
                    "A variable with this name has already been declared in the current scope."
                        .to_string(),
                fix: "Use a different variable name or shadowing is not allowed.".to_string(),
            });
        }

        // Add the variable to context
        context = context.with_var(var_name, val, var_type, is_mutable);

        // If there's no rest, return 0 (empty expression)
        if rest.is_empty() {
            return Ok(0);
        }

        // Continue evaluating the rest
        return interpret_with_context(rest, context);
    }

    // Handle compound assignment expressions: variable += value; rest
    // Check for += operator before checking for simple =
    // Handle assignment expressions: variable = value; rest or variable += value; rest
    // Check for compound assignment (+=) first, then simple assignment (=)
    let assignment_info: Option<(&str, &str, bool)> = if input.contains("+=") {
        if let Some(plus_pos) = find_char_at_depth_zero(input, '+') {
            if plus_pos + 1 < input.len() && &input[plus_pos + 1..plus_pos + 2] == "=" {
                let left = input[..plus_pos].trim();
                let right_and_rest = input[plus_pos + 2..].trim();
                Some((left, right_and_rest, true))
            } else {
                None
            }
        } else {
            None
        }
    } else if let Some(eq_pos) = find_char_at_depth_zero(input, '=') {
        let left = input[..eq_pos].trim();
        let right_and_rest = input[eq_pos + 1..].trim();
        Some((left, right_and_rest, false))
    } else {
        None
    };

    if let Some((left, right_and_rest, is_compound)) = assignment_info {
        // Check if left side is a simple variable name
        if !left
            .chars()
            .any(|c| matches!(c, '+' | '-' | '*' | '/' | '(' | ')' | '{' | '}' | ';' | ':'))
            && !left.starts_with("let ")
        {
            // This is an assignment. Find the semicolon
            if let Some(semicolon_pos) = find_char_at_depth_zero(right_and_rest, ';') {
                let value_expr = right_and_rest[..semicolon_pos].trim();
                let rest = right_and_rest[semicolon_pos + 1..].trim();

                // Evaluate the right side
                let ctx = context.clone();
                let right_value = interpret_with_context(value_expr, ctx)?;

                if is_compound {
                    // Compound assignment: get current value and add
                    if let Some((current_value, var_type)) = context.get_var(left) {
                        let result_value = current_value + right_value;
                        validate_result_in_type(result_value, &var_type, input)?;
                        context.set_var(left.to_string(), result_value, &var_type)?;

                        if rest.is_empty() {
                            return Ok(result_value);
                        }
                        return interpret_with_context(rest, context);
                    } else {
                        return Err(InterpreterError {
                            code_snippet: format!("{} += {}", left, value_expr),
                            error_message: format!("Undefined variable '{}'", left),
                            explanation: "The variable has not been declared in the current scope."
                                .to_string(),
                            fix: "Declare the variable with a 'let' statement before using compound assignment."
                                .to_string(),
                        });
                    }
                } else {
                    // Simple assignment: assign the value
                    let value_type =
                        if let Ok((_, ty)) = extract_value_and_type(value_expr, &context) {
                            ty
                        } else {
                            "I32".to_string()
                        };

                    context.set_var(left.to_string(), right_value, &value_type)?;

                    if rest.is_empty() {
                        return Ok(right_value);
                    }
                    return interpret_with_context(rest, context);
                }
            }
        }
    }

    // Handle "is" type check operator: value is Type
    if let Some(is_pos) = find_is_operator(input) {
        let left = input[..is_pos].trim();
        let right_part = input[is_pos + 1..].trim(); // Skip the space before "is"

        // Extract the type name (should be "is TypeName")
        if let Some(type_name) = right_part.strip_prefix("is ") {
            let type_name = type_name.trim();

            // Evaluate the left side
            let (_, actual_type) = if let Ok(result) = extract_value_and_type(left, &context) {
                result
            } else {
                // Try recursive interpretation
                let val = interpret_with_context(left, context.clone())?;
                (val, "I32".to_string())
            };

            // Check if the type matches
            let result = if actual_type == type_name { 1 } else { 0 };
            return Ok(result);
        }
    }

    // Handle if-else expressions: if (condition) true_expr else false_expr
    if let Some((condition_str, true_expr_str, false_expr_str)) = parse_if_else_parts(input) {
        // Evaluate the condition and extract its type
        let cond_val = interpret_with_context(&condition_str, context.clone())?;
        let cond_type = if let Ok((_, ty)) = extract_value_and_type(&condition_str, &context) {
            ty
        } else {
            "I32".to_string()
        };

        // Validate that the condition is a boolean type
        if cond_type != "Bool" {
            return Err(InterpreterError {
                code_snippet: format!("if ({}) ...", condition_str),
                error_message: format!(
                    "If condition must be of type Bool, got {}",
                    cond_type
                ),
                explanation: "If-else expressions require a boolean condition (true or false). Conditions must evaluate to bool type, not numeric types."
                    .to_string(),
                fix: "Use a boolean expression or variable of type Bool as the condition."
                    .to_string(),
            });
        }

        // Evaluate both branches and extract their types
        let true_result = interpret_with_context(&true_expr_str, context.clone())?;
        let true_type = if let Ok((_, ty)) = extract_value_and_type(&true_expr_str, &context) {
            ty
        } else {
            "I32".to_string()
        };

        let false_result = interpret_with_context(&false_expr_str, context.clone())?;
        let false_type = if let Ok((_, ty)) = extract_value_and_type(&false_expr_str, &context) {
            ty
        } else {
            "I32".to_string()
        };

        // Validate that both branches have the same type
        if true_type != false_type {
            return Err(InterpreterError {
                code_snippet: format!(
                    "if ({}) {} else {}",
                    condition_str, true_expr_str, false_expr_str
                ),
                error_message: format!(
                    "If-else branch types mismatch: true branch is {}, false branch is {}",
                    true_type, false_type
                ),
                explanation: "Both branches of an if-else expression must return values of the same type."
                    .to_string(),
                fix: "Ensure both branches return the same type, or cast one branch to match the other."
                    .to_string(),
            });
        }

        // Return appropriate branch
        if cond_val != 0 {
            return Ok(true_result);
        } else {
            return Ok(false_result);
        }
    }

    // Handle expression sequences: expr; rest
    // Look for a semicolon at depth 0, but make sure it's not inside assignment or let
    if let Some(semi_pos) = find_char_at_depth_zero(input, ';') {
        let first_part = input[..semi_pos].trim();
        let rest = input[semi_pos + 1..].trim();

        // Only handle this if first_part is not a let statement or assignment at depth 0
        // (those are already handled above)
        let has_top_level_assignment = find_char_at_depth_zero(first_part, '=').is_some();
        if !first_part.starts_with("let ") && !has_top_level_assignment && !rest.is_empty() {
            // Try to evaluate the first expression
            let _first_val = interpret_with_context(first_part, context.clone())?;
            // Continue evaluating the rest with the same context
            return interpret_with_context(rest, context);
        }
    }

    // Check for binary operations (+, -, *, /) respecting operator precedence
    if let Some((pos, op_char)) = find_lowest_precedence_operator(input) {
        // Safe string splitting by char position
        if pos > 0 && pos < input.len() {
            let left = input[..pos].trim();
            let right_start = pos + 1;
            let right = if right_start < input.len() {
                input[right_start..].trim()
            } else {
                ""
            };

            if !left.is_empty() && !right.is_empty() {
                // Determine if left is a simple literal or a complex expression
                let (left_val, left_type) = if find_lowest_precedence_operator(left).is_none() {
                    // Try parsing as a literal first
                    match extract_value_and_type(left, &context) {
                        Ok(result) => result,
                        Err(_) => {
                            // If it's not a simple literal, recursively evaluate
                            (
                                interpret_with_context(left, context.clone())?,
                                "I32".to_string(),
                            )
                        }
                    }
                } else {
                    // Complex expression with operators, recursively evaluate
                    (
                        interpret_with_context(left, context.clone())?,
                        "I32".to_string(),
                    )
                };

                // Determine if right is a simple literal or a complex expression
                let (right_val, right_type) = if find_lowest_precedence_operator(right).is_none() {
                    // Try parsing as a literal first
                    match extract_value_and_type(right, &context) {
                        Ok(result) => result,
                        Err(_) => {
                            // If it's not a simple literal, recursively evaluate
                            (
                                interpret_with_context(right, context.clone())?,
                                "I32".to_string(),
                            )
                        }
                    }
                } else {
                    // Complex expression with operators, recursively evaluate
                    (
                        interpret_with_context(right, context.clone())?,
                        "I32".to_string(),
                    )
                };

                let result_val =
                    apply_operation(left_val, &left_type, op_char, right_val, &right_type, input)?;
                return Ok(result_val);
            }
        }
    }

    // Fall back to parsing as a single value
    let (val, _type) = extract_value_and_type(input, &context)?;
    Ok(val)
}

fn interpret(input: &str) -> Result<i32, InterpreterError> {
    interpret_with_context(input, Context::new())
}

fn main() {
    println!("Tuff REPL - Type 'quit' to exit");
    let stdin = io::stdin();

    loop {
        print!("> ");
        io::stdout().flush().ok();

        let mut input = String::new();
        stdin.read_line(&mut input).ok();
        let input = input.trim();

        if input == "quit" {
            println!("Goodbye!");
            break;
        }

        if input.is_empty() {
            continue;
        }

        match interpret(input) {
            Ok(result) => println!("Result: {}", result),
            Err(err) => println!(
                "Code: {}\nError: {}\nExplanation: {}\nFix: {}",
                err.code_snippet, err.error_message, err.explanation, err.fix
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_interpret_invalid() {
        let result = interpret("invalid");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_number() {
        let result = interpret("100");
        assert!(matches!(result, Ok(100)));
    }

    #[test]
    fn test_interpret_typed_number() {
        let result = interpret("100U8");
        assert!(matches!(result, Ok(100)));
    }

    #[test]
    fn test_interpret_negative_unsigned() {
        let result = interpret("-100U8");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_out_of_range() {
        let result = interpret("256U8");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_addition() {
        let result = interpret("1U8 + 2U8");
        assert!(matches!(result, Ok(3)));
    }

    #[test]
    fn test_interpret_addition_overflow() {
        let result = interpret("1U8 + 255U8");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_addition_overflow_untyped() {
        let result = interpret("1U8 + 255");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_addition_wider_type() {
        let result = interpret("1U8 + 255U16");
        assert!(matches!(result, Ok(256)));
    }

    #[test]
    fn test_interpret_addition_wider_type_overflow() {
        let result = interpret("1U8 + 65535U16");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_chained_operations() {
        let result = interpret("2 + 3 - 4");
        assert!(matches!(result, Ok(1)));
    }

    #[test]
    fn test_interpret_multiplication_and_subtraction() {
        let result = interpret("2 * 3 - 4");
        assert!(matches!(result, Ok(2)));
    }

    #[test]
    fn test_interpret_addition_and_multiplication() {
        let result = interpret("2 + 3 * 4");
        assert!(matches!(result, Ok(14)));
    }

    #[test]
    fn test_interpret_parentheses_precedence() {
        let result = interpret("(2 + 3) * 4");
        assert!(matches!(result, Ok(20)));
    }

    #[test]
    fn test_interpret_braces_grouping() {
        let result = interpret("(2 + { 1 + 2 }) * 4");
        assert!(matches!(result, Ok(20)));
    }

    #[test]
    fn test_interpret_let_binding() {
        let result = interpret("(2 + { let x : U8 = 1 + 2; x }) * 4");
        assert!(matches!(result, Ok(20)));
    }

    #[test]
    fn test_interpret_nested_let_bindings() {
        let result = interpret("(2 + { let x : U8 = 1 + 2; let y : U8 = x; y }) * 4");
        assert!(matches!(result, Ok(20)));
    }

    #[test]
    fn test_interpret_top_level_let_binding() {
        let result =
            interpret("let z : U8 = (2 + { let x : U8 = 1 + 2; let y : U8 = x; y }) * 4; z");
        assert!(matches!(result, Ok(20)));
    }

    #[test]
    fn test_interpret_let_binding_no_rest() {
        let result = interpret("let x : U8 = 100;");
        assert!(matches!(result, Ok(0)));
    }

    #[test]
    fn test_interpret_let_binding_without_type() {
        let result = interpret("let x = 100; x");
        assert!(matches!(result, Ok(100)));
    }

    #[test]
    fn test_interpret_duplicate_let_binding() {
        let result = interpret("let x = 100; let x = 100;");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_let_type_promotion() {
        let result = interpret("let x : U16 = 100U8; x");
        assert!(matches!(result, Ok(100)));
    }

    #[test]
    fn test_interpret_let_type_mismatch() {
        let result = interpret("let x : U8 = 100U16; x");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_let_variable_type_narrowing() {
        let result = interpret("let x = 100U16; let y : U8 = x; y");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_undefined_variable() {
        let result = interpret("let x = undefinedVariable; x");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_mutable_variable() {
        let result = interpret("let mut x = 0; x = 100; x");
        assert!(matches!(result, Ok(100)));
    }

    #[test]
    fn test_interpret_immutable_variable_assignment() {
        let result = interpret("let x = 0; x = 100; x");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_assignment_to_undefined_variable() {
        let result = interpret("x = 100; x");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_mutable_variable_type_narrowing() {
        let result = interpret("let mut x = 0U8; x = 100U16; x");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_unknown_type() {
        let result = interpret("let x : UnknownType = 100; x");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_bool_type() {
        let result = interpret("let x : Bool = true; x");
        assert!(matches!(result, Ok(1)));
    }

    #[test]
    fn test_interpret_bool_in_arithmetic() {
        let result = interpret("true + false");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_bool_in_arithmetic_with_parentheses() {
        let result = interpret("(true) + false");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_is_type_operator() {
        let result = interpret("100U8 is U8");
        assert!(matches!(result, Ok(1)));
    }

    #[test]
    fn test_interpret_is_type_operator_untyped() {
        let result = interpret("100 is I32");
        assert!(matches!(result, Ok(1)));
    }

    #[test]
    fn test_interpret_is_type_operator_variable() {
        let result = interpret("let x = 0; x is I32");
        assert!(matches!(result, Ok(1)));
    }

    #[test]
    fn test_interpret_empty_braces_with_let() {
        let result = interpret("{} let x = 100; x");
        assert!(matches!(result, Ok(100)));
    }

    #[test]
    fn test_interpret_let_with_empty_braces() {
        let result = interpret("let x = 100; {} x");
        assert!(matches!(result, Ok(100)));
    }

    #[test]
    fn test_interpret_braces_scope_isolation() {
        let result = interpret("{ let x = 0; } let y = x; y");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_if_else_true() {
        let result = interpret("let x = if (true) 3 else 5; x");
        assert!(matches!(result, Ok(3)));
    }

    #[test]
    fn test_interpret_if_non_bool_condition() {
        let result = interpret("if (100) 3 else 5");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_if_else_mismatched_types() {
        let result = interpret("if (true) true else 5");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_if_else_assign_wrong_type() {
        let result = interpret("let x : Bool = if (true) 10 else 5; x");
        assert!(result.is_err());
    }

    #[test]
    fn test_interpret_if_else_with_assignment() {
        let result = interpret("let mut x = 0; if (true) x = 1; else x = 2; x");
        assert!(matches!(result, Ok(1)));
    }

    #[test]
    fn test_interpret_if_else_with_braced_assignment() {
        let result = interpret("let mut x = 0; if (true) { x = 1; } else { x = 2; } x");
        assert!(matches!(result, Ok(1)));
    }

    #[test]
    fn test_interpret_if_false_no_else() {
        let result = interpret("let mut x = 0; if (false) { x = 1; } x");
        assert!(matches!(result, Ok(0)));
    }

    #[test]
    fn test_interpret_compound_assignment_add() {
        let result = interpret("let mut x = 0; x += 1; x");
        assert!(matches!(result, Ok(1)));
    }

    #[test]
    fn test_interpret_compound_assignment_immutable() {
        let result = interpret("let x = 0; x += 1; x");
        assert!(result.is_err());
    }
}
