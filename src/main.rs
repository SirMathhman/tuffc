use std::io::{self, Write};

#[derive(Debug)]
struct InterpreterError {
    code_snippet: String,
    error_message: String,
    explanation: String,
    fix: String,
}

fn interpret(input: &str) -> Result<i32, InterpreterError> {
    // Try parsing as a plain integer first
    if let Ok(val) = input.parse::<i32>() {
        return Ok(val);
    }

    // Try parsing with type suffixes (e.g., "100U8", "42I32")
    let unsigned_suffixes = ["U8", "U16", "U32", "U64"];
    let signed_suffixes = ["I8", "I16", "I32", "I64"];

    for suffix in &unsigned_suffixes {
        if input.ends_with(suffix) {
            let without_suffix = &input[..input.len() - suffix.len()];
            if without_suffix.starts_with('-') {
                return Err(InterpreterError {
                    code_snippet: input.to_string(),
                    error_message: "Negative value with unsigned type suffix".to_string(),
                    explanation: "Unsigned types (U8, U16, U32, U64) cannot represent negative numbers. The language semantics require unsigned types to only hold non-negative values.".to_string(),
                    fix: "Use a signed type suffix (I8, I16, I32, I64) for negative numbers, or remove the negative sign.".to_string(),
                });
            }
            if let Ok(val) = without_suffix.parse::<i32>() {
                return Ok(val);
            }
        }
    }

    for suffix in &signed_suffixes {
        if input.ends_with(suffix) {
            let without_suffix = &input[..input.len() - suffix.len()];
            if let Ok(val) = without_suffix.parse::<i32>() {
                return Ok(val);
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
}
