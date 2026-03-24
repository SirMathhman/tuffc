use std::collections::HashMap;

pub fn interpret_tuff(input: &str) -> Result<i128, String> {
    let trimmed = input.trim();

    if trimmed.is_empty() {
        return Ok(0);
    }

    let mut parser = Parser::new(trimmed);
    parser.parse_program()
}

struct Parser<'a> {
    input: &'a str,
    position: usize,
    env: HashMap<String, i128>,
}

impl<'a> Parser<'a> {
    fn new(input: &'a str) -> Self {
        Self {
            input,
            position: 0,
            env: HashMap::new(),
        }
    }

    fn parse_program(&mut self) -> Result<i128, String> {
        self.skip_whitespace();

        while self.peek_keyword("let") {
            self.parse_let_statement()?;
            self.skip_whitespace();

            if !self.consume_char(';') {
                return Err("expected ';' after let binding".to_string());
            }

            self.skip_whitespace();

            if self.is_eof() {
                return Err("missing final expression".to_string());
            }

            if !self.peek_keyword("let") {
                break;
            }
        }

        let value = self.parse_expression()?;
        self.skip_whitespace();

        if self.is_eof() {
            Ok(value)
        } else {
            Err(format!("unexpected trailing input: {}", self.remaining()))
        }
    }

    fn parse_let_statement(&mut self) -> Result<(), String> {
        self.expect_keyword("let")?;
        self.skip_whitespace();

        let name = self
            .parse_identifier()
            .ok_or_else(|| "expected variable name after let".to_string())?;

        self.skip_whitespace();

        let annotation = if self.consume_char(':') {
            self.skip_whitespace();
            Some(
                self.parse_identifier()
                    .ok_or_else(|| "expected type annotation after ':'".to_string())?,
            )
        } else {
            None
        };

        self.skip_whitespace();

        if !self.consume_char('=') {
            return Err("expected '=' in let binding".to_string());
        }

        let value = self.parse_expression()?;

        if let Some(annotation) = annotation {
            self.validate_annotation(&annotation, value)?;
        }

        self.env.insert(name, value);
        Ok(())
    }

    fn validate_annotation(&self, annotation: &str, value: i128) -> Result<(), String> {
        for (suffix, min, max) in Self::typed_suffixes() {
            if suffix == annotation {
                if value < min || value > max {
                    return Err(format!("value out of range for {annotation}: {value}"));
                }

                return Ok(());
            }
        }

        Err(format!("unsupported type annotation: {annotation}"))
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
        } else if self.peek_char().is_some_and(Self::is_ident_start) {
            let ident = self
                .parse_identifier()
                .ok_or_else(|| "expected identifier".to_string())?;

            if ident == "let" {
                Err("unexpected keyword 'let'".to_string())
            } else {
                self.env
                    .get(&ident)
                    .copied()
                    .ok_or_else(|| format!("unknown variable: {ident}"))
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
            .is_some_and(Self::is_ident_start)
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

    fn parse_identifier(&mut self) -> Option<String> {
        let start = self.position;

        if !self.peek_char().is_some_and(Self::is_ident_start) {
            return None;
        }

        self.position += self.peek_char()?.len_utf8();

        while self.peek_char().is_some_and(Self::is_ident_continue) {
            self.position += self.peek_char().unwrap().len_utf8();
        }

        Some(self.input[start..self.position].to_string())
    }

    fn peek_keyword(&self, keyword: &str) -> bool {
        let remaining = self.remaining();

        if !remaining.starts_with(keyword) {
            return false;
        }

        remaining[keyword.len()..]
            .chars()
            .next()
            .is_none_or(|ch| !Self::is_ident_continue(ch))
    }

    fn expect_keyword(&mut self, keyword: &str) -> Result<(), String> {
        if self.peek_keyword(keyword) {
            self.position += keyword.len();
            Ok(())
        } else {
            Err(format!("expected keyword '{keyword}'"))
        }
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

    fn is_ident_start(ch: char) -> bool {
        ch.is_ascii_alphabetic() || ch == '_'
    }

    fn is_ident_continue(ch: char) -> bool {
        ch.is_ascii_alphanumeric() || ch == '_'
    }

    fn arithmetic_error(&self, operation: &str) -> String {
        format!("arithmetic overflow during {operation}")
    }
}

pub use interpret_tuff as interpretTuff;
