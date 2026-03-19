use std::collections::HashMap;

pub fn interpret_tuff(input: String) -> i32 {
    let mut parser = Parser::new(&input);
    parser.parse_program()
}

struct Parser<'a> {
    input: &'a [u8],
    pos: usize,
    env: HashMap<String, i32>,
}

impl<'a> Parser<'a> {
    fn new(input: &'a str) -> Self {
        Self {
            input: input.as_bytes(),
            pos: 0,
            env: HashMap::new(),
        }
    }

    fn is_eof(&self) -> bool {
        self.pos >= self.input.len()
    }

    fn skip_whitespace(&mut self) {
        while let Some(&byte) = self.input.get(self.pos) {
            if !byte.is_ascii_whitespace() {
                break;
            }
            self.pos += 1;
        }
    }

    fn parse_program(&mut self) -> i32 {
        self.skip_whitespace();
        if self.is_eof() {
            panic!("empty input");
        }

        let mut last_value = self.parse_statement();

        loop {
            self.skip_whitespace();

            if self.consume(b';') {
                self.skip_whitespace();
                if self.is_eof() {
                    return last_value;
                }

                last_value = self.parse_statement();
            } else if self.is_eof() {
                return last_value;
            } else {
                panic!("unexpected trailing input");
            }
        }
    }

    fn parse_statement(&mut self) -> i32 {
        self.skip_whitespace();

        if self.consume_keyword("let") {
            self.parse_let_statement()
        } else {
            self.parse_expression()
        }
    }

    fn parse_let_statement(&mut self) -> i32 {
        let name = self.parse_identifier();

        self.skip_whitespace();
        self.expect(b':');
        self.parse_type_annotation();
        self.expect(b'=');

        let value = self.parse_expression();
        self.env.insert(name, value);
        value
    }

    fn parse_type_annotation(&mut self) {
        let _ = self.parse_identifier();
    }

    fn consume(&mut self, expected: u8) -> bool {
        self.skip_whitespace();
        if self.input.get(self.pos) == Some(&expected) {
            self.pos += 1;
            true
        } else {
            false
        }
    }

    fn consume_keyword(&mut self, keyword: &str) -> bool {
        self.skip_whitespace();
        let bytes = keyword.as_bytes();
        if self.input.get(self.pos..self.pos + bytes.len()) == Some(bytes)
            && self
                .input
                .get(self.pos + bytes.len())
                .map(|byte| !byte.is_ascii_alphanumeric() && *byte != b'_')
                .unwrap_or(true)
        {
            self.pos += bytes.len();
            true
        } else {
            false
        }
    }

    fn expect(&mut self, expected: u8) {
        if !self.consume(expected) {
            panic!("expected '{}'", expected as char);
        }
    }

    fn parse_expression(&mut self) -> i32 {
        let mut value = self.parse_term();

        loop {
            if self.consume(b'+') {
                value = value
                    .checked_add(self.parse_term())
                    .expect("addition overflow");
            } else if self.consume(b'-') {
                value = value
                    .checked_sub(self.parse_term())
                    .expect("subtraction overflow");
            } else {
                break;
            }
        }

        value
    }

    fn parse_term(&mut self) -> i32 {
        let mut value = self.parse_factor();

        loop {
            if self.consume(b'*') {
                value = value
                    .checked_mul(self.parse_factor())
                    .expect("multiplication overflow");
            } else if self.consume(b'/') {
                let divisor = self.parse_factor();
                if divisor == 0 {
                    panic!("division by zero");
                }
                value = value / divisor;
            } else {
                break;
            }
        }

        value
    }

    fn parse_factor(&mut self) -> i32 {
        self.skip_whitespace();

        if self.consume(b'+') {
            self.parse_factor()
        } else if self.consume(b'-') {
            self.parse_factor()
                .checked_neg()
                .expect("negation overflow")
        } else {
            self.parse_primary()
        }
    }

