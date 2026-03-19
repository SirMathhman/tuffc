use std::collections::HashMap;

pub fn interpret_tuff(input: String) -> i32 {
    let mut parser = Parser::new(&input);
    parser.parse_program()
}

#[derive(Clone)]
struct Parser<'a> {
    input: &'a [u8],
    pos: usize,
    env: Vec<HashMap<String, Variable>>,
    next_location: usize,
    functions: HashMap<String, FunctionDefinition>,
    structs: HashMap<String, StructDefinition>,
    in_function_body: bool,
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
    Array {
        element: Option<Box<ValueType>>,
        len: usize,
    },
    Tuple(Vec<Option<ValueType>>),
    Struct(String),
}

#[derive(Clone, Debug)]
enum RuntimeValue {
    Int(i32),
    Pointer(PointerValue),
    Array(Vec<Value>),
    Tuple(Vec<Value>),
    Struct(HashMap<String, Value>),
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

#[derive(Clone)]
struct Variable {
    value: Value,
    mutable: bool,
    location: String,
}

#[derive(Clone, Debug)]
enum AssignmentTarget {
    Variable(String),
    Deref(Box<AssignmentTarget>),
    Index(Box<AssignmentTarget>, Value),
}

#[derive(Clone, Copy, Debug)]
enum CompoundAssignmentOp {
    Add,
    Sub,
    Mul,
    Div,
}

#[derive(Clone, Copy, Debug)]
enum ComparisonOp {
    Less,
    LessOrEqual,
    Greater,
    GreaterOrEqual,
}

#[derive(Clone, Debug)]
struct StatementValue {
    value: Value,
    allows_following_statement_without_separator: bool,
}

#[derive(Clone)]
struct FunctionParameter {
    name: String,
    ty: ValueType,
}

#[derive(Clone)]
struct FunctionDefinition {
    parameters: Vec<FunctionParameter>,
    return_type: ValueType,
    body: String,
}

#[derive(Clone)]
struct StructFieldDefinition {
    name: String,
    ty: ValueType,
}

#[derive(Clone)]
struct StructDefinition {
    fields: Vec<StructFieldDefinition>,
}

#[derive(Debug)]
struct ReturnSignal(Value);

impl<'a> Parser<'a> {
    fn new(input: &'a str) -> Self {
        Self {
            input: input.as_bytes(),
            pos: 0,
            env: vec![HashMap::new()],
            next_location: 0,
            functions: HashMap::new(),
            structs: HashMap::new(),
            in_function_body: false,
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

        let mut is_finished = |parser: &mut Self, _: &Value| parser.is_eof();
        self.parse_statement_sequence(&mut is_finished, "unexpected trailing input")
            .value
            .as_int()
    }

    fn parse_statement(&mut self) -> StatementValue {
        self.skip_whitespace();

        if self.consume_keyword("let") {
            self.parse_let_statement()
        } else if self.consume_keyword("if") {
            self.parse_if_statement()
        } else if self.consume_keyword("while") {
            self.parse_while_statement()
        } else if self.consume_keyword("fn") {
            self.parse_function_definition_statement()
        } else if self.consume_keyword("struct") {
            self.parse_struct_definition_statement()
        } else if self.consume_keyword("return") {
            self.parse_return_statement()
        } else if let Some(value) = self.try_parse_assignment_statement() {
            StatementValue {
                value,
                allows_following_statement_without_separator: false,
            }
        } else {
            let allows_following_statement_without_separator =
                self.input.get(self.pos) == Some(&b'{');
            StatementValue {
                value: self.parse_expression(),
                allows_following_statement_without_separator,
            }
        }
    }

    fn parse_let_statement(&mut self) -> StatementValue {
        let mutable = self.consume_keyword("mut");
        self.skip_whitespace();

        if self.consume(b'(') {
            return self.parse_tuple_destructuring_let_statement(mutable);
        }

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
        let location = self.allocate_location();
        self.current_scope_mut().insert(
            name.clone(),
            Variable {
                value: stored_value.into_storage().with_access(mutable),
                mutable,
                location: location.clone(),
            },
        );
        StatementValue {
            value: self
                .lookup_variable(&name)
                .value
                .clone()
                .with_place(Some(location))
                .with_access(mutable),
            allows_following_statement_without_separator: false,
        }
    }

    fn parse_function_definition_statement(&mut self) -> StatementValue {
        let name = self.parse_identifier();

        if self.functions.contains_key(&name) {
            panic_with_message("duplicate function definition");
        }

        self.expect(b'(');
        let parameters = self.parse_function_parameters();
        self.expect(b':');
        let return_type = self.parse_type_annotation();

        self.skip_whitespace();
        if !self.consume_str("=>") {
            panic_with_message("expected '=>' ");
        }

        let (body_start, body_end) = self.parse_function_body_range();
        let body = std::str::from_utf8(&self.input[body_start..body_end])
            .expect("utf8")
            .to_string();

        self.functions.insert(
            name,
            FunctionDefinition {
                parameters,
                return_type,
                body,
            },
        );

        StatementValue {
            value: Value::int(0, None, false, None),
            allows_following_statement_without_separator: true,
        }
    }

    fn parse_struct_definition_statement(&mut self) -> StatementValue {
        let name = self.parse_identifier();

        if self.structs.contains_key(&name) {
            panic_with_message("duplicate struct definition");
        }

        self.expect(b'{');
        let fields = self.parse_struct_definition_fields();
        self.expect(b'}');
        let _ = self.consume(b';');

        self.structs.insert(name, StructDefinition { fields });

        StatementValue {
            value: Value::int(0, None, false, None),
            allows_following_statement_without_separator: true,
        }
    }

    fn parse_struct_definition_fields(&mut self) -> Vec<StructFieldDefinition> {
        let mut fields = Vec::new();

        loop {
            self.skip_whitespace();

            if self.input.get(self.pos) == Some(&b'}') {
                break;
            }

            let name = self.parse_identifier();
            self.expect(b':');
            let ty = self.parse_type_annotation();

            if fields
                .iter()
                .any(|field: &StructFieldDefinition| field.name == name)
            {
                panic_with_message("duplicate struct field");
            }

            fields.push(StructFieldDefinition { name, ty });
            self.expect(b';');
        }

        fields
    }

    fn parse_function_parameters(&mut self) -> Vec<FunctionParameter> {
        self.skip_whitespace();

        if self.consume(b')') {
            return vec![];
        }

        let mut parameters = Vec::new();

        loop {
            let name = self.parse_identifier();
            self.expect(b':');
            let ty = self.parse_type_annotation();

            if parameters
                .iter()
                .any(|parameter: &FunctionParameter| parameter.name == name)
            {
                panic_with_message("duplicate function parameter");
            }

            parameters.push(FunctionParameter { name, ty });

            if self.consume(b',') {
                self.skip_whitespace();
                if self.consume(b')') {
                    panic_with_message("invalid function parameter list");
                }
                continue;
            }

            self.expect(b')');
            break;
        }

        parameters
    }

    fn parse_function_body_range(&mut self) -> (usize, usize) {
        self.skip_whitespace();
        let start = self.pos;

        if self.input.get(self.pos) == Some(&b'{') {
            let mut depth = 0usize;

            while let Some(&byte) = self.input.get(self.pos) {
                match byte {
                    b'{' => {
                        depth += 1;
                        self.pos += 1;
                    }
                    b'}' => {
                        self.pos += 1;
                        if depth == 1 {
                            let end = self.pos;
                            self.skip_whitespace();
                            let _ = self.consume(b';');
                            return (start, end);
                        }
                        depth -= 1;
                    }
                    _ => self.pos += 1,
                }
            }

            panic_with_message("expected '}}'")
        } else {
            let mut brace_depth = 0usize;

            while let Some(&byte) = self.input.get(self.pos) {
                match byte {
                    b'{' => {
                        brace_depth += 1;
                        self.pos += 1;
                    }
                    b'}' => {
                        if brace_depth == 0 {
                            panic_with_message("expected ';'");
                        }
                        brace_depth -= 1;
                        self.pos += 1;
                    }
                    b';' if brace_depth == 0 => {
                        let end = self.pos;
                        self.pos += 1;
                        return (start, end);
                    }
                    _ => self.pos += 1,
                }
            }

            panic_with_message("expected ';'")
        }
    }

    fn parse_return_statement(&mut self) -> StatementValue {
        if !self.in_function_body {
            panic_with_message("return outside function");
        }

        let value = self.parse_expression();
        std::panic::panic_any(ReturnSignal(value));
    }

    fn parse_function_call(&mut self, name: String) -> Value {
        let function = self
            .functions
            .get(&name)
            .unwrap_or_else(|| panic!("undefined function"))
            .clone();
        let arguments = self.parse_function_arguments();

        if arguments.len() != function.parameters.len() {
            panic_with_message("argument count mismatch");
        }

        let mut body_parser = Parser::new(function.body.as_str());
        body_parser.functions = self.functions.clone();
        body_parser.structs = self.structs.clone();
        body_parser.in_function_body = true;

        for (parameter, argument) in function.parameters.iter().zip(arguments.into_iter()) {
            let value = body_parser.apply_type_annotation(argument, Some(parameter.ty.clone()));
            let location = body_parser.allocate_location();
            body_parser.current_scope_mut().insert(
                parameter.name.clone(),
                Variable {
                    value: value
                        .into_storage()
                        .with_access(false)
                        .with_place(Some(location.clone())),
                    mutable: false,
                    location,
                },
            );
        }

        let result = match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let value = body_parser.parse_expression();
            body_parser.skip_whitespace();
            if !body_parser.is_eof() {
                panic_with_message("unexpected trailing input");
            }
            value
        })) {
            Ok(value) => value,
            Err(payload) => match payload.downcast::<ReturnSignal>() {
                Ok(signal) => signal.0,
                Err(payload) => std::panic::resume_unwind(payload),
            },
        };

