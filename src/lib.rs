use std::collections::HashMap;

pub fn interpret_tuff(input: &str) -> Result<i128, String> {
    let trimmed = input.trim();

    if trimmed.is_empty() {
        return Ok(0);
    }

    let mut parser = Parser::new(trimmed);
    parser.parse_program().map(Value::into_public_result)
}

struct Parser<'a> {
    input: &'a str,
    position: usize,
    env: HashMap<String, Binding>,
}

#[derive(Clone)]
struct Binding {
    value: Value,
    mutable: bool,
    annotation: Option<TypeAnnotation>,
}

#[derive(Clone)]
enum TypeAnnotation {
    Integer(&'static str),
    Bool,
}

#[derive(Clone)]
enum Value {
    Integer(i128),
    Bool(bool),
}

impl<'a> Parser<'a> {
    fn new(input: &'a str) -> Self {
        Self {
            input,
            position: 0,
            env: HashMap::new(),
        }
    }

    fn parse_program(&mut self) -> Result<Value, String> {
        self.skip_whitespace();

        loop {
            if self.peek_keyword("let") {
                self.parse_let_statement()?;
                self.expect_statement_terminator("let binding")?;
            } else if self.peek_assignment_statement() {
                self.parse_assignment_statement()?;
                self.expect_statement_terminator("assignment")?;
            } else {
                break;
            }

            self.skip_whitespace();

            if self.is_eof() {
                return Err("missing final expression".to_string());
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

        let mutable = if self.peek_keyword("mut") {
            self.expect_keyword("mut")?;
            self.skip_whitespace();
            true
        } else {
            false
        };

        let name = self
            .parse_identifier()
            .ok_or_else(|| "expected variable name after let".to_string())?;
        self.validate_identifier_name(&name)?;

        self.skip_whitespace();

        let annotation = if self.consume_char(':') {
            self.skip_whitespace();
            Some(self.parse_type_annotation()?)
        } else {
            None
        };

        self.skip_whitespace();

        if !self.consume_char('=') {
            return Err("expected '=' in let binding".to_string());
        }

        let value = self.parse_expression()?;

        if let Some(annotation) = annotation {
            self.validate_annotation(&annotation, &value)?;
            self.env.insert(
                name,
                Binding {
                    value,
                    mutable,
                    annotation: Some(annotation),
                },
            );
        } else {
            self.env.insert(
                name,
                Binding {
                    value,
                    mutable,
                    annotation: None,
                },
            );
        }

        Ok(())
    }

    fn parse_assignment_statement(&mut self) -> Result<(), String> {
        let name = self
            .parse_identifier()
            .ok_or_else(|| "expected variable name in assignment".to_string())?;
        self.validate_identifier_name(&name)?;

        self.skip_whitespace();

        if !self.consume_char('=') {
            return Err("expected '=' in assignment".to_string());
        }

        let value = self.parse_expression()?;
        let binding = self
            .env
            .get(&name)
            .cloned()
            .ok_or_else(|| format!("unknown variable: {name}"))?;

        if !binding.mutable {
            return Err(format!("cannot reassign immutable binding: {name}"));
        }

        if let Some(annotation) = binding.annotation.as_ref() {
            self.validate_annotation(annotation, &value)?;
        }

        self.env.insert(name, Binding { value, ..binding });
        Ok(())
    }

    fn parse_type_annotation(&mut self) -> Result<TypeAnnotation, String> {
        let annotation = self
            .parse_identifier()
            .ok_or_else(|| "expected type annotation after ':'".to_string())?;

        if annotation == "Bool" {
            return Ok(TypeAnnotation::Bool);
        }

        for (suffix, min, max) in Self::typed_suffixes() {
            if suffix == annotation {
                let _ = (min, max);
                return Ok(TypeAnnotation::Integer(suffix));
            }
        }

        Err(format!("unsupported type annotation: {annotation}"))
    }

    fn validate_annotation(
        &self,
        annotation: &TypeAnnotation,
        value: &Value,
    ) -> Result<(), String> {
        match annotation {
            TypeAnnotation::Bool => match value {
                Value::Bool(_) => Ok(()),
                _ => Err(format!("expected Bool value, found {}", value.type_name())),
            },
            TypeAnnotation::Integer(suffix) => {
                let integer = value.expect_integer("type annotation")?;

                for (candidate, min, max) in Self::typed_suffixes() {
                    if candidate == *suffix {
                        if integer < min || integer > max {
                            return Err(format!("value out of range for {suffix}: {integer}"));
                        }

                        return Ok(());
                    }
                }

                Err(format!("unsupported type annotation: {suffix}"))
            }
        }
    }

    fn parse_expression(&mut self) -> Result<Value, String> {
        self.parse_or_expression()
    }

    fn parse_or_expression(&mut self) -> Result<Value, String> {
        let mut value = self.parse_and_expression()?;

        loop {
            self.skip_whitespace();

            if self.consume_str("||") {
                let rhs = self.parse_and_expression()?;
                let lhs = value.expect_bool("logical or")?;
                let rhs = rhs.expect_bool("logical or")?;
                value = Value::Bool(lhs || rhs);
            } else {
                break;
            }
        }

        Ok(value)
    }

    fn parse_and_expression(&mut self) -> Result<Value, String> {
        let mut value = self.parse_additive_expression()?;

        loop {
            self.skip_whitespace();

            if self.consume_str("&&") {
                let rhs = self.parse_additive_expression()?;
                let lhs = value.expect_bool("logical and")?;
                let rhs = rhs.expect_bool("logical and")?;
                value = Value::Bool(lhs && rhs);
            } else {
                break;
            }
        }

        Ok(value)
    }

    fn parse_additive_expression(&mut self) -> Result<Value, String> {
        let mut value = self.parse_term()?;

        loop {
            self.skip_whitespace();

            if self.consume_char('+') {
                let rhs = self.parse_term()?;
                let lhs = value.expect_integer("addition")?;
                let rhs = rhs.expect_integer("addition")?;
                value = Value::Integer(
                    lhs.checked_add(rhs)
                        .ok_or_else(|| self.arithmetic_error("addition"))?,
                );
            } else if self.consume_char('-') {
                let rhs = self.parse_term()?;
                let lhs = value.expect_integer("subtraction")?;
                let rhs = rhs.expect_integer("subtraction")?;
                value = Value::Integer(
                    lhs.checked_sub(rhs)
                        .ok_or_else(|| self.arithmetic_error("subtraction"))?,
                );
            } else {
                break;
            }
        }

        Ok(value)
    }

    fn parse_term(&mut self) -> Result<Value, String> {
        let mut value = self.parse_factor()?;

        loop {
            self.skip_whitespace();

            if self.consume_char('*') {
                let rhs = self.parse_factor()?;
                let lhs = value.expect_integer("multiplication")?;
                let rhs = rhs.expect_integer("multiplication")?;
                value = Value::Integer(
                    lhs.checked_mul(rhs)
                        .ok_or_else(|| self.arithmetic_error("multiplication"))?,
                );
            } else if self.consume_char('/') {
                let rhs = self.parse_factor()?;
                let lhs = value.expect_integer("division")?;
                let rhs = rhs.expect_integer("division")?;
                if rhs == 0 {
                    return Err("division by zero".to_string());
                }

                value = Value::Integer(
                    lhs.checked_div(rhs)
                        .ok_or_else(|| self.arithmetic_error("division"))?,
                );
            } else {
                break;
            }
        }

        Ok(value)
    }

    fn parse_factor(&mut self) -> Result<Value, String> {
        self.skip_whitespace();

        if self.consume_char('!') {
            let value = self.parse_factor()?;
            Ok(Value::Bool(!value.expect_bool("logical not")?))
        } else if self.consume_char('+') {
            let value = self.parse_factor()?;
            Ok(Value::Integer(value.expect_integer("unary plus")?))
        } else if self.consume_char('-') {
            let value = self.parse_factor()?.expect_integer("negation")?;
            Ok(Value::Integer(
                value
                    .checked_neg()
                    .ok_or_else(|| self.arithmetic_error("negation"))?,
            ))
        } else {
            self.parse_primary()
        }
    }

    fn parse_primary(&mut self) -> Result<Value, String> {
        self.skip_whitespace();

        if self.consume_char('(') {
            let value = self.parse_expression()?;
            self.skip_whitespace();

            if self.consume_char(')') {
                Ok(value)
            } else {
                Err("missing closing ')'".to_string())
            }
        } else if self.peek_keyword("true") {
            self.expect_keyword("true")?;
            Ok(Value::Bool(true))
        } else if self.peek_keyword("false") {
            self.expect_keyword("false")?;
            Ok(Value::Bool(false))
        } else if self.peek_char().is_some_and(Self::is_ident_start) {
            let ident = self
                .parse_identifier()
                .ok_or_else(|| "expected identifier".to_string())?;

            if Self::is_reserved_identifier(&ident) {
                Err(format!("unexpected keyword '{ident}'"))
            } else {
                self.env
                    .get(&ident)
                    .map(|binding| binding.value.clone())
                    .ok_or_else(|| format!("unknown variable: {ident}"))
            }
        } else {
            self.parse_literal()
        }
    }

    fn parse_literal(&mut self) -> Result<Value, String> {
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

                return Ok(Value::Integer(value));
            }
        }

        if remaining.chars().next().is_some_and(Self::is_ident_start) {
            return Err(format!("invalid literal: {literal}{remaining}"));
        }

        literal
            .parse::<i128>()
            .map(Value::Integer)
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

    fn validate_identifier_name(&self, name: &str) -> Result<(), String> {
        if Self::is_reserved_identifier(name) {
            Err(format!(
                "reserved keyword cannot be used as identifier: {name}"
            ))
        } else {
            Ok(())
        }
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

    fn peek_assignment_statement(&self) -> bool {
        let mut position = self.position;

        while self.input[position..]
            .chars()
            .next()
            .is_some_and(|ch| ch.is_whitespace())
        {
            position += self.input[position..].chars().next().unwrap().len_utf8();
        }

        let Some(first) = self.input[position..].chars().next() else {
            return false;
        };

        if !Self::is_ident_start(first) {
            return false;
        }

        position += first.len_utf8();

        while self.input[position..]
            .chars()
            .next()
            .is_some_and(Self::is_ident_continue)
        {
            position += self.input[position..].chars().next().unwrap().len_utf8();
        }

        while self.input[position..]
            .chars()
            .next()
            .is_some_and(|ch| ch.is_whitespace())
        {
            position += self.input[position..].chars().next().unwrap().len_utf8();
        }

        self.input[position..].starts_with('=')
    }

    fn expect_keyword(&mut self, keyword: &str) -> Result<(), String> {
        if self.peek_keyword(keyword) {
            self.position += keyword.len();
            Ok(())
        } else {
            Err(format!("expected keyword '{keyword}'"))
        }
    }

    fn expect_statement_terminator(&mut self, statement_name: &str) -> Result<(), String> {
        self.skip_whitespace();

        if self.consume_char(';') {
            Ok(())
        } else {
            Err(format!("expected ';' after {statement_name}"))
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

    fn consume_str(&mut self, expected: &str) -> bool {
        if self.remaining().starts_with(expected) {
            self.position += expected.len();
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

    fn is_reserved_identifier(identifier: &str) -> bool {
        matches!(identifier, "let" | "mut" | "Bool" | "true" | "false")
    }

    fn arithmetic_error(&self, operation: &str) -> String {
        format!("arithmetic overflow during {operation}")
    }
}

impl Value {
    fn into_public_result(self) -> i128 {
        match self {
            Value::Integer(value) => value,
            Value::Bool(value) => {
                if value {
                    1
                } else {
                    0
                }
            }
        }
    }

    fn type_name(&self) -> &'static str {
        match self {
            Value::Integer(_) => "integer",
            Value::Bool(_) => "Bool",
        }
    }

    fn expect_integer(&self, context: &str) -> Result<i128, String> {
        match self {
            Value::Integer(value) => Ok(*value),
            Value::Bool(_) => Err(format!(
                "expected integer for {context}, found {}",
                self.type_name()
            )),
        }
    }

    fn expect_bool(&self, context: &str) -> Result<bool, String> {
        match self {
            Value::Bool(value) => Ok(*value),
            Value::Integer(_) => Err(format!(
                "expected Bool for {context}, found {}",
                self.type_name()
            )),
        }
    }
}

pub use interpret_tuff as interpretTuff;