    fn parse_primary(&mut self) -> i32 {
        self.skip_whitespace();

        if self.consume(b'(') {
            let value = self.parse_expression();
            self.expect(b')');
            value
        } else if self
            .input
            .get(self.pos)
            .copied()
            .is_some_and(|byte| byte.is_ascii_alphabetic() || byte == b'_')
        {
            let name = self.parse_identifier();
            *self
                .env
                .get(&name)
                .unwrap_or_else(|| panic!("undefined variable"))
        } else {
            self.parse_number_literal()
        }
    }

    fn parse_identifier(&mut self) -> String {
        self.skip_whitespace();

        let start = self.pos;
        match self.input.get(self.pos).copied() {
            Some(byte) if byte.is_ascii_alphabetic() || byte == b'_' => self.pos += 1,
            _ => panic!("expected identifier"),
        }

        while let Some(&byte) = self.input.get(self.pos) {
            if !byte.is_ascii_alphanumeric() && byte != b'_' {
                break;
            }
            self.pos += 1;
        }

        std::str::from_utf8(&self.input[start..self.pos])
            .expect("utf8")
            .to_string()
    }

    fn parse_number_literal(&mut self) -> i32 {
        self.skip_whitespace();

        let start = self.pos;
        while let Some(&byte) = self.input.get(self.pos) {
            if !byte.is_ascii_digit() {
                break;
            }
            self.pos += 1;
        }

        if self.pos == start {
            panic!("expected numeric literal");
        }

        while let Some(&byte) = self.input.get(self.pos) {
            if byte.is_ascii_whitespace()
                || byte == b'+'
                || byte == b'-'
                || byte == b'*'
                || byte == b'/'
                || byte == b')'
                || byte == b';'
                || byte == b'='
                || byte == b':'
            {
                break;
            }

            if byte.is_ascii_alphanumeric() {
                self.pos += 1;
                continue;
            }

            panic!("invalid literal suffix");
        }

        let literal = std::str::from_utf8(&self.input[start..self.pos]).expect("utf8");
        let (digits, suffix) = split_literal(literal);

        if !suffix.is_empty()
            && !matches!(
                suffix,
                "U8" | "U16" | "U32" | "U64" | "I8" | "I16" | "I32" | "I64"
            )
        {
            panic!("invalid literal suffix");
        }

        let value = digits
            .parse::<i128>()
            .unwrap_or_else(|_| panic!("invalid numeric literal"));

        if value > i32::MAX as i128 {
            panic!("numeric literal overflow");
        }

        value as i32
    }
}

fn split_literal(literal: &str) -> (&str, &str) {
    let mut index = 0;
    for byte in literal.as_bytes() {
        if byte.is_ascii_digit() {
            index += 1;
        } else {
            break;
        }
    }

    literal.split_at(index)
}

#[cfg(test)]
mod tests {
    use super::interpret_tuff;

    #[test]
    fn evaluates_let_binding_and_final_expression() {
        assert_eq!(
            interpret_tuff("let x : U8 = 100U8 + 50U8; x".to_string()),
            150
        );
    }

    #[test]
    fn evaluates_multiple_bindings_in_sequence() {
        assert_eq!(
            interpret_tuff("let x : U8 = 100U8; let y : U8 = 50U8; x + y".to_string()),
            150
        );
    }

    #[test]
    fn ignores_type_annotations_when_evaluating_bindings() {
        assert_eq!(
            interpret_tuff("let total : I32 = ( 2 + 3 ) * 4; total".to_string()),
            20
        );
    }

    #[test]
    fn allows_expression_to_use_previous_binding() {
        assert_eq!(
            interpret_tuff("let x : U8 = 100U8; let result : I32 = x + 50U8; result".to_string()),
            150
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_undefined_variable_reference() {
        interpret_tuff("x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_missing_expression_after_let_assignment() {
        interpret_tuff("let x : U8 = ; x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_empty_input() {
        interpret_tuff("".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_division_by_zero() {
        interpret_tuff("let x : U8 = 4 / 0; x".to_string());
    }
}

fn main() {
    println!("Hello, world!");
}
