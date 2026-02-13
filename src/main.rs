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
#[allow(dead_code)]
struct Context {
    variables: HashMap<String, (i32, String)>, // (value, type)
}

impl Context {
    #[allow(dead_code)]
    fn new() -> Self {
        Context {
            variables: HashMap::new(),
        }
    }

    #[allow(dead_code)]
    fn with_var(mut self, name: String, value: i32, var_type: String) -> Self {
        self.variables.insert(name, (value, var_type));
        self
    }

    #[allow(dead_code)]
    fn get_var(&self, name: &str) -> Option<(i32, String)> {
        self.variables.get(name).cloned()
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

    // Try parsing as a plain integer first
    if let Ok(val) = input.parse::<i32>() {
        return Ok((val, "I32".to_string()));
    }

    // Try parsing with type suffixes (e.g., "100U8", "42I32")
    let unsigned_suffixes = [
        ("U8", 0i32, 255i32),
        ("U16", 0, 65535),
        ("U32", 0, u32::MAX as i32),
        ("U64", 0, i32::MAX),
    ];
    let signed_suffixes = [
        ("I8", -128i32, 127i32),
        ("I16", -32768, 32767),
        ("I32", i32::MIN, i32::MAX),
        ("I64", i32::MIN, i32::MAX),
    ];

    for (suffix, min, max) in &unsigned_suffixes {
        if let Some(result) = validate_and_parse_with_suffix(input, suffix, *min, *max, true) {
            match result {
                Ok(val) => return Ok((val, suffix.to_string())),
                Err(e) => return Err(e),
            }
        }
    }

    for (suffix, min, max) in &signed_suffixes {
        if let Some(result) = validate_and_parse_with_suffix(input, suffix, *min, *max, false) {
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
        _ => None,
    }
}

#[allow(dead_code)]
fn get_type_width(type_name: &str) -> u8 {
    match type_name {
        "I8" | "U8" => 8,
        "I16" | "U16" => 16,
        "I32" | "U32" => 32,
        "I64" | "U64" => 64,
        _ => 0,
    }
}

#[allow(dead_code)]
fn get_effective_type<'a>(left_type: &'a str, right_type: &'a str) -> &'a str {
    // If one operand is default I32 (untyped), use the other's type
    match (left_type, right_type) {
        ("I32", other) if other != "I32" => other,
        (other, "I32") if other != "I32" => other,
        _ => get_wider_type(left_type, right_type),
    }
}

#[allow(dead_code)]
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

fn find_lowest_precedence_operator(input: &str) -> Option<(usize, char)> {
    let mut paren_depth = 0;
    let mut brace_depth = 0;

    // First pass: look for low-precedence operators (+ and -) outside parentheses and braces
    for (pos, ch) in input.char_indices() {
        match ch {
            '(' => paren_depth += 1,
            ')' => paren_depth -= 1,
            '{' => brace_depth += 1,
            '}' => brace_depth -= 1,
            _ => {
                if paren_depth == 0 && brace_depth == 0 && matches!(ch, '+' | '-') {
                    // Make sure this is not a negative sign at the beginning or after an operator
                    if ch == '-'
                        && (pos == 0 || input[..pos].trim().ends_with(['+', '-', '*', '/']))
                    {
                        continue;
                    }
                    return Some((pos, ch));
                }
            }
        }
    }

    paren_depth = 0;
    brace_depth = 0;
    // Second pass: look for high-precedence operators (* and /) outside parentheses and braces
    for (pos, ch) in input.char_indices() {
        match ch {
            '(' => paren_depth += 1,
            ')' => paren_depth -= 1,
            '{' => brace_depth += 1,
            '}' => brace_depth -= 1,
            _ => {
                if paren_depth == 0 && brace_depth == 0 && matches!(ch, '*' | '/') {
                    return Some((pos, ch));
                }
            }
        }
    }

    None
}

fn interpret_with_context(input: &str, mut context: Context) -> Result<i32, InterpreterError> {
    let input = input.trim();

    // Strip outer parentheses or braces if they wrap the entire expression
    let input = if (input.starts_with('(') && input.ends_with(')'))
        || (input.starts_with('{') && input.ends_with('}'))
    {
        let mut paren_depth = 0;
        let mut brace_depth = 0;
        let mut is_wrapped = true;
        for (i, ch) in input.char_indices() {
            match ch {
                '(' => paren_depth += 1,
                ')' => paren_depth -= 1,
                '{' => brace_depth += 1,
                '}' => brace_depth -= 1,
                _ => {}
            }
            // If delimiters close before the end, they don't wrap the entire expression
            if (paren_depth == 0 && brace_depth == 0) && i < input.len() - 1 {
                is_wrapped = false;
                break;
            }
        }
        if is_wrapped {
            input[1..input.len() - 1].trim()
        } else {
            input
        }
    } else {
        input
    };

    // Handle let statements: let name : type = expr; rest
    if input.starts_with("let ") {
        // Find the semicolon that separates the let statement from the rest
        let semicolon_pos = input.find(';')
            .ok_or_else(|| InterpreterError {
                code_snippet: input.to_string(),
                error_message: "Let statement must end with semicolon".to_string(),
                explanation: "Variable declarations must be followed by a semicolon and then the expression to evaluate.".to_string(),
                fix: "Add a semicolon after the variable assignment.".to_string(),
            })?;

        let let_part = input[4..semicolon_pos].trim(); // Skip "let "
        let rest = input[semicolon_pos + 1..].trim();

        // Parse: name : type = value
        let eq_pos = let_part.find('=').ok_or_else(|| InterpreterError {
            code_snippet: input.to_string(),
            error_message: "Variable declaration must have an assignment".to_string(),
            explanation: "Format should be: let name : type = value;".to_string(),
            fix: "Add an assignment with = operator.".to_string(),
        })?;

        let name_and_type = let_part[..eq_pos].trim();
        let value_expr = let_part[eq_pos + 1..].trim();

        // Parse name : type
        let colon_pos = name_and_type.find(':').ok_or_else(|| InterpreterError {
            code_snippet: input.to_string(),
            error_message: "Variable type annotation required".to_string(),
            explanation: "Format should be: let name : type = value;".to_string(),
            fix: "Specify the type with a colon after the variable name.".to_string(),
        })?;

        let var_name = name_and_type[..colon_pos].trim().to_string();
        let var_type = name_and_type[colon_pos + 1..].trim().to_string();

        // Evaluate the value expression
        let val = interpret_with_context(value_expr, context.clone())?;

        // Validate the value is within the type bounds
        validate_result_in_type(val, &var_type, input)?;

        // Add the variable to context
        context = context.with_var(var_name, val, var_type);

        // Continue evaluating the rest
        return interpret_with_context(rest, context);
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
}
