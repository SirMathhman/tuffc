use std::collections::HashMap;

pub fn interpret_tuff(input: String) -> i32 {
    let mut parser = Parser::new(&input);
    parser.parse_program()
}

struct Parser<'a> {
    input: &'a [u8],
    pos: usize,
    env: HashMap<String, Variable>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ValueType {
    U8,
    U16,
    U32,
    U64,
    I8,
    I16,
    I32,
    I64,
}

#[derive(Clone, Copy, Debug)]
struct Value {
    value: i32,
    ty: Option<ValueType>,
}

struct Variable {
    value: Value,
    mutable: bool,
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
                    return last_value.value;
                }

                last_value = self.parse_statement();
            } else if self.is_eof() {
                return last_value.value;
            } else {
                panic!("unexpected trailing input");
            }
        }
    }

    fn parse_statement(&mut self) -> Value {
        self.skip_whitespace();

        if self.consume_keyword("let") {
            self.parse_let_statement()
        } else if let Some(value) = self.try_parse_assignment_statement() {
            value
        } else {
            self.parse_expression()
        }
    }

    fn parse_let_statement(&mut self) -> Value {
        let mutable = self.consume_keyword("mut");
        let name = self.parse_identifier();

        self.skip_whitespace();
        let declared_type = if self.consume(b':') {
            Some(self.parse_type_annotation())
        } else {
            None
        };
        self.expect(b'=');

        let value = self.parse_expression();
        let stored_value = self.apply_type_annotation(value, declared_type);
        self.env.insert(
            name,
            Variable {
                value: stored_value,
                mutable,
            },
        );
        stored_value
    }

    fn try_parse_assignment_statement(&mut self) -> Option<Value> {
        let start = self.pos;
        let name = match self.input.get(self.pos).copied() {
            Some(byte) if byte.is_ascii_alphabetic() || byte == b'_' => self.parse_identifier(),
            _ => return None,
        };

        self.skip_whitespace();
        if !self.consume(b'=') {
            self.pos = start;
            return None;
        }

        let value = self.parse_expression();
        let variable = self
            .env
            .get_mut(&name)
            .unwrap_or_else(|| panic!("assignment to undeclared variable"));

        if !variable.mutable {
            panic!("assignment to immutable variable");
        }

        variable.value.ty = merge_assignment_type(variable.value.ty, value.ty);
        variable.value.value = value.value;
        Some(variable.value)
    }

    fn parse_type_annotation(&mut self) -> ValueType {
        match self.parse_identifier().as_str() {
            "U8" => ValueType::U8,
            "U16" => ValueType::U16,
            "U32" => ValueType::U32,
            "U64" => ValueType::U64,
            "I8" => ValueType::I8,
            "I16" => ValueType::I16,
            "I32" => ValueType::I32,
            "I64" => ValueType::I64,
            _ => panic!("invalid type annotation"),
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

    fn parse_expression(&mut self) -> Value {
        let mut value = self.parse_term();

        loop {
            if self.consume(b'+') {
                value = combine_numeric_values(value, self.parse_term(), |a, b| {
                    a.checked_add(b).expect("addition overflow")
                });
            } else if self.consume(b'-') {
                value = combine_numeric_values(value, self.parse_term(), |a, b| {
                    a.checked_sub(b).expect("subtraction overflow")
                });
            } else {
                break;
            }
        }

        value
    }

    fn parse_term(&mut self) -> Value {
        let mut value = self.parse_factor();

        loop {
            if self.consume(b'*') {
                value = combine_numeric_values(value, self.parse_factor(), |a, b| {
                    a.checked_mul(b).expect("multiplication overflow")
                });
            } else if self.consume(b'/') {
                let divisor = self.parse_factor();
                if divisor.value == 0 {
                    panic!("division by zero");
                }
                value = combine_numeric_values(value, divisor, |a, b| a / b);
            } else {
                break;
            }
        }

        value
    }

    fn parse_factor(&mut self) -> Value {
        self.skip_whitespace();

        if self.consume(b'+') {
            self.parse_factor()
        } else if self.consume(b'-') {
            let value = self.parse_factor();
            Value {
                value: value.value.checked_neg().expect("negation overflow"),
                ty: value.ty,
            }
        } else {
            self.parse_primary()
        }
    }

    fn parse_primary(&mut self) -> Value {
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
            self.env
                .get(&name)
                .unwrap_or_else(|| panic!("undefined variable"))
                .value
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

    fn parse_number_literal(&mut self) -> Value {
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

        // safe: `digits` contains only ASCII digit bytes collected above
        let value = digits.parse::<i128>().expect("invalid numeric literal");

        if value > i32::MAX as i128 {
            panic!("numeric literal overflow");
        }

        Value {
            value: value as i32,
            ty: parse_literal_type(suffix),
        }
    }

    fn apply_type_annotation(&self, value: Value, declared_type: Option<ValueType>) -> Value {
        match (declared_type, value.ty) {
            (Some(expected), Some(actual)) if expected != actual => {
                panic!("type mismatch");
            }
            (Some(expected), _) => Value {
                value: value.value,
                ty: Some(expected),
            },
            (None, _) => value,
        }
    }
}

fn combine_numeric_values<F>(left: Value, right: Value, op: F) -> Value
where
    F: FnOnce(i32, i32) -> i32,
{
    Value {
        value: op(left.value, right.value),
        ty: None,
    }
}

fn merge_assignment_type(
    current_type: Option<ValueType>,
    new_type: Option<ValueType>,
) -> Option<ValueType> {
    match (current_type, new_type) {
        (Some(expected), Some(actual)) => if expected != actual { panic!("type mismatch"); } else { Some(expected) },
        (Some(expected), None) => Some(expected),
        (None, Some(actual)) => Some(actual),
        (None, None) => None,
    }
}

fn parse_literal_type(suffix: &str) -> Option<ValueType> {
    match suffix {
        "U8" => Some(ValueType::U8),
        "U16" => Some(ValueType::U16),
        "U32" => Some(ValueType::U32),
        "U64" => Some(ValueType::U64),
        "I8" => Some(ValueType::I8),
        "I16" => Some(ValueType::I16),
        "I32" => Some(ValueType::I32),
        "I64" => Some(ValueType::I64),
        _ => None,
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
    fn untyped_mutable_binding_can_adopt_type_from_assignment() {
        assert_eq!(
            interpret_tuff("let mut x = 0; x = 100U16; x".to_string()),
            100
        );
    }

    #[test]
    fn untyped_mutable_binding_can_remain_untyped_after_assignment() {
        assert_eq!(interpret_tuff("let mut x = 0; x = 1; x".to_string()), 1);
    }

    #[test]
    #[should_panic]
    fn panics_on_invalid_type_annotation_name() {
        interpret_tuff("let x : X9 = 1; x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_reassignment_type_mismatch() {
        interpret_tuff("let mut x : U8 = 0; x = 100U16; x".to_string());
    }

    #[test]
    fn supports_all_remaining_type_suffixes() {
        assert_eq!(interpret_tuff("let a : U32 = 1U32; a".to_string()), 1);
        assert_eq!(interpret_tuff("let b : U64 = 2U64; b".to_string()), 2);
        assert_eq!(interpret_tuff("let c : I8 = 3I8; c".to_string()), 3);
        assert_eq!(interpret_tuff("let d : I16 = 4I16; d".to_string()), 4);
        assert_eq!(interpret_tuff("let e : I32 = 5I32; e".to_string()), 5);
        assert_eq!(interpret_tuff("let f : I64 = 6I64; f".to_string()), 6);
    }

    #[test]
    fn unannotated_binding_infers_from_literal_suffix() {
        assert_eq!(interpret_tuff("let x = 100U16; x".to_string()), 100);
    }

    #[test]
    #[should_panic]
    fn panics_when_binding_type_does_not_match_annotation() {
        interpret_tuff("let x = 100U16; let y : U8 = x; y".to_string());
    }

    #[test]
    fn mut_variable_can_be_reassigned() {
        assert_eq!(
            interpret_tuff("let mut x : U8 = 0; x = 100U8 + 50U8; x".to_string()),
            150
        );
    }

    #[test]
    fn typed_mutable_binding_accepts_matching_typed_assignment() {
        assert_eq!(interpret_tuff("let mut x : U8 = 0; x = 100U8; x".to_string()), 100);
    }

    #[test]
    fn typed_mutable_binding_accepts_matching_variable_assignment() {
        assert_eq!(interpret_tuff("let mut x : U8 = 7U8; x = x; x".to_string()), 7);
    }

    #[test]
    fn reassignment_result_is_visible_in_later_expression() {
        assert_eq!(
            interpret_tuff("let mut x : U8 = 1; x = x + 1; x + 1".to_string()),
            3
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_reassignment_without_mut() {
        interpret_tuff("let x : U8 = 0; x = 1; x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_assignment_to_undeclared_variable() {
        interpret_tuff("x = 1; x".to_string());
    }

    #[test]
    fn unary_plus_evaluates_to_positive_value() {
        assert_eq!(interpret_tuff("+5".to_string()), 5);
    }

    #[test]
    fn unary_minus_negates_value() {
        assert_eq!(interpret_tuff("-5".to_string()), -5);
    }

    #[test]
    fn binary_subtraction_evaluates_correctly() {
        assert_eq!(interpret_tuff("8 - 3".to_string()), 5);
    }

    #[test]
    fn binary_division_evaluates_correctly() {
        assert_eq!(interpret_tuff("8 / 2".to_string()), 4);
    }

    #[test]
    #[should_panic]
    fn panics_on_unexpected_trailing_input() {
        interpret_tuff("5 10".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_when_expect_byte_not_found() {
        interpret_tuff("let x U8 = 5; x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_when_identifier_starts_with_digit() {
        interpret_tuff("let 5 : U8 = 10; 5".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_invalid_character_in_literal_suffix() {
        interpret_tuff("42$".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_invalid_named_literal_suffix() {
        interpret_tuff("42X9".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_numeric_literal_overflow() {
        interpret_tuff("2147483648".to_string());
    }

    #[test]
    fn main_runs() {
        super::main();
    }

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
