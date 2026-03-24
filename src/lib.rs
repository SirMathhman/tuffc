pub fn interpret_tuff(input: &str) -> Result<i128, String> {
    let trimmed = input.trim();

    if trimmed.is_empty() {
        return Ok(0);
    }

    let mut parser = Parser::new(trimmed);
    let value = parser.parse_expression()?;
    parser.skip_whitespace();

    if parser.is_eof() {
        Ok(value)
    } else {
        Err(format!("unexpected trailing input: {}", parser.remaining()))
    }
}

struct Parser<'a> {
    input: &'a str,
    position: usize,
}

impl<'a> Parser<'a> {
    fn new(input: &'a str) -> Self {
        Self { input, position: 0 }
    }

    fn parse_expression(&mut self) -> Result<i128, String> {
        let mut value = self.parse_term()?;

        loop {
            self.skip_whitespace();

            if self.consume_char('+') {
                let rhs = self.parse_term()?;
                value = value
                    .checked_add(rhs)
                    .ok_or_else(|| self.arithmetic_error("addition"))?;
            } else if self.consume_char('-') {
                let rhs = self.parse_term()?;
                value = value
                    .checked_sub(rhs)
                    .ok_or_else(|| self.arithmetic_error("subtraction"))?;
            } else {
                break;
            }
        }

        Ok(value)
    }

    fn parse_term(&mut self) -> Result<i128, String> {
        let mut value = self.parse_factor()?;

        loop {
            self.skip_whitespace();

            if self.consume_char('*') {
                let rhs = self.parse_factor()?;
                value = value
                    .checked_mul(rhs)
                    .ok_or_else(|| self.arithmetic_error("multiplication"))?;
            } else if self.consume_char('/') {
                let rhs = self.parse_factor()?;
                if rhs == 0 {
                    return Err("division by zero".to_string());
                }

                value = value
                    .checked_div(rhs)
                    .ok_or_else(|| self.arithmetic_error("division"))?;
            } else {
                break;
            }
        }

        Ok(value)
    }

    fn parse_factor(&mut self) -> Result<i128, String> {
        self.skip_whitespace();

        if self.consume_char('+') {
            self.parse_factor()
        } else if self.consume_char('-') {
            let value = self.parse_factor()?;
            value
                .checked_neg()
                .ok_or_else(|| self.arithmetic_error("negation"))
        } else {
            self.parse_primary()
        }
    }

    fn parse_primary(&mut self) -> Result<i128, String> {
        self.skip_whitespace();

        if self.consume_char('(') {
            let value = self.parse_expression()?;
            self.skip_whitespace();

            if self.consume_char(')') {
                Ok(value)
            } else {
                Err("missing closing ')'".to_string())
            }
        } else {
            self.parse_literal()
        }
    }

    fn parse_literal(&mut self) -> Result<i128, String> {
        self.skip_whitespace();
        let start = self.position;

        while self.peek_char().is_some_and(|ch| ch.is_ascii_digit()) {
            self.position += 1;
        }

        if self.position == start {
            return Err(format!("invalid literal: {}", self.remaining()));
        }

        let literal = &self.input[start..self.position];
        let remaining = self.remaining();

        for (suffix, min, max) in Self::typed_suffixes() {
            if let Some(value_str) = remaining.strip_prefix(suffix) {
                if value_str
                    .chars()
                    .next()
                    .is_some_and(|ch| ch.is_ascii_alphanumeric() || ch == '_')
                {
                    break;
                }

                self.position += suffix.len();
                let value = literal
                    .parse::<i128>()
                    .map_err(|_| format!("invalid literal: {literal}{suffix}"))?;

                if value < min || value > max {
                    return Err(format!("value out of range for {suffix}: {value}"));
                }

                return Ok(value);
            }
        }

        if remaining
            .chars()
            .next()
            .is_some_and(|ch| ch.is_ascii_alphabetic())
        {
            return Err(format!("invalid literal: {literal}{remaining}"));
        }

        literal
            .parse::<i128>()
            .map_err(|_| format!("invalid literal: {literal}"))
    }

    fn typed_suffixes() -> [(&'static str, i128, i128); 8] {
        [
            ("U8", 0, 255),
            ("U16", 0, 65_535),
            ("U32", 0, 4_294_967_295),
            ("U64", 0, 18_446_744_073_709_551_615),
            ("I8", -128, 127),
            ("I16", -32_768, 32_767),
            ("I32", -2_147_483_648, 2_147_483_647),
            ("I64", -9_223_372_036_854_775_808, 9_223_372_036_854_775_807),
        ]
    }

    fn consume_char(&mut self, expected: char) -> bool {
        if self.peek_char() == Some(expected) {
            self.position += expected.len_utf8();
            true
        } else {
            false
        }
    }

    fn peek_char(&self) -> Option<char> {
        self.input[self.position..].chars().next()
    }

    fn skip_whitespace(&mut self) {
        while self.peek_char().is_some_and(|ch| ch.is_whitespace()) {
            self.position += self.peek_char().unwrap().len_utf8();
        }
    }

    fn is_eof(&self) -> bool {
        self.position >= self.input.len()
    }

    fn remaining(&self) -> &'a str {
        &self.input[self.position..]
    }

    fn arithmetic_error(&self, operation: &str) -> String {
        format!("arithmetic overflow during {operation}")
    }
}

pub use interpret_tuff as interpretTuff;
