use std::io::{self, Write};

#[derive(Debug)]
struct InterpreterError {
    code_snippet: String,
    error_message: String,
    explanation: String,
    fix: String,
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

fn parse_single_value(input: &str) -> Result<i32, InterpreterError> {
    // Try parsing as a plain integer first
    if let Ok(val) = input.parse::<i32>() {
        return Ok(val);
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
            return result;
        }
    }

    for (suffix, min, max) in &signed_suffixes {
        if let Some(result) = validate_and_parse_with_suffix(input, suffix, *min, *max, false) {
            return result;
        }
    }

    Err(InterpreterError {
        code_snippet: input.to_string(),
        error_message: "Failed to parse input as integer".to_string(),
        explanation: "The input could not be parsed as a valid integer, optionally with a type suffix (U8, U16, U32, U64, I8, I16, I32, I64).".to_string(),
        fix: "Provide a valid integer value, optionally with a type suffix.".to_string(),
    })
}

fn interpret(input: &str) -> Result<i32, InterpreterError> {
    let input = input.trim();

    // Check for binary operations (+, -, *, /)
    for op_char in ['+', '-', '*', '/'] {
        if let Some(pos) = input.rfind(op_char) {
            // Make sure this is not a negative sign at the beginning or after an operator
            if op_char == '-' && (pos == 0 || input[..pos].trim().ends_with(['+', '-', '*', '/'])) {
                continue;
            }

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
                    if let (Ok(left_val), Ok(right_val)) =
                        (parse_single_value(left), parse_single_value(right))
                    {
                        return match op_char {
                            '+' => Ok(left_val + right_val),
                            '-' => Ok(left_val - right_val),
                            '*' => Ok(left_val * right_val),
                            '/' => {
                                if right_val == 0 {
                                    Err(InterpreterError {
                                        code_snippet: input.to_string(),
                                        error_message: "Division by zero".to_string(),
                                        explanation: "Dividing by zero is undefined in mathematics and not allowed in this language.".to_string(),
                                        fix: "Use a non-zero divisor.".to_string(),
                                    })
                                } else {
                                    Ok(left_val / right_val)
                                }
                            }
                            _ => continue,
                        };
                    }
                }
            }
        }
    }

    // Fall back to parsing as a single value
    parse_single_value(input)
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
}
