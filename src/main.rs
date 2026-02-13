use std::io::{self, Write};

#[derive(Debug)]
struct InterpreterError {
    code_snippet: String,
    error_message: String,
    explanation: String,
    fix: String,
}

fn interpret(input: &str) -> Result<i32, InterpreterError> {
    Err(InterpreterError {
        code_snippet: input.to_string(),
        error_message: "not implemented".to_string(),
        explanation: "This feature has not yet been implemented.".to_string(),
        fix: "Implement this feature.".to_string(),
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
}
