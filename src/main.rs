pub fn interpret_tuff(input: String) -> i32 {
    let mut parser = Parser::new(&input);
    let value = parser.parse_expression();
    parser.skip_whitespace();

    if !parser.is_eof() {
        panic!("unexpected trailing input");
    }

    value
}

struct Parser<'a> {
    input: &'a [u8],
    pos: usize,
}

impl<'a> Parser<'a> {
    fn new(input: &'a str) -> Self {
        Self {
            input: input.as_bytes(),
            pos: 0,
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

    fn consume(&mut self, expected: u8) -> bool {
        self.skip_whitespace();
        if self.input.get(self.pos) == Some(&expected) {
            self.pos += 1;
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
            self.parse_factor().checked_neg().expect("negation overflow")
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
        } else {
            self.parse_number_literal()
        }
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
            && !matches!(suffix, "U8" | "U16" | "U32" | "U64" | "I8" | "I16" | "I32" | "I64")
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
    fn parses_addition_with_suffixes() {
        assert_eq!(interpret_tuff("100U8 + 50U8".to_string()), 150);
    }

    #[test]
    fn respects_operator_precedence() {
        assert_eq!(interpret_tuff("2 + 3 * 4".to_string()), 14);
    }

    #[test]
    fn respects_parentheses_and_whitespace() {
        assert_eq!(interpret_tuff(" ( 2 + 3 ) * 4 ".to_string()), 20);
    }

    #[test]
    fn parses_signed_literal_inside_expression() {
        assert_eq!(interpret_tuff("-7I16 + 10".to_string()), 3);
    }

    #[test]
    #[should_panic]
    fn panics_on_empty_input() {
        interpret_tuff("".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_malformed_expression() {
        interpret_tuff("100U8 +".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_division_by_zero() {
        interpret_tuff("4 / 0".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_invalid_literal_suffix() {
        interpret_tuff("42X9 + 1".to_string());
    }
}

fn main() {
    println!("Hello, world!");
}