        body_parser.apply_type_annotation(result, Some(function.return_type))
    }

    fn parse_function_arguments(&mut self) -> Vec<Value> {
        self.expect(b'(');
        self.skip_whitespace();

        if self.consume(b')') {
            return vec![];
        }

        let mut arguments = vec![self.parse_expression()];

        loop {
            if self.consume(b',') {
                self.skip_whitespace();
                if self.consume(b')') {
                    panic_with_message("invalid function arguments");
                }

                arguments.push(self.parse_expression());
            } else {
                self.expect(b')');
                break;
            }
        }

        arguments
    }

    fn parse_tuple_destructuring_let_statement(&mut self, mutable: bool) -> StatementValue {
        let names = self.parse_tuple_binding_names();
        self.expect(b'=');

        let value = self.parse_expression();
        let RuntimeValue::Tuple(elements) = value.runtime else {
            panic!("type mismatch");
        };

        if elements.len() != names.len() {
            panic!("type mismatch");
        }

        for (name, element) in names.into_iter().zip(elements.into_iter()) {
            let location = self.allocate_location();
            self.current_scope_mut().insert(
                name,
                Variable {
                    value: element.into_storage().with_access(mutable),
                    mutable,
                    location,
                },
            );
        }

        StatementValue {
            value: Value::int(0, None, false, None),
            allows_following_statement_without_separator: false,
        }
    }

    fn parse_tuple_binding_names(&mut self) -> Vec<String> {
        let mut names = vec![self.parse_identifier()];

        if !self.consume(b',') {
            panic!("expected ','");
        }

        loop {
            if self.consume(b')') {
                panic!("invalid tuple binding pattern");
            }

            names.push(self.parse_identifier());

            if self.consume(b',') {
                continue;
            }

            self.expect(b')');
            break;
        }

        names
    }

    fn parse_statement_sequence(
        &mut self,
        is_finished: &mut dyn FnMut(&mut Self, &Value) -> bool,
        end_error: &'static str,
    ) -> StatementValue {
        let mut last_value = self.parse_statement();

        loop {
            self.skip_whitespace();

            if self.consume(b';') {
                self.skip_whitespace();
                if is_finished(self, &last_value.value) {
                    return last_value;
                }

                if self.is_eof() {
                    panic_with_message(end_error);
                }

                last_value = self.parse_statement();
            } else if is_finished(self, &last_value.value) {
                return last_value;
            } else if self.is_eof() {
                panic_with_message(end_error);
            } else if last_value.allows_following_statement_without_separator {
                last_value = self.parse_statement();
            } else {
                panic!("unexpected trailing input");
            }
        }
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
        let assignment = match self.parse_assignment_operator() {
            Some(assignment) => assignment,
            None => {
                self.pos = start;
                return None;
            }
        };

        let value = self.parse_expression();
        let (location, indices, requires_binding_mutability) =
            self.resolve_assignment_access(&target);
        let variable = self.lookup_variable_mut_by_location(&location);

        if requires_binding_mutability && !variable.mutable {
            panic!("assignment to immutable variable");
        }

        if indices.is_empty() {
            let new_value = match assignment {
                None => value,
                Some(op) => apply_compound_assignment(variable.value.clone(), value, op),
            };

            let merged_type =
                merge_assignment_type(variable.value.ty.clone(), new_value.ty.clone());
            variable.value = new_value
                .into_storage()
                .with_ty(merged_type)
                .with_access(variable.mutable);
            Some(variable.value.clone().with_place(Some(location)))
        } else {
            let element = variable.value.array_element_mut(&indices);
            let new_value = match assignment {
                None => value,
                Some(op) => apply_compound_assignment(element.clone(), value, op),
            };
            let merged_type = merge_assignment_type(element.ty.clone(), new_value.ty.clone());
            *element = new_value
                .into_storage()
                .with_ty(merged_type)
                .with_access(variable.mutable);
            Some(element.clone())
        }
    }

    fn parse_assignment_operator(&mut self) -> Option<Option<CompoundAssignmentOp>> {
        if self.consume_str("+=") {
            Some(Some(CompoundAssignmentOp::Add))
        } else if self.consume_str("-=") {
            Some(Some(CompoundAssignmentOp::Sub))
        } else if self.consume_str("*=") {
            Some(Some(CompoundAssignmentOp::Mul))
        } else if self.consume_str("/=") {
            Some(Some(CompoundAssignmentOp::Div))
        } else if self.input.get(self.pos) == Some(&b'=')
            && self.input.get(self.pos + 1) != Some(&b'=')
        {
            self.pos += 1;
            Some(None)
        } else {
            None
        }
    }

    fn parse_assignment_target(&mut self) -> Option<AssignmentTarget> {
        self.skip_whitespace();

        let mut target = if self.consume(b'*') {
            let target = self.parse_assignment_target()?;
            AssignmentTarget::Deref(Box::new(target))
        } else if self.starts_identifier() {
            AssignmentTarget::Variable(self.parse_identifier())
        } else {
            return None;
        };

        loop {
            if self.consume(b'[') {
                let index = self.parse_expression();
                self.expect(b']');
                target = AssignmentTarget::Index(Box::new(target), index);
            } else {
                break;
            }
        }

        Some(target)
    }

    fn resolve_assignment_access(&self, target: &AssignmentTarget) -> (String, Vec<usize>, bool) {
        match target {
            AssignmentTarget::Variable(name) => {
                (self.lookup_variable(name).location.clone(), vec![], true)
            }
            AssignmentTarget::Deref(inner) => {
                let (inner_location, inner_indices, _) = self.resolve_assignment_access(inner);
                if !inner_indices.is_empty() {
                    panic!("assignment through immutable pointer");
                }

                let inner_value = self
                    .lookup_variable_by_location(&inner_location)
                    .value
                    .clone()
                    .with_place(Some(inner_location.clone()));

                let pointer = inner_value.as_pointer();
                if !pointer.mutable {
                    panic!("assignment through immutable pointer");
                }

                (pointer.target.clone(), vec![], false)
            }
            AssignmentTarget::Index(inner, index) => {
                let (location, mut indices, requires_binding_mutability) =
                    self.resolve_assignment_access(inner);
                indices.push(parse_array_index_value(index.clone()));
                (location, indices, requires_binding_mutability)
            }
        }
    }

    fn allocate_location(&mut self) -> String {
        let location = format!("#{}", self.next_location);
        self.next_location += 1;
        location
    }

    fn push_scope(&mut self) {
        self.env.push(HashMap::new());
    }

    fn pop_scope(&mut self) {
        self.env.pop().expect("scope underflow");
    }

    fn current_scope_mut(&mut self) -> &mut HashMap<String, Variable> {
        self.env.last_mut().expect("scope underflow")
    }

    fn lookup_variable(&self, name: &str) -> &Variable {
        for scope in self.env.iter().rev() {
            if let Some(variable) = scope.get(name) {
                return variable;
            }
        }

        panic!("undefined variable");
    }

    fn lookup_variable_by_location(&self, location: &str) -> &Variable {
        for scope in self.env.iter().rev() {
            for variable in scope.values() {
                if variable.location == location {
                    return variable;
                }
            }
        }

        panic!("assignment to undeclared variable");
    }

    fn lookup_variable_mut_by_location(&mut self, location: &str) -> &mut Variable {
        for scope in self.env.iter_mut().rev() {
            if let Some(variable) = scope
                .values_mut()
                .find(|variable| variable.location == location)
            {
                return variable;
            }
        }

        panic!("assignment to undeclared variable");
    }

    fn parse_block_expression(&mut self) -> Value {
        self.push_scope();
        let value = self.parse_block_contents();
        self.pop_scope();
        value
    }

    fn parse_block_contents(&mut self) -> Value {
        self.skip_whitespace();

        if self.consume(b'}') {
            return Value::int(0, None, false, None);
        }

        let mut is_finished = |parser: &mut Self, _: &Value| parser.consume(b'}');
        self.parse_statement_sequence(&mut is_finished, "expected '}'")
            .value
    }

    fn parse_if_condition(&mut self) -> Value {
        self.skip_whitespace();
        self.expect(b'(');
        let condition = self.parse_expression();
        self.expect(b')');

        if condition.ty != Some(ValueType::Bool) {
            panic!("expected bool value");
        }

        condition
    }

    fn parse_if_statement(&mut self) -> StatementValue {
        let condition = self.parse_if_condition();

        let mut branch_parser = self.clone();
        let then_branch = branch_parser.parse_statement();

        if condition.as_int() != 0 {
            *self = branch_parser;
            return StatementValue {
                value: then_branch.value,
                allows_following_statement_without_separator: true,
            };
        }

        self.pos = branch_parser.pos;
        StatementValue {
            value: Value::int(0, None, false, None),
            allows_following_statement_without_separator: true,
        }
    }

    fn parse_while_statement(&mut self) -> StatementValue {
        let condition_start = self.pos;
        let mut iterations = 0usize;

        loop {
            self.pos = condition_start;
            let condition = self.parse_if_condition();

            if condition.as_int() == 0 {
                let mut branch_parser = self.clone();
                branch_parser.parse_statement();
                self.pos = branch_parser.pos;
                return StatementValue {
                    value: Value::int(0, None, false, None),
                    allows_following_statement_without_separator: true,
                };
            }

            if iterations >= 1024 {
                panic!("while iteration limit exceeded");
            }
            iterations += 1;

            self.parse_statement();
        }
    }

    fn parse_if_expression(&mut self) -> Value {
        let condition = self.parse_if_condition();

        let then_branch = self.parse_expression();

        if !self.consume_keyword("else") {
            panic!("expected 'else'");
        }

        if condition.as_int() != 0 {
            self.skip_expression();
            then_branch
        } else {
            let else_branch = self.parse_expression();
            let merged_type = merge_assignment_type(then_branch.ty.clone(), else_branch.ty.clone());
            else_branch.with_ty(merged_type)
        }
    }

    fn skip_expression(&mut self) {
        let mut paren_depth = 0usize;
        let mut brace_depth = 0usize;
        let mut bracket_depth = 0usize;

        loop {
            self.skip_whitespace();

            let Some(&byte) = self.input.get(self.pos) else {
                break;
            };

            match byte {
                b'(' => {
                    paren_depth += 1;
                    self.pos += 1;
                }
                b')' if paren_depth == 0 && brace_depth == 0 && bracket_depth == 0 => break,
                b')' => {
                    paren_depth -= 1;
                    self.pos += 1;
                }
                b'{' => {
                    brace_depth += 1;
                    self.pos += 1;
                }
                b'}' if paren_depth == 0 && brace_depth == 0 && bracket_depth == 0 => break,
                b'}' => {
                    brace_depth -= 1;
                    self.pos += 1;
                }
                b'[' => {
                    bracket_depth += 1;
                    self.pos += 1;
                }
                b']' if paren_depth == 0 && brace_depth == 0 && bracket_depth == 0 => break,
                b']' => {
                    bracket_depth -= 1;
                    self.pos += 1;
                }
                b';' if paren_depth == 0 && brace_depth == 0 && bracket_depth == 0 => break,
                _ => self.pos += 1,
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
        } else if self.consume(b'[') {
            self.parse_array_type_annotation()
        } else if self.consume(b'(') {
            self.parse_tuple_type_annotation()
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
                name if self.structs.contains_key(name) => ValueType::Struct(name.to_string()),
                _ => panic!("invalid type annotation"),
            }
        }
    }

    fn parse_array_type_annotation(&mut self) -> ValueType {
        let element = self.parse_type_annotation();
        self.expect(b';');
        self.skip_whitespace();
        let start = self.consume_ascii_digits();

        if self.pos == start {
            panic!("expected array length");
        }

        let length = std::str::from_utf8(&self.input[start..self.pos])
            .expect("utf8")
            .parse::<usize>()
            .expect("invalid array length");
        self.expect(b']');

        ValueType::Array {
            element: Some(Box::new(element)),
            len: length,
        }
    }

    fn parse_tuple_type_annotation(&mut self) -> ValueType {
        let mut element_types = vec![Some(self.parse_type_annotation())];

        if !self.consume(b',') {
            panic!("expected ','");
        }

        loop {
            if self.consume(b')') {
                panic!("invalid tuple type annotation");
            }

            element_types.push(Some(self.parse_type_annotation()));

            if self.consume(b',') {
                continue;
            }

            self.expect(b')');
            break;
        }

        ValueType::Tuple(element_types)
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
        let mut value = self.parse_comparison();

        loop {
            if self.consume_str("==") {
                value = compare_values(value, self.parse_comparison(), true);
            } else if self.consume_str("!=") {
                value = compare_values(value, self.parse_comparison(), false);
            } else {
                break;
            }
        }

        value
    }

    fn parse_comparison(&mut self) -> Value {
        let mut value = self.parse_additive();

        loop {
            if self.consume_str("<=") {
                value =
                    compare_ordered_values(value, self.parse_additive(), ComparisonOp::LessOrEqual);
            } else if self.consume_str(">=") {
                value = compare_ordered_values(
                    value,
                    self.parse_additive(),
                    ComparisonOp::GreaterOrEqual,
                );
            } else if self.consume(b'<') {
                value = compare_ordered_values(value, self.parse_additive(), ComparisonOp::Less);
            } else if self.consume(b'>') {
                value = compare_ordered_values(value, self.parse_additive(), ComparisonOp::Greater);
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
            self.parse_postfix()
        }
    }

    fn parse_postfix(&mut self) -> Value {
        let mut value = self.parse_primary();

        loop {
            if self.consume(b'.') {
                if self
                    .input
                    .get(self.pos)
                    .copied()
                    .is_some_and(|byte| byte.is_ascii_digit())
                {
                    let index = self.parse_tuple_index();
                    value = self.tuple_index(value, index);
                } else {
                    let field = self.parse_identifier();
                    value = self.struct_field(value, &field);
                }
            } else if self.consume(b'[') {
                let index = self.parse_expression();
                self.expect(b']');
                value = self.array_index(value, parse_array_index_value(index));
            } else {
                break;
            }
        }

        value
    }

    fn parse_tuple_index(&mut self) -> usize {
        self.skip_whitespace();
        let start = self.consume_ascii_digits();

        let index = std::str::from_utf8(&self.input[start..self.pos]).expect("utf8");
        index.parse::<usize>().expect("invalid tuple index")
    }

    fn tuple_index(&self, value: Value, index: usize) -> Value {
        let RuntimeValue::Tuple(elements) = value.runtime else {
            panic!("expected tuple value");
        };

        elements
            .get(index)
            .cloned()
            .unwrap_or_else(|| panic!("tuple index out of bounds"))
    }

    fn array_index(&self, value: Value, index: usize) -> Value {
        value
            .as_array()
            .get(index)
            .cloned()
            .unwrap_or_else(|| panic!("array index out of bounds"))
    }

    fn struct_field(&self, value: Value, field: &str) -> Value {
        let RuntimeValue::Struct(fields) = value.runtime else {
            panic!("expected struct value");
        };

        fields
            .get(field)
            .cloned()
            .unwrap_or_else(|| panic!("unknown struct field"))
    }

    fn parse_primary(&mut self) -> Value {
        self.skip_whitespace();

        if self.consume(b'{') {
            self.parse_block_expression()
        } else if self.consume_keyword("if") {
            self.parse_if_expression()
        } else if self.consume(b'[') {
            self.parse_array_literal()
        } else if self.consume(b'(') {
            self.parse_parenthesized_or_tuple_expression()
        } else if self.consume_keyword("true") {
            Value::int(1, Some(ValueType::Bool), false, None)
        } else if self.consume_keyword("false") {
            Value::int(0, Some(ValueType::Bool), false, None)
        } else if self.starts_identifier() {
            let name = self.parse_identifier();
            self.skip_whitespace();

            if self.input.get(self.pos) == Some(&b'(') {
                self.parse_function_call(name)
            } else if self.input.get(self.pos) == Some(&b'{') {
                self.parse_struct_literal(name)
            } else {
                let variable = self.lookup_variable(&name);
                variable
                    .value
                    .clone()
                    .with_place(Some(variable.location.clone()))
                    .with_access(variable.mutable)
            }
        } else {
            self.parse_number_literal()
        }
    }

    fn parse_array_literal(&mut self) -> Value {
        self.skip_whitespace();

        if self.consume(b']') {
            return Value::array(vec![], false, None);
        }

        let mut elements = vec![self.parse_expression().into_storage()];

        loop {
            if !self.consume(b',') {
                self.expect(b']');
                break;
            }

            if self.consume(b']') {
                panic!("invalid array literal");
            }

            elements.push(self.parse_expression().into_storage());
        }

        Value::array(elements, false, None)
    }

    fn parse_struct_literal(&mut self, name: String) -> Value {
        let struct_definition = self
            .structs
            .get(&name)
            .cloned()
            .unwrap_or_else(|| panic!("undefined struct"));

        self.expect(b'{');
        let mut fields = HashMap::new();

        if !self.consume(b'}') {
            loop {
                let field_name = self.parse_identifier();

                if fields.contains_key(&field_name) {
                    panic!("duplicate struct field");
                }

                let field_definition = struct_definition
                    .fields
                    .iter()
                    .find(|field| field.name == field_name)
                    .unwrap_or_else(|| panic!("unknown struct field"));

                self.expect(b':');
                let value = self.parse_expression();
                let value = self.apply_type_annotation(value, Some(field_definition.ty.clone()));
                fields.insert(field_name, value.into_storage());

                if self.consume(b',') {
                    if self.consume(b'}') {
                        panic!("invalid struct literal");
                    }
                    continue;
                }

                self.expect(b'}');
                break;
            }
        }

        for field_definition in &struct_definition.fields {
            if !fields.contains_key(&field_definition.name) {
                panic!("missing struct field");
            }
        }

        Value::struct_value(name, fields, false, None)
    }

    fn parse_parenthesized_or_tuple_expression(&mut self) -> Value {
        self.skip_whitespace();

        if self.consume(b')') {
            panic!("empty tuple literal");
        }

        let first = self.parse_expression();
        if !self.consume(b',') {
            self.expect(b')');
            return first;
        }

        let mut elements = vec![first.into_storage()];

        loop {
            if self.consume(b')') {
                panic!("invalid tuple literal");
            }

            elements.push(self.parse_expression().into_storage());

            if self.consume(b',') {
                continue;
            }

            self.expect(b')');
            break;
        }

        Value::tuple(elements, false, None)
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

        let start = self.consume_ascii_digits();

        if self.pos == start {
            panic!("expected numeric literal");
        }

        while let Some(&byte) = self.input.get(self.pos) {
            if byte.is_ascii_whitespace()
                || byte == b'+'
                || byte == b'-'
                || byte == b'*'
                || byte == b'/'
                || byte == b'<'
                || byte == b'>'
                || byte == b')'
                || byte == b'}'
                || byte == b'['
                || byte == b']'
                || byte == b','
                || byte == b';'
                || byte == b'='
                || byte == b':'
                || byte == b'.'
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

    fn consume_ascii_digits(&mut self) -> usize {
        let start = self.pos;
        while let Some(&byte) = self.input.get(self.pos) {
            if !byte.is_ascii_digit() {
                break;
            }
            self.pos += 1;
        }
        start
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
        let target_value = self.lookup_variable_by_location(&pointer.target);

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

fn panic_with_message(message: &str) -> ! {
    panic!("{}", message);
}

fn parse_array_index_value(index: Value) -> usize {
    let numeric_index = index.ensure_numeric();
    usize::try_from(numeric_index).unwrap_or_else(|_| panic!("array index out of bounds"))
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

fn apply_compound_assignment(current: Value, rhs: Value, op: CompoundAssignmentOp) -> Value {
    let left = current.ensure_numeric();
    let right = rhs.ensure_numeric();

    let value = match op {
        CompoundAssignmentOp::Add => left.checked_add(right).expect("addition overflow"),
        CompoundAssignmentOp::Sub => left.checked_sub(right).expect("subtraction overflow"),
        CompoundAssignmentOp::Mul => left.checked_mul(right).expect("multiplication overflow"),
        CompoundAssignmentOp::Div => {
            if right == 0 {
                panic!("division by zero");
            }
            left / right
        }
    };

    Value::int(value, current.ty, current.mutable_access, current.place)
}

fn compare_values(left: Value, right: Value, equal: bool) -> Value {
    let left_ty = left.ty.clone();
    let right_ty = right.ty.clone();

    if !comparison_types_compatible(left_ty.as_ref(), right_ty.as_ref()) {
        panic!("type mismatch");
    }

    let values_equal = values_equal(&left, &right);
    let result = if equal { values_equal } else { !values_equal };

    Value::int(
        if result { 1 } else { 0 },
        Some(ValueType::Bool),
        false,
        None,
    )
}

fn values_equal(left: &Value, right: &Value) -> bool {
    match (&left.runtime, &right.runtime) {
        (RuntimeValue::Int(left), RuntimeValue::Int(right)) => left == right,
        (RuntimeValue::Pointer(_), RuntimeValue::Pointer(_)) => panic!("type mismatch"),
        (RuntimeValue::Tuple(left), RuntimeValue::Tuple(right)) => {
            slices_match(left, right, |left, right| values_equal(left, right))
        }
        _ => false,
    }
}

fn compare_ordered_values(left: Value, right: Value, op: ComparisonOp) -> Value {
    let left_ty = left.ty.clone();
    let right_ty = right.ty.clone();

    if !ordered_comparison_types_compatible(left_ty.as_ref(), right_ty.as_ref()) {
        panic!("type mismatch");
    }

    let left = left.ensure_numeric();
    let right = right.ensure_numeric();

    let result = match op {
        ComparisonOp::Less => left < right,
        ComparisonOp::LessOrEqual => left <= right,
        ComparisonOp::Greater => left > right,
        ComparisonOp::GreaterOrEqual => left >= right,
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
    if matches!(left, Some(ValueType::Array { .. }))
        || matches!(right, Some(ValueType::Array { .. }))
    {
        return false;
    }

    if let (Some(ValueType::Tuple(left)), Some(ValueType::Tuple(right))) = (left, right) {
        return tuple_type_compatible(left, right);
    }

    if matches!(left, Some(ValueType::Tuple(_) | ValueType::Struct(_)))
        || matches!(right, Some(ValueType::Tuple(_) | ValueType::Struct(_)))
    {
        return false;
    }

    let left_bool = matches!(left, Some(ValueType::Bool));
    let right_bool = matches!(right, Some(ValueType::Bool));

    if left_bool || right_bool {
        left_bool && right_bool
    } else {
        comparison_operands_are_numeric(left, right)
    }
}

fn ordered_comparison_types_compatible(
    left: Option<&ValueType>,
    right: Option<&ValueType>,
) -> bool {
    if matches!(left, Some(ValueType::Bool))
        || matches!(right, Some(ValueType::Bool))
        || matches!(left, Some(ValueType::Array { .. }))
        || matches!(right, Some(ValueType::Array { .. }))
        || matches!(left, Some(ValueType::Tuple(_)))
        || matches!(right, Some(ValueType::Tuple(_)))
        || matches!(left, Some(ValueType::Struct(_)))
        || matches!(right, Some(ValueType::Struct(_)))
    {
        false
    } else {
        comparison_operands_are_numeric(left, right)
    }
}

fn comparison_operands_are_numeric(left: Option<&ValueType>, right: Option<&ValueType>) -> bool {
    !matches!(left, Some(ValueType::Pointer { .. }))
        && !matches!(right, Some(ValueType::Pointer { .. }))
}

fn tuple_type_compatible(left: &[Option<ValueType>], right: &[Option<ValueType>]) -> bool {
    slices_match(left, right, |left, right| {
        match (left.as_ref(), right.as_ref()) {
            (Some(left), Some(right)) => {
                type_is_compatible(left, Some(right)) && type_is_compatible(right, Some(left))
            }
            _ => true,
        }
    })
}

fn slices_match<T, U, F>(left: &[T], right: &[U], mut predicate: F) -> bool
where
    F: FnMut(&T, &U) -> bool,
{
    left.len() == right.len() && left.iter().zip(right.iter()).all(|(l, r)| predicate(l, r))
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
            (
                ValueType::Array {
                    element: expected_element,
                    len: expected_len,
                },
                ValueType::Array {
                    element: actual_element,
                    len: actual_len,
                },
            ) => {
                expected_len == actual_len
                    && match (expected_element.as_deref(), actual_element.as_deref()) {
                        (Some(expected_element), Some(actual_element)) => {
                            type_is_compatible(expected_element, Some(actual_element))
                        }
                        _ => true,
                    }
            }
            (ValueType::Tuple(expected), ValueType::Tuple(actual)) => {
                tuple_type_compatible(expected, actual)
            }
            (ValueType::Struct(expected), ValueType::Struct(actual)) => expected == actual,
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

    fn tuple(elements: Vec<Value>, mutable_access: bool, place: Option<String>) -> Self {
        let tuple_type = ValueType::Tuple(elements.iter().map(|value| value.ty.clone()).collect());
        Self {
            runtime: RuntimeValue::Tuple(elements),
            ty: Some(tuple_type),
            place,
            mutable_access,
        }
    }

    fn array(elements: Vec<Value>, mutable_access: bool, place: Option<String>) -> Self {
        let len = elements.len();
        let element_type = elements.iter().fold(None, |acc, value| {
            merge_assignment_type(acc, value.ty.clone())
        });
        Self {
            runtime: RuntimeValue::Array(elements),
            ty: Some(ValueType::Array {
                element: element_type.map(Box::new),
                len,
            }),
            place,
            mutable_access,
        }
    }

    fn struct_value(
        name: String,
        fields: HashMap<String, Value>,
        mutable_access: bool,
        place: Option<String>,
    ) -> Self {
        Self {
            runtime: RuntimeValue::Struct(fields),
            ty: Some(ValueType::Struct(name)),
            place,
            mutable_access,
        }
    }

    fn as_int(&self) -> i32 {
        match &self.runtime {
            RuntimeValue::Int(value) => *value,
            RuntimeValue::Pointer(_) => panic!("expected numeric value"),
            RuntimeValue::Array(_) => panic!("expected numeric value"),
            RuntimeValue::Tuple(_) => panic!("expected numeric value"),
            RuntimeValue::Struct(_) => panic!("expected numeric value"),
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
            RuntimeValue::Int(_)
            | RuntimeValue::Array(_)
            | RuntimeValue::Tuple(_)
            | RuntimeValue::Struct(_) => {
                panic!("dereferencing non-pointer")
            }
        }
    }

    fn as_array(&self) -> &[Value] {
        match &self.runtime {
            RuntimeValue::Array(values) => values,
            _ => panic!("expected array value"),
        }
    }

    fn array_element_mut(&mut self, indices: &[usize]) -> &mut Value {
        if indices.is_empty() {
            return self;
        }

        let (first, rest) = indices.split_first().expect("indices checked above");
        let RuntimeValue::Array(values) = &mut self.runtime else {
            panic!("expected array value");
        };
        let element = values
            .get_mut(*first)
            .unwrap_or_else(|| panic!("array index out of bounds"));
        element.array_element_mut(rest)
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
    use super::{interpret_tuff, values_equal, Value, ValueType};

    fn sample_tuple_value() -> Value {
        Value::tuple(
            vec![
                Value::int(1, Some(ValueType::U8), false, None),
                Value::int(2, Some(ValueType::U8), false, None),
            ],
            false,
            None,
        )
    }

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
    fn if_expression_returns_then_branch_when_condition_is_true() {
        assert_eq!(
            interpret_tuff("let x = if (true) 3 else 5; x".to_string()),
            3
        );
    }

    #[test]
    fn if_expression_returns_else_branch_when_condition_is_false() {
        assert_eq!(
            interpret_tuff("let x = if (false) 3 else 5; x".to_string()),
            5
        );
    }

    #[test]
    fn if_expression_can_return_block_values() {
        assert_eq!(
            interpret_tuff(
                "let x = if (true) { let y = 3; y } else { let y = 5; y }; x".to_string()
            ),
            3
        );
    }

    #[test]
    fn if_statement_with_single_statement_body_updates_binding() {
        assert_eq!(
            interpret_tuff("let mut x = 0; if (true) x = 3; x".to_string()),
            3
        );
    }

    #[test]
    fn if_statement_with_block_body_updates_binding() {
        assert_eq!(
            interpret_tuff("let mut x = 0; if (true) { x = 3; } x".to_string()),
            3
        );
    }

    #[test]
    fn if_statement_false_branch_leaves_state_unchanged() {
        assert_eq!(
            interpret_tuff("let mut x = 0; if (false) x = 3; x".to_string()),
            0
        );
    }

    #[test]
    fn if_statement_false_branch_with_block_body_leaves_state_unchanged() {
        assert_eq!(
            interpret_tuff("let mut x = 0; if (false) { x = 3; } x".to_string()),
            0
        );
    }

    #[test]
    fn while_statement_with_single_statement_body_updates_binding() {
        assert_eq!(
            interpret_tuff("let mut x = 0; while (x < 3) x += 1; x".to_string()),
            3
        );
    }

    #[test]
    fn while_statement_with_block_body_updates_binding() {
        assert_eq!(
            interpret_tuff("let mut x = 0; while (x < 3) { x += 1; } x".to_string()),
            3
        );
    }

    #[test]
    fn while_statement_evaluates_to_zero_when_condition_is_false() {
        assert_eq!(interpret_tuff("while (false) 3".to_string()), 0);
    }

    #[test]
    fn while_iteration_limit_allows_1024_iterations() {
        assert_eq!(
            interpret_tuff("let mut x = 0; while (x < 1024) x += 1; x".to_string()),
            1024
        );
    }

    #[test]
    fn while_iteration_limit_is_per_loop_instance() {
        assert_eq!(
            interpret_tuff(
                "let mut outer = 0; let mut sum = 0; while (outer < 2) { let mut inner = 0; while (inner < 1024) inner += 1; sum += inner; outer += 1; } sum"
                    .to_string()
            ),
            2048
        );
    }

    #[test]
    fn tuple_index_access_returns_expected_values() {
        assert_eq!(
            interpret_tuff("let t = (1U8, 2U8); t.0 + t.1".to_string()),
            3
        );
    }

    #[test]
    fn tuple_type_annotation_accepts_matching_tuple() {
        assert_eq!(
            interpret_tuff("let t : (U8, Bool) = (1U8, true); t.0".to_string()),
            1
        );
    }

    #[test]
    fn nested_tuple_access_works() {
        assert_eq!(
            interpret_tuff("let t = ((1U8, 2U8), (3U8, 4U8)); t.1.0".to_string()),
            3
        );
    }

    #[test]
    fn tuple_equality_and_inequality_work() {
        assert_eq!(interpret_tuff("(1U8, 2U8) == (1U8, 2U8)".to_string()), 1);
        assert_eq!(interpret_tuff("(1U8, 2U8) != (1U8, 3U8)".to_string()), 1);
    }

    #[test]
    fn tuple_equality_allows_untyped_and_typed_element_compatibility() {
        assert_eq!(interpret_tuff("(1, 2) == (1U8, 2U8)".to_string()), 1);
    }

    #[test]
    fn array_index_access_returns_expected_value() {
        assert_eq!(
            interpret_tuff("let a = [1U8, 2U8, 3U8]; a[1]".to_string()),
            2
        );
    }

    #[test]
    fn array_type_annotation_accepts_matching_literal() {
        assert_eq!(
            interpret_tuff("let a : [U8; 3] = [1U8, 2U8, 3U8]; a[2]".to_string()),
            3
        );
    }

    #[test]
    fn empty_array_literal_is_allowed_with_typed_binding() {
        assert_eq!(interpret_tuff("let a : [U8; 0] = []; 0".to_string()), 0);
    }

    #[test]
    fn nested_array_indexing_works() {
        assert_eq!(
            interpret_tuff("let a = [[1U8, 2U8], [3U8, 4U8]]; a[1][0]".to_string()),
            3
        );
    }

    #[test]
    fn mutable_array_element_assignment_updates_value() {
        assert_eq!(
            interpret_tuff("let mut a = [1U8, 2U8, 3U8]; a[1] = 9U8; a[1]".to_string()),
            9
        );
    }

    #[test]
    fn mutable_array_element_compound_assignment_updates_value() {
        assert_eq!(
            interpret_tuff("let mut a = [1U8, 2U8, 3U8]; a[1] += 7U8; a[1]".to_string()),
            9
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_array_annotation_length_mismatch() {
        interpret_tuff("let a : [U8; 2] = [1U8, 2U8, 3U8]; a[0]".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_array_annotation_element_type_mismatch() {
        interpret_tuff("let a : [U8; 2] = [1U8, true]; a[0]".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_array_index_out_of_bounds() {
        interpret_tuff("let a = [1U8, 2U8]; a[2]".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_array_index_with_non_numeric_value() {
        interpret_tuff("let a = [1U8, 2U8]; a[true]".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_array_index_with_negative_value() {
        interpret_tuff("let a = [1U8, 2U8]; a[-1]".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_array_indexing_non_array_value() {
        interpret_tuff("1U8[0]".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_array_element_assignment_on_non_array_binding() {
        interpret_tuff("let mut x = 1U8; x[0] = 2U8; x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_array_element_assignment_through_immutable_binding() {
        interpret_tuff("let a = [1U8, 2U8]; a[0] = 3U8; a[0]".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_array_element_assignment_out_of_bounds() {
        interpret_tuff("let mut a = [1U8, 2U8]; a[2] = 3U8; a[0]".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_array_equality_not_supported_yet() {
        interpret_tuff("[1U8, 2U8] == [1U8, 2U8]".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_mixed_array_equality_not_supported_yet() {
        interpret_tuff("[1U8, 2U8] == 1U8".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_array_type_annotation_with_negative_length() {
        interpret_tuff("let a : [U8; -1] = [1U8]; a[0]".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_array_literal_with_trailing_comma() {
        interpret_tuff("[1U8, 2U8,]".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_when_array_value_is_used_as_numeric_directly() {
        interpret_tuff("let a = [1U8, 2U8]; a + 1".to_string());
    }

    #[test]
    fn struct_literal_field_access_returns_expected_value() {
        assert_eq!(
            interpret_tuff(
                "struct Point { x : I32; y : I32; } let p = Point { x: 3, y: 4 }; p.x + p.y"
                    .to_string()
            ),
            7
        );
    }

    #[test]
    fn struct_type_annotation_accepts_matching_literal() {
        assert_eq!(
            interpret_tuff(
                "struct Point { x : I32; y : I32; } let p : Point = Point { x: 1, y: 2 }; p.y"
                    .to_string()
            ),
            2
        );
    }

    #[test]
    fn empty_struct_literal_is_allowed() {
        assert_eq!(
            interpret_tuff("struct Unit {} let unit = Unit {}; 0".to_string()),
            0
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_duplicate_struct_definition() {
        interpret_tuff(
            "struct Point { x : I32; } struct Point { y : I32; } 0".to_string(),
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_duplicate_struct_field_in_definition() {
        interpret_tuff("struct Point { x : I32; x : I32; } 0".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_unknown_struct_name() {
        interpret_tuff("let p = Point { x: 1, y: 2 }; p.x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_unknown_struct_field_in_literal() {
        interpret_tuff(
            "struct Point { x : I32; y : I32; } let p = Point { x: 1, z: 2, y: 3 }; p.x"
                .to_string(),
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_missing_required_struct_field() {
        interpret_tuff(
            "struct Point { x : I32; y : I32; } let p = Point { x: 1 }; p.x".to_string(),
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_duplicate_struct_field_in_literal() {
        interpret_tuff(
            "struct Point { x : I32; y : I32; } let p = Point { x: 1, x: 2, y: 3 }; p.x"
                .to_string(),
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_struct_field_type_mismatch() {
        interpret_tuff(
            "struct Point { x : I32; y : I32; } let p = Point { x: true, y: 2 }; p.x"
                .to_string(),
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_field_access_on_non_struct_value() {
        interpret_tuff("1.x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_unknown_field_access() {
        interpret_tuff(
            "struct Point { x : I32; y : I32; } let p = Point { x: 1, y: 2 }; p.z".to_string(),
        );
    }

    #[test]
    #[should_panic]
    fn panics_when_struct_value_is_used_as_numeric_directly() {
        interpret_tuff(
            "struct Point { x : I32; y : I32; } let p = Point { x: 1, y: 2 }; p + 1".to_string(),
        );
    }

    #[test]
    fn tuple_destructuring_binding_works() {
        assert_eq!(
            interpret_tuff("let (x, y) = (1U8, 2U8); x + y".to_string()),
            3
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_tuple_type_annotation_mismatch() {
        interpret_tuff("let t : (U8, Bool) = (1U8, 2U8); t.0".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_tuple_equality_arity_mismatch() {
        interpret_tuff("(1U8, 2U8) == (1U8, 2U8, 3U8)".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_tuple_literal_with_single_element() {
        interpret_tuff("(1U8,)".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_tuple_literal_with_trailing_comma() {
        interpret_tuff("(1U8, 2U8,)".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_tuple_index_out_of_bounds() {
        interpret_tuff("let t = (1U8, 2U8); t.2".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_tuple_index_on_non_tuple() {
        interpret_tuff("1U8.0".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_tuple_destructuring_arity_mismatch() {
        interpret_tuff("let (x, y) = (1U8, 2U8, 3U8); x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_tuple_destructuring_non_tuple_value() {
        interpret_tuff("let (x, y) = 1U8; x".to_string());
    }

    #[test]
    fn tuple_destructuring_supports_more_than_two_bindings() {
        assert_eq!(
            interpret_tuff("let (a, b, c) = (1U8, 2U8, 3U8); a + b + c".to_string()),
            6
        );
    }

    #[test]
    fn tuple_type_annotation_supports_more_than_two_elements() {
        assert_eq!(
            interpret_tuff("let t : (U8, U8, U8) = (1U8, 2U8, 3U8); t.2".to_string()),
            3
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_tuple_destructuring_single_binding_pattern() {
        interpret_tuff("let (x) = (1U8, 2U8); x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_tuple_destructuring_trailing_comma_pattern() {
        interpret_tuff("let (x,) = (1U8, 2U8); x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_tuple_type_annotation_single_element() {
        interpret_tuff("let t : (U8) = (1U8, 2U8); t.0".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_tuple_type_annotation_trailing_comma() {
        interpret_tuff("let t : (U8,) = (1U8, 2U8); t.0".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_missing_tuple_index_after_dot() {
        interpret_tuff("let t = (1U8, 2U8); t.".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_tuple_numeric_equality_mismatch() {
        interpret_tuff("(1U8, 2U8) == 1U8".to_string());
    }

    #[test]
    #[should_panic]
    fn values_equal_panics_on_pointer_values() {
        let pointer_type = Some(ValueType::Pointer {
            mutable: false,
            pointee: None,
        });
        let left = Value::pointer("#0".to_string(), false, pointer_type.clone(), false, None);
        let right = Value::pointer("#1".to_string(), false, pointer_type, false, None);
        values_equal(&left, &right);
    }

    #[test]
    fn values_equal_returns_false_for_mismatched_runtime_kinds() {
        let int_value = Value::int(1, None, false, None);
        let tuple_value = sample_tuple_value();
        assert!(!values_equal(&int_value, &tuple_value));
    }

    #[test]
    #[should_panic]
    fn panics_when_tuple_value_is_used_as_numeric_directly() {
        let tuple_value = sample_tuple_value();
        tuple_value.as_int();
    }

    #[test]
    #[should_panic]
    fn panics_on_tuple_element_assignment() {
        interpret_tuff("let mut t = (1U8, 2U8); t.0 = 3U8; t.0".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_empty_tuple_literal() {
        interpret_tuff("()".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_non_bool_while_condition() {
        interpret_tuff("while (1) 3".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_when_while_iteration_limit_exceeded() {
        interpret_tuff("let mut x = 0; while (x <= 1024) x += 1; x".to_string());
    }

    #[test]
    fn block_statement_can_be_followed_by_another_statement_without_semicolon() {
        assert_eq!(interpret_tuff("let mut x = 0; { x = 3; } x".to_string()), 3);
    }

    #[test]
    fn if_statement_in_block_can_be_followed_by_statement_without_semicolon() {
        assert_eq!(
            interpret_tuff("let mut x = 0; { if (true) x = 3 x } x".to_string()),
            3
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_non_bool_if_condition() {
        interpret_tuff("if (1) 3 else 5".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_non_bool_if_condition_in_expression() {
        interpret_tuff("let x = if (1) 3 else 5; x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_missing_else_branch() {
        interpret_tuff("let x = if (true) 3; x".to_string());
    }

    #[test]
    fn numeric_comparisons_return_bool_values() {
        assert_eq!(interpret_tuff("1 < 2".to_string()), 1);
        assert_eq!(interpret_tuff("2 < 1".to_string()), 0);
        assert_eq!(interpret_tuff("2 <= 2".to_string()), 1);
        assert_eq!(interpret_tuff("3 > 2".to_string()), 1);
        assert_eq!(interpret_tuff("3 >= 4".to_string()), 0);
    }

    #[test]
    fn comparison_results_can_bind_to_bool_variables() {
        assert_eq!(
            interpret_tuff("let flag : Bool = 1 < 2; flag".to_string()),
            1
        );
        assert_eq!(
            interpret_tuff("let mut flag : Bool = 3 >= 4; flag".to_string()),
            0
        );
    }

    #[test]
    fn comparison_precedence_is_lower_than_additive() {
        assert_eq!(interpret_tuff("1 + 1 < 3".to_string()), 1);
        assert_eq!(interpret_tuff("1 + 1 < 3 == true".to_string()), 1);
    }

    #[test]
    #[should_panic]
    fn panics_when_comparison_result_is_used_as_numeric() {
        interpret_tuff("1 + (2 < 3)".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_when_comparison_result_is_bound_as_numeric() {
        interpret_tuff("let x : U8 = 1 < 2; x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_bool_ordered_comparison() {
        interpret_tuff("true < false".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_pointer_ordered_comparison() {
        interpret_tuff("let x = 0; let p = &x; p < p".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_pointer_ordered_comparison_with_pointer_on_right() {
        interpret_tuff("let x = 0; let p = &x; 1 < p".to_string());
    }

    #[test]
    fn block_expression_returns_last_statement_value() {
        assert_eq!(
            interpret_tuff("let x = { let y = 1; y + 2 }; x".to_string()),
            3
        );
    }

    #[test]
    fn block_shadowing_does_not_modify_outer_binding() {
        assert_eq!(
            interpret_tuff("let mut x = 0; { let mut x = 1; x = 2; }; x".to_string()),
            0
        );
    }

    #[test]
    fn empty_block_evaluates_to_zero() {
        assert_eq!(interpret_tuff("{}".to_string()), 0);
    }

    #[test]
    #[should_panic]
    fn panics_when_block_local_binding_used_outside_block() {
        interpret_tuff("let x = { let y = 1; y }; x + y".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_block_missing_statement_separator() {
        interpret_tuff("let x = { let y = 1 y }; x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_unterminated_block_after_semicolon() {
        interpret_tuff("{ let x = 1;".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_unterminated_block_without_semicolon() {
        interpret_tuff("{ let x = 1".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_dangling_pointer_dereference_after_block() {
        interpret_tuff("let p = { let x = 1; &x }; *p".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_dangling_pointer_assignment_after_block() {
        interpret_tuff("let p = { let mut x = 1; &mut x }; *p = 2".to_string());
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
    fn compound_assignment_updates_mutable_variable() {
        assert_eq!(
            interpret_tuff("let mut x : U8 = 10U8; x += 5; x -= 3; x *= 2; x /= 4; x".to_string()),
            6
        );
    }

    #[test]
    fn compound_assignment_updates_mutable_pointer_target() {
        assert_eq!(
            interpret_tuff(
                "let mut x : U8 = 10U8; let y : *mut U8 = &mut x; *y += 5; x".to_string()
            ),
            15
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_compound_assignment_to_immutable_variable() {
        interpret_tuff("let x : U8 = 1U8; x += 1; x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_compound_assignment_through_immutable_pointer() {
        interpret_tuff("let x : U8 = 1U8; let y : *U8 = &x; *y += 1; x".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_compound_division_by_zero() {
        interpret_tuff("let mut x : U8 = 4U8; x /= 0; x".to_string());
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
    fn program_with_trailing_semicolon_returns_last_value() {
        assert_eq!(interpret_tuff("5U8;".to_string()), 5);
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

    #[test]
    fn function_with_expression_body_returns_expected_value() {
        assert_eq!(
            interpret_tuff(
                "fn add(first : I32, second : I32) : I32 => first + second; add(2, 3)".to_string()
            ),
            5
        );
    }

    #[test]
    fn function_with_block_body_returns_expected_value() {
        assert_eq!(
            interpret_tuff(
                "fn add(first : I32, second : I32) : I32 => { first + second } add(4, 5)"
                    .to_string()
            ),
            9
        );
    }

    #[test]
    fn function_with_block_body_allows_optional_trailing_semicolon() {
        assert_eq!(
            interpret_tuff("fn one() : I32 => { 1 }; one()".to_string()),
            1
        );
    }

    #[test]
    fn function_with_block_body_can_return_nested_block_expression() {
        assert_eq!(
            interpret_tuff("fn nested() : I32 => { { 1 } } nested()".to_string()),
            1
        );
    }

    #[test]
    fn function_with_explicit_return_statement_returns_expected_value() {
        assert_eq!(
            interpret_tuff(
                "fn add(first : I32, second : I32) : I32 => { return first + second; } add(6, 7)"
                    .to_string()
            ),
            13
        );
    }

    #[test]
    fn recursive_function_calls_work() {
        assert_eq!(
            interpret_tuff(
                "fn fact(n : I32) : I32 => if (n == 0) 1 else n * fact(n - 1); fact(5)".to_string()
            ),
            120
        );
    }

    #[test]
    fn function_syntax_and_lazy_if_branches_cover_remaining_paths() {
        assert_eq!(
            interpret_tuff(
                "fn choose_a() : I32 => (if (true) { 1 } else [1U8, 2U8][0]); choose_a()"
                    .to_string()
            ),
            1
        );
        assert_eq!(
            interpret_tuff("let x = (if (true) { 1 } else [1U8, 2U8][0]); x".to_string()),
            1
        );
        assert_eq!(
            interpret_tuff("let x = [if (true) 1 else 2]; x[0]".to_string()),
            1
        );
        assert_eq!(
            interpret_tuff("let x = if (true) 1 else { 2 }; x".to_string()),
            1
        );
        assert_eq!(
            interpret_tuff("fn pick() : I32 => { return if (true) 1 else 2 } pick()".to_string()),
            1
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_duplicate_function_definition() {
        interpret_tuff("fn dup() : I32 => 1; fn dup() : I32 => 2; dup()".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_missing_function_arrow() {
        interpret_tuff("fn missing_arrow() : I32 1".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_duplicate_function_parameter() {
        interpret_tuff(
            "fn duplicate_param(a : I32, a : I32) : I32 => a; duplicate_param(1)".to_string(),
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_trailing_comma_in_function_parameter_list() {
        interpret_tuff("fn trailing_param(a : I32,) : I32 => a; trailing_param(1)".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_missing_closing_brace_in_function_body() {
        interpret_tuff("fn missing_brace() : I32 => { 1; missing_brace()".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_function_expression_body_without_semicolon() {
        interpret_tuff("fn missing_semicolon() : I32 => 1".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_function_expression_body_with_unmatched_closing_brace() {
        interpret_tuff("fn stray_brace() : I32 => }".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_function_body_runtime_error() {
        interpret_tuff("fn body_panics() : I32 => x; body_panics()".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_trailing_comma_in_function_call_arguments() {
        interpret_tuff(
            "fn call_trailing_comma(a : I32) : I32 => a; call_trailing_comma(1,)".to_string(),
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_function_call_with_wrong_arity() {
        interpret_tuff(
            "fn add(first : I32, second : I32) : I32 => first + second; add(1)".to_string(),
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_call_to_undefined_function() {
        interpret_tuff("missing()".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_function_call_with_argument_type_mismatch() {
        interpret_tuff(
            "fn add(first : I32, second : I32) : I32 => first + second; add(true, 1)".to_string(),
        );
    }

    #[test]
    #[should_panic]
    fn panics_on_function_return_type_mismatch() {
        interpret_tuff("fn bad() : I32 => true; bad()".to_string());
    }

    #[test]
    #[should_panic]
    fn panics_on_return_outside_function_body() {
        interpret_tuff("return 1".to_string());
    }
}

fn main() {
    println!("Hello, world!");
}
