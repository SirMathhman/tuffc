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

#[derive(Clone, Debug, PartialEq, Eq)]
enum ValueType {
    U8,
    U16,
    U32,
    U64,
    I8,
    I16,
    I32,
    I64,
    Bool,
    Pointer {
        mutable: bool,
        pointee: Option<Box<ValueType>>,
    },
}

#[derive(Clone, Debug)]
enum RuntimeValue {
    Int(i32),
    Pointer(PointerValue),
}

#[derive(Clone, Debug)]
struct PointerValue {
    target: String,
    mutable: bool,
}

#[derive(Clone, Debug)]
struct Value {
    runtime: RuntimeValue,
    ty: Option<ValueType>,
    place: Option<String>,
    mutable_access: bool,
}

struct Variable {
    value: Value,
    mutable: bool,
}

#[derive(Clone, Debug)]
enum AssignmentTarget {
    Variable(String),
    Deref(Box<AssignmentTarget>),
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
                    return last_value.as_int();
                }

                last_value = self.parse_statement();
            } else if self.is_eof() {
                return last_value.as_int();
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
            name.clone(),
            Variable {
                value: stored_value.into_storage().with_access(mutable),
                mutable,
            },
        );
        self.env
            .get(&name)
            .unwrap()
            .value
            .clone()
            .with_place(Some(name))
            .with_access(mutable)
    }

    fn try_parse_assignment_statement(&mut self) -> Option<Value> {
        let start = self.pos;
        let target = match self.parse_assignment_target() {
            Some(target) => target,
            None => {
                self.pos = start;
                return None;
            }
        };

        self.skip_whitespace();
        if self.input.get(self.pos) != Some(&b'=') || self.input.get(self.pos + 1) == Some(&b'=') {
            self.pos = start;
            return None;
        }

        self.pos += 1;

        let value = self.parse_expression();
        let location = self.resolve_assignment_location(&target);
        let variable = self
            .env
            .get_mut(&location)
            .expect("assignment to undeclared variable");

        if matches!(target, AssignmentTarget::Variable(_)) && !variable.mutable {
            panic!("assignment to immutable variable");
        }

        let merged_type = merge_assignment_type(variable.value.ty.clone(), value.ty.clone());
        variable.value = value
            .into_storage()
            .with_ty(merged_type)
            .with_access(variable.mutable);
        Some(variable.value.clone().with_place(Some(location)))
    }

    fn parse_assignment_target(&mut self) -> Option<AssignmentTarget> {
        self.skip_whitespace();

        if self.consume(b'*') {
            let target = self.parse_assignment_target()?;
            Some(AssignmentTarget::Deref(Box::new(target)))
        } else if self.starts_identifier() {
            Some(AssignmentTarget::Variable(self.parse_identifier()))
        } else {
            None
        }
    }

    fn resolve_assignment_location(&self, target: &AssignmentTarget) -> String {
        match target {
            AssignmentTarget::Variable(name) => name.clone(),
            AssignmentTarget::Deref(inner) => {
                let inner_location = self.resolve_assignment_location(inner);
                let inner_value = self
                    .env
                    .get(&inner_location)
                    .expect("assignment to undeclared variable")
                    .value
                    .clone()
                    .with_place(Some(inner_location.clone()));

                let pointer = inner_value.as_pointer();
                if !pointer.mutable {
                    panic!("assignment through immutable pointer");
                }

                pointer.target.clone()
            }
        }
    }

    fn parse_type_annotation(&mut self) -> ValueType {
        self.skip_whitespace();

        if self.consume(b'*') {
            let mutable = self.consume_keyword("mut");
            let pointee = self.parse_type_annotation();
            ValueType::Pointer {
                mutable,
                pointee: Some(Box::new(pointee)),
            }
        } else {
            match self.parse_identifier().as_str() {
                "U8" => ValueType::U8,
                "U16" => ValueType::U16,
                "U32" => ValueType::U32,
                "U64" => ValueType::U64,
                "I8" => ValueType::I8,
                "I16" => ValueType::I16,
                "I32" => ValueType::I32,
                "I64" => ValueType::I64,
                "Bool" => ValueType::Bool,
                _ => panic!("invalid type annotation"),
            }
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

    fn consume_str(&mut self, expected: &str) -> bool {
        self.skip_whitespace();
        let bytes = expected.as_bytes();
        if self.input.get(self.pos..self.pos + bytes.len()) == Some(bytes) {
            self.pos += bytes.len();
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
        let mut value = self.parse_additive();

        loop {
            if self.consume_str("==") {
                value = compare_values(value, self.parse_additive(), true);
            } else if self.consume_str("!=") {
                value = compare_values(value, self.parse_additive(), false);
            } else {
                break;
            }
        }

        value
    }

    fn parse_additive(&mut self) -> Value {
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
                if divisor.as_int() == 0 {
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
            Value::int(
                value.as_int().checked_neg().expect("negation overflow"),
                value.ty,
                value.mutable_access,
                value.place,
            )
        } else if self.consume(b'!') {
            let value = self.parse_factor();
            negate_bool(value)
        } else if self.consume(b'&') {
            let mutable = self.consume_keyword("mut");
            let value = self.parse_factor();
            self.address_of_value(value, mutable)
        } else if self.consume(b'*') {
            let value = self.parse_factor();
            self.dereference_value(value)
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
        } else if self.consume_keyword("true") {
            Value::int(1, Some(ValueType::Bool), false, None)
        } else if self.consume_keyword("false") {
            Value::int(0, Some(ValueType::Bool), false, None)
        } else if self.starts_identifier() {
            let name = self.parse_identifier();
            let variable = self.env.get(&name).expect("undefined variable");
            self.env
                .get(&name)
                .expect("undefined variable")
                .value
                .clone()
                .with_place(Some(name))
                .with_access(variable.mutable)
        } else {
            self.parse_number_literal()
        }
    }

    fn starts_identifier(&self) -> bool {
        self.input
            .get(self.pos)
            .copied()
            .is_some_and(|byte| byte.is_ascii_alphabetic() || byte == b'_')
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

        Value::int(value as i32, parse_literal_type(suffix), false, None)
    }

    fn apply_type_annotation(&self, value: Value, declared_type: Option<ValueType>) -> Value {
        match declared_type {
            Some(ValueType::Bool) if value.ty != Some(ValueType::Bool) => {
                panic!("type mismatch");
            }
            Some(expected) if !type_is_compatible(&expected, value.ty.as_ref()) => {
                panic!("type mismatch");
            }
            Some(expected) => value.with_ty(Some(expected)),
            None => value,
        }
    }

    fn address_of_value(&self, value: Value, mutable: bool) -> Value {
        let target = value
            .place
            .expect("taking address of unsupported expression");

        if mutable && !value.mutable_access {
            panic!("taking address of unsupported expression");
        }

        Value::pointer(
            target,
            mutable,
            Some(pointer_type_from_value(value.ty.as_ref(), mutable)),
            false,
            None,
        )
    }

    fn dereference_value(&self, value: Value) -> Value {
        let pointer = value.as_pointer();
        let target_value = self
            .env
            .get(&pointer.target)
            .expect("dereferencing non-pointer");

        let dereferenced = target_value
            .value
            .clone()
            .with_place(Some(pointer.target.clone()));

        dereferenced.with_access(pointer.mutable)
    }
}

fn combine_numeric_values<F>(left: Value, right: Value, op: F) -> Value
where
    F: FnOnce(i32, i32) -> i32,
{
    let left = left.ensure_numeric();
    let right = right.ensure_numeric();
    Value::int(op(left, right), None, false, None)
}

fn merge_assignment_type(
    current_type: Option<ValueType>,
    new_type: Option<ValueType>,
) -> Option<ValueType> {
    match (current_type, new_type) {
        (Some(expected), Some(actual)) => {
            if !type_is_compatible(&expected, Some(&actual)) {
                panic!("type mismatch");
            } else {
                Some(expected)
            }
        }
        (Some(expected), None) => Some(expected),
        (None, Some(actual)) => Some(actual),
        (None, None) => None,
    }
}

fn compare_values(left: Value, right: Value, equal: bool) -> Value {
    let left_ty = left.ty.clone();
    let right_ty = right.ty.clone();

    if !comparison_types_compatible(left_ty.as_ref(), right_ty.as_ref()) {
        panic!("type mismatch");
    }

    let result = if equal {
        left.as_int() == right.as_int()
    } else {
        left.as_int() != right.as_int()
    };

    Value::int(
        if result { 1 } else { 0 },
        Some(ValueType::Bool),
        false,
        None,
    )
}

fn negate_bool(value: Value) -> Value {
    if value.ty != Some(ValueType::Bool) {
        panic!("expected bool value");
    }

    Value::int(
        if value.as_int() == 0 { 1 } else { 0 },
        Some(ValueType::Bool),
        false,
        None,
    )
}

fn comparison_types_compatible(left: Option<&ValueType>, right: Option<&ValueType>) -> bool {
    match (left, right) {
        (Some(ValueType::Bool), Some(ValueType::Bool)) => true,
        (Some(ValueType::Pointer { .. }), Some(ValueType::Pointer { .. })) => false,
        (Some(ValueType::Bool), Some(_)) | (Some(_), Some(ValueType::Bool)) => false,
        _ => true,
    }
}

fn type_is_compatible(expected: &ValueType, actual: Option<&ValueType>) -> bool {
    match actual {
        None => true,
        Some(actual) => match (expected, actual) {
            (
                ValueType::Pointer {
                    mutable: expected_mut,
                    pointee: expected_inner,
                },
                ValueType::Pointer {
                    mutable: actual_mut,
                    pointee: actual_inner,
                },
            ) => {
                expected_mut == actual_mut
                    && match (expected_inner.as_deref(), actual_inner.as_deref()) {
                        (Some(expected_inner), Some(actual_inner)) => {
                            type_is_compatible(expected_inner, Some(actual_inner))
                        }
                        _ => true,
                    }
            }
            _ => expected == actual,
        },
    }
}

fn pointer_type_from_value(value_type: Option<&ValueType>, mutable: bool) -> ValueType {
    ValueType::Pointer {
        mutable,
        pointee: value_type.map(|ty| Box::new(ty.clone())),
    }
}

impl Value {
    fn int(value: i32, ty: Option<ValueType>, mutable_access: bool, place: Option<String>) -> Self {
        Self {
            runtime: RuntimeValue::Int(value),
            ty,
            place,
            mutable_access,
        }
    }

    fn pointer(
        target: String,
        mutable: bool,
        ty: Option<ValueType>,
        mutable_access: bool,
        place: Option<String>,
    ) -> Self {
        Self {
            runtime: RuntimeValue::Pointer(PointerValue { target, mutable }),
            ty,
            place,
            mutable_access,
        }
    }

    fn as_int(&self) -> i32 {
        match &self.runtime {
            RuntimeValue::Int(value) => *value,
            RuntimeValue::Pointer(_) => panic!("expected numeric value"),
        }
    }

    fn ensure_numeric(&self) -> i32 {
        if self.ty == Some(ValueType::Bool) {
            panic!("expected numeric value");
        }

        self.as_int()
    }

    fn as_pointer(&self) -> &PointerValue {
        match &self.runtime {
            RuntimeValue::Pointer(pointer) => pointer,
            RuntimeValue::Int(_) => panic!("dereferencing non-pointer"),
        }
    }

    fn with_ty(mut self, ty: Option<ValueType>) -> Self {
        self.ty = ty;
        self
    }

    fn with_place(mut self, place: Option<String>) -> Self {
        self.place = place;
        self
    }

    fn with_access(mut self, mutable_access: bool) -> Self {
        self.mutable_access = mutable_access;
        self
    }

    fn into_storage(mut self) -> Self {
        self.place = None;
        self
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
        assert_eq!(
            interpret_tuff("let mut x : U8 = 0; x = 100U8; x".to_string()),
            100
        );
    }

    #[test]
    fn typed_mutable_binding_accepts_matching_variable_assignment() {
        assert_eq!(
            interpret_tuff("let mut x : U8 = 7U8; x = x; x".to_string()),
            7
        );
    }

    #[test]
    fn pointer_address_and_dereference_round_trip() {
        assert_eq!(
            interpret_tuff("let x : U8 = 7U8; let p : *U8 = &x; *p".to_string()),
            7
        );
    }

    #[test]
    fn nested_pointer_forms_work() {
        assert_eq!(
            interpret_tuff("let x : U8 = 9U8; let p : *U8 = &x; let q : *U8 = &*p; *q".to_string()),
            9
        );
    }

    #[test]
    fn mutable_pointer_allows_assignment_through_deref() {
        assert_eq!(
            interpret_tuff("let mut x = 0; let y : *mut I32 = &mut x; *y = 100; x".to_string()),
            100
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_pointer_annotation_type_mismatch() {
        interpret_tuff("let x : U8 = 1U8; let p : *U16 = &x; *p".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_dereferencing_non_pointer() {
        interpret_tuff("*5".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_taking_address_of_literal() {
        interpret_tuff("&5".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_taking_mutable_address_of_immutable_variable() {
        interpret_tuff("let x = 0; let p = &mut x; p".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_assignment_through_immutable_pointer() {
        interpret_tuff("let x : U8 = 1U8; let p : *U8 = &x; *p = 2; x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_assignment_through_undeclared_pointer_variable() {
        interpret_tuff("*x = 1".to_string());
    }

    #[test]
    fn infers_pointer_type_from_untyped_variable() {
        assert_eq!(
            interpret_tuff("let mut x = 0; let p = &x; *p".to_string()),
            0
        );
    }

    #[test]
    #[should_panic]
    fn panics_when_program_result_is_pointer() {
        interpret_tuff("let x = 0; &x".to_string());
    }

    #[test]
    fn true_literal_evaluates_to_one() {
        assert_eq!(interpret_tuff("true".to_string()), 1);
    }

    #[test]
    fn false_literal_evaluates_to_zero() {
        assert_eq!(interpret_tuff("false".to_string()), 0);
    }

    #[test]
    fn bool_binding_and_reassignment_work() {
        assert_eq!(
            interpret_tuff("let mut flag : Bool = true; flag = false; flag".to_string()),
            0
        );
    }

    #[test]
    fn bool_annotation_infers_and_checks_values() {
        assert_eq!(
            interpret_tuff("let flag : Bool = true; flag".to_string()),
            1
        );
    }

    #[test]
    fn bool_equality_returns_numeric_result() {
        assert_eq!(interpret_tuff("true == false".to_string()), 0);
        assert_eq!(interpret_tuff("true != false".to_string()), 1);
    }

    #[test]
    fn numeric_equality_returns_numeric_result() {
        assert_eq!(interpret_tuff("1 == 1".to_string()), 1);
        assert_eq!(interpret_tuff("1 != 2".to_string()), 1);
    }

    #[test]
    fn bool_not_operator_flips_truthiness() {
        assert_eq!(interpret_tuff("!true".to_string()), 0);
        assert_eq!(interpret_tuff("!false".to_string()), 1);
    }

    #[test]
    #[should_panic]
    fn panics_on_invalid_bool_annotation() {
        interpret_tuff("let flag : Bool = 1; flag".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_bool_numeric_equality() {
        interpret_tuff("let x : U8 = 1; true == x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_pointer_equality() {
        interpret_tuff("let x = 0; let p = &x; p == p".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_taking_mutable_address_of_immutable_binding() {
        interpret_tuff("let x = 0; &mut x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_bool_value_in_numeric_expression() {
        interpret_tuff("true + 1".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_numeric_negation_of_bool() {
        interpret_tuff("!1".to_string());
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
