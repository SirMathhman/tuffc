use std::collections::HashMap;

use crate::ast::*;
use crate::lexer::Span;

#[derive(Debug, Clone)]
pub struct SemanticError {
    pub message: String,
    pub span: Span,
}

impl std::fmt::Display for SemanticError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Semantic error at line {} column {}: {}",
            self.span.line, self.span.column, self.message
        )
    }
}

impl std::error::Error for SemanticError {}

pub type SemanticResult<T> = Result<T, SemanticError>;

#[derive(Debug, Clone)]
pub struct FunctionSignature {
    pub params: Vec<Type>,
    pub return_type: Type,
}

#[derive(Debug, Clone)]
pub struct StructInfo {
    pub fields: HashMap<String, Type>,
}

pub struct TypeChecker {
    // Global scope: functions and structs
    functions: HashMap<String, FunctionSignature>,
    structs: HashMap<String, StructInfo>,

    // Local scopes (stack of scopes for nested blocks)
    scopes: Vec<HashMap<String, Type>>,

    // Current function's return type (for return statement checking)
    current_return_type: Option<Type>,

    // Collected errors
    errors: Vec<SemanticError>,
}

impl TypeChecker {
    pub fn new() -> Self {
        TypeChecker {
            functions: HashMap::new(),
            structs: HashMap::new(),
            scopes: Vec::new(),
            current_return_type: None,
            errors: Vec::new(),
        }
    }

    fn error(&mut self, message: String, span: Span) {
        self.errors.push(SemanticError { message, span });
    }

    fn push_scope(&mut self) {
        self.scopes.push(HashMap::new());
    }

    fn pop_scope(&mut self) {
        self.scopes.pop();
    }

    fn define_local(&mut self, name: String, ty: Type) {
        if let Some(scope) = self.scopes.last_mut() {
            scope.insert(name, ty);
        }
    }

    fn lookup_local(&self, name: &str) -> Option<Type> {
        for scope in self.scopes.iter().rev() {
            if let Some(ty) = scope.get(name) {
                return Some(ty.clone());
            }
        }
        None
    }

    fn types_equal(&self, a: &Type, b: &Type) -> bool {
        match (a, b) {
            (Type::I32, Type::I32) => true,
            (Type::I64, Type::I64) => true,
            (Type::Bool, Type::Bool) => true,
            (Type::Void, Type::Void) => true,
            (Type::Pointer(inner_a), Type::Pointer(inner_b)) => self.types_equal(inner_a, inner_b),
            (Type::Named(name_a), Type::Named(name_b)) => name_a == name_b,
            _ => false,
        }
    }

    pub fn check_program(&mut self, program: &Program) -> Result<(), Vec<SemanticError>> {
        // First pass: collect all function and struct declarations
        for item in &program.items {
            match item {
                Item::Function(func) => {
                    let params: Vec<Type> = func.params.iter().map(|p| p.ty.clone()).collect();
                    let return_type = func.return_type.clone().unwrap_or(Type::Void);
                    self.functions.insert(
                        func.name.clone(),
                        FunctionSignature {
                            params,
                            return_type,
                        },
                    );
                }
                Item::Struct(s) => {
                    let mut fields = HashMap::new();
                    for field in &s.fields {
                        fields.insert(field.name.clone(), field.ty.clone());
                    }
                    self.structs.insert(s.name.clone(), StructInfo { fields });
                }
            }
        }

        // Second pass: type-check function bodies
        for item in &program.items {
            if let Item::Function(func) = item {
                self.check_function(func);
            }
        }

        if self.errors.is_empty() {
            Ok(())
        } else {
            Err(std::mem::take(&mut self.errors))
        }
    }

    fn check_function(&mut self, func: &Function) {
        self.push_scope();
        self.current_return_type = Some(func.return_type.clone().unwrap_or(Type::Void));

        // Add parameters to scope
        for param in &func.params {
            self.define_local(param.name.clone(), param.ty.clone());
        }

        // Check function body
        self.check_block(&func.body);

        self.current_return_type = None;
        self.pop_scope();
    }

    fn check_block(&mut self, block: &Block) {
        self.push_scope();
        for stmt in &block.statements {
            self.check_statement(stmt);
        }
        self.pop_scope();
    }

    fn check_statement(&mut self, stmt: &Statement) {
        match stmt {
            Statement::Let(let_stmt) => self.check_let_stmt(let_stmt),
            Statement::If(if_stmt) => self.check_if_stmt(if_stmt),
            Statement::While(while_stmt) => self.check_while_stmt(while_stmt),
            Statement::Return(return_stmt) => self.check_return_stmt(return_stmt),
            Statement::Expr(expr_stmt) => {
                self.check_expr(&expr_stmt.expr);
            }
        }
    }

    fn check_let_stmt(&mut self, let_stmt: &LetStmt) {
        let expr_type = self.check_expr(&let_stmt.value);

        if let Some(ref declared_type) = let_stmt.ty {
            if let Some(ref expr_ty) = expr_type {
                if !self.types_equal(declared_type, expr_ty) {
                    self.error(
                        format!(
                            "Type mismatch: expected '{}', found '{}'",
                            declared_type, expr_ty
                        ),
                        let_stmt.span.clone(),
                    );
                }
            }
            self.define_local(let_stmt.name.clone(), declared_type.clone());
        } else if let Some(expr_ty) = expr_type {
            // Type inference
            self.define_local(let_stmt.name.clone(), expr_ty);
        } else {
            self.error(
                format!("Cannot infer type for variable '{}'", let_stmt.name),
                let_stmt.span.clone(),
            );
        }
    }

    fn check_if_stmt(&mut self, if_stmt: &IfStmt) {
        let cond_type = self.check_expr(&if_stmt.condition);

        if let Some(ty) = cond_type {
            if !self.types_equal(&ty, &Type::Bool) {
                self.error(
                    format!("Condition must be bool, found '{}'", ty),
                    if_stmt.condition.span.clone(),
                );
            }
        }

        self.check_block(&if_stmt.then_block);

        if let Some(else_branch) = &if_stmt.else_block {
            match else_branch.as_ref() {
                ElseBranch::Block(block) => self.check_block(block),
                ElseBranch::If(nested_if) => self.check_if_stmt(nested_if),
            }
        }
    }

    fn check_while_stmt(&mut self, while_stmt: &WhileStmt) {
        let cond_type = self.check_expr(&while_stmt.condition);

        if let Some(ty) = cond_type {
            if !self.types_equal(&ty, &Type::Bool) {
                self.error(
                    format!("Condition must be bool, found '{}'", ty),
                    while_stmt.condition.span.clone(),
                );
            }
        }

        self.check_block(&while_stmt.body);
    }

    fn check_return_stmt(&mut self, return_stmt: &ReturnStmt) {
        let expected = self.current_return_type.clone().unwrap_or(Type::Void);

        match &return_stmt.value {
            Some(expr) => {
                let actual = self.check_expr(expr);
                if let Some(actual_ty) = actual {
                    if !self.types_equal(&expected, &actual_ty) {
                        self.error(
                            format!(
                                "Return type mismatch: expected '{}', found '{}'",
                                expected, actual_ty
                            ),
                            return_stmt.span.clone(),
                        );
                    }
                }
            }
            None => {
                if !self.types_equal(&expected, &Type::Void) {
                    self.error(
                        format!("Expected return value of type '{}'", expected),
                        return_stmt.span.clone(),
                    );
                }
            }
        }
    }

    fn check_expr(&mut self, expr: &Expr) -> Option<Type> {
        match &expr.kind {
            ExprKind::IntLiteral(_) => Some(Type::I32),
            ExprKind::BoolLiteral(_) => Some(Type::Bool),
            ExprKind::StringLiteral(_) => Some(Type::Pointer(Box::new(Type::I32))), // char* equivalent

            ExprKind::Ident(name) => {
                if let Some(ty) = self.lookup_local(name) {
                    Some(ty)
                } else {
                    self.error(format!("Undefined variable '{}'", name), expr.span.clone());
                    None
                }
            }

            ExprKind::Binary(op, left, right) => self.check_binary_expr(*op, left, right, &expr.span),

            ExprKind::Unary(op, operand) => self.check_unary_expr(*op, operand, &expr.span),

            ExprKind::Call(callee, args) => self.check_call_expr(callee, args, &expr.span),

            ExprKind::FieldAccess(obj, field) => self.check_field_access(obj, field, &expr.span),

            ExprKind::Index(arr, idx) => self.check_index_expr(arr, idx, &expr.span),

            ExprKind::Assign(target, value) => self.check_assign_expr(target, value, &expr.span),
        }
    }

    fn check_binary_expr(
        &mut self,
        op: BinaryOp,
        left: &Expr,
        right: &Expr,
        span: &Span,
    ) -> Option<Type> {
        let left_type = self.check_expr(left)?;
        let right_type = self.check_expr(right)?;

        match op {
            BinaryOp::Add | BinaryOp::Sub | BinaryOp::Mul | BinaryOp::Div | BinaryOp::Mod => {
                if self.types_equal(&left_type, &Type::I32)
                    && self.types_equal(&right_type, &Type::I32)
                {
                    Some(Type::I32)
                } else if self.types_equal(&left_type, &Type::I64)
                    && self.types_equal(&right_type, &Type::I64)
                {
                    Some(Type::I64)
                } else {
                    self.error(
                        format!(
                            "Cannot apply '{}' to '{}' and '{}'",
                            op, left_type, right_type
                        ),
                        span.clone(),
                    );
                    None
                }
            }

            BinaryOp::Eq | BinaryOp::NotEq => {
                if self.types_equal(&left_type, &right_type) {
                    Some(Type::Bool)
                } else {
                    self.error(
                        format!(
                            "Cannot compare '{}' and '{}'",
                            left_type, right_type
                        ),
                        span.clone(),
                    );
                    None
                }
            }

            BinaryOp::Lt | BinaryOp::Gt | BinaryOp::LtEq | BinaryOp::GtEq => {
                if (self.types_equal(&left_type, &Type::I32)
                    && self.types_equal(&right_type, &Type::I32))
                    || (self.types_equal(&left_type, &Type::I64)
                        && self.types_equal(&right_type, &Type::I64))
                {
                    Some(Type::Bool)
                } else {
                    self.error(
                        format!(
                            "Cannot compare '{}' and '{}' with '{}'",
                            left_type, right_type, op
                        ),
                        span.clone(),
                    );
                    None
                }
            }

            BinaryOp::And | BinaryOp::Or => {
                if self.types_equal(&left_type, &Type::Bool)
                    && self.types_equal(&right_type, &Type::Bool)
                {
                    Some(Type::Bool)
                } else {
                    self.error(
                        format!(
                            "Logical operators require bool operands, found '{}' and '{}'",
                            left_type, right_type
                        ),
                        span.clone(),
                    );
                    None
                }
            }
        }
    }

    fn check_unary_expr(&mut self, op: UnaryOp, operand: &Expr, span: &Span) -> Option<Type> {
        let operand_type = self.check_expr(operand)?;

        match op {
            UnaryOp::Neg => {
                if self.types_equal(&operand_type, &Type::I32)
                    || self.types_equal(&operand_type, &Type::I64)
                {
                    Some(operand_type)
                } else {
                    self.error(
                        format!("Cannot negate '{}'", operand_type),
                        span.clone(),
                    );
                    None
                }
            }
            UnaryOp::Not => {
                if self.types_equal(&operand_type, &Type::Bool) {
                    Some(Type::Bool)
                } else {
                    self.error(
                        format!("Cannot apply '!' to '{}'", operand_type),
                        span.clone(),
                    );
                    None
                }
            }
            UnaryOp::Deref => {
                if let Type::Pointer(inner) = operand_type {
                    Some(*inner)
                } else {
                    self.error(
                        format!("Cannot dereference non-pointer type '{}'", operand_type),
                        span.clone(),
                    );
                    None
                }
            }
            UnaryOp::AddrOf => Some(Type::Pointer(Box::new(operand_type))),
        }
    }

    fn check_call_expr(&mut self, callee: &Expr, args: &[Expr], span: &Span) -> Option<Type> {
        // Get function name
        let func_name = if let ExprKind::Ident(name) = &callee.kind {
            name.clone()
        } else {
            self.error("Cannot call non-function".to_string(), span.clone());
            return None;
        };

        // Look up function
        let sig = if let Some(sig) = self.functions.get(&func_name) {
            sig.clone()
        } else {
            self.error(format!("Undefined function '{}'", func_name), span.clone());
            return None;
        };

        // Check argument count
        if args.len() != sig.params.len() {
            self.error(
                format!(
                    "Function '{}' expects {} arguments, found {}",
                    func_name,
                    sig.params.len(),
                    args.len()
                ),
                span.clone(),
            );
        }

        // Check argument types
        for (i, (arg, param_type)) in args.iter().zip(sig.params.iter()).enumerate() {
            let arg_type = self.check_expr(arg);
            if let Some(ref arg_ty) = arg_type {
                if !self.types_equal(arg_ty, param_type) {
                    self.error(
                        format!(
                            "Argument {} type mismatch: expected '{}', found '{}'",
                            i + 1,
                            param_type,
                            arg_ty
                        ),
                        arg.span.clone(),
                    );
                }
            }
        }

        Some(sig.return_type)
    }

    fn check_field_access(&mut self, obj: &Expr, field: &str, span: &Span) -> Option<Type> {
        let obj_type = self.check_expr(obj)?;

        let struct_name = match &obj_type {
            Type::Named(name) => name.clone(),
            _ => {
                self.error(
                    format!("Cannot access field on non-struct type '{}'", obj_type),
                    span.clone(),
                );
                return None;
            }
        };

        let struct_info = if let Some(info) = self.structs.get(&struct_name) {
            info.clone()
        } else {
            self.error(format!("Undefined struct '{}'", struct_name), span.clone());
            return None;
        };

        if let Some(field_type) = struct_info.fields.get(field) {
            Some(field_type.clone())
        } else {
            self.error(
                format!("Struct '{}' has no field '{}'", struct_name, field),
                span.clone(),
            );
            None
        }
    }

    fn check_index_expr(&mut self, arr: &Expr, idx: &Expr, span: &Span) -> Option<Type> {
        let arr_type = self.check_expr(arr)?;
        let idx_type = self.check_expr(idx)?;

        if !self.types_equal(&idx_type, &Type::I32) && !self.types_equal(&idx_type, &Type::I64) {
            self.error(
                format!("Index must be integer, found '{}'", idx_type),
                span.clone(),
            );
        }

        match arr_type {
            Type::Pointer(inner) => Some(*inner),
            _ => {
                self.error(
                    format!("Cannot index non-pointer type '{}'", arr_type),
                    span.clone(),
                );
                None
            }
        }
    }

    fn check_assign_expr(&mut self, target: &Expr, value: &Expr, span: &Span) -> Option<Type> {
        let target_type = self.check_expr(target)?;
        let value_type = self.check_expr(value)?;

        if !self.types_equal(&target_type, &value_type) {
            self.error(
                format!(
                    "Cannot assign '{}' to '{}'",
                    value_type, target_type
                ),
                span.clone(),
            );
        }

        Some(target_type)
    }
}

impl Default for TypeChecker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::Parser;

    fn check(source: &str) -> Result<(), Vec<SemanticError>> {
        let mut parser = Parser::new(source);
        let program = parser.parse_program().expect("Parse failed");
        let mut checker = TypeChecker::new();
        checker.check_program(&program)
    }

    #[test]
    fn test_valid_function() {
        let result = check("fn main() -> i32 { return 0; }");
        assert!(result.is_ok());
    }

    #[test]
    fn test_valid_arithmetic() {
        let result = check(
            "fn main() -> i32 {
                let x: i32 = 1 + 2 * 3;
                return x;
            }",
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_type_mismatch_in_let() {
        let result = check(
            "fn main() {
                let x: bool = 42;
            }",
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_undefined_variable() {
        let result = check(
            "fn main() -> i32 {
                return x;
            }",
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_return_type_mismatch() {
        let result = check(
            "fn main() -> i32 {
                return true;
            }",
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_condition_not_bool() {
        let result = check(
            "fn main() {
                if 42 {
                    return;
                }
            }",
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_valid_function_call() {
        let result = check(
            "fn add(a: i32, b: i32) -> i32 {
                return a + b;
            }
            fn main() -> i32 {
                return add(1, 2);
            }",
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_wrong_argument_count() {
        let result = check(
            "fn add(a: i32, b: i32) -> i32 {
                return a + b;
            }
            fn main() -> i32 {
                return add(1);
            }",
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_wrong_argument_type() {
        let result = check(
            "fn foo(x: i32) -> i32 {
                return x;
            }
            fn main() -> i32 {
                return foo(true);
            }",
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_valid_struct() {
        let result = check(
            "struct Point {
                x: i32;
                y: i32;
            }
            fn get_x(p: Point) -> i32 {
                return p.x;
            }",
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_undefined_field() {
        let result = check(
            "struct Point {
                x: i32;
                y: i32;
            }
            fn get_z(p: Point) -> i32 {
                return p.z;
            }",
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_valid_pointers() {
        let result = check(
            "fn main() -> i32 {
                let x: i32 = 42;
                let p: *i32 = &x;
                return *p;
            }",
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_deref_non_pointer() {
        let result = check(
            "fn main() -> i32 {
                let x: i32 = 42;
                return *x;
            }",
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_valid_while() {
        let result = check(
            "fn main() -> i32 {
                let i: i32 = 0;
                while i < 10 {
                    i = i + 1;
                }
                return i;
            }",
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_valid_if_else() {
        let result = check(
            "fn max(a: i32, b: i32) -> i32 {
                if a > b {
                    return a;
                } else {
                    return b;
                }
            }",
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_logical_operators() {
        let result = check(
            "fn main() -> bool {
                let a: bool = true;
                let b: bool = false;
                return a && b || !a;
            }",
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_logical_operator_type_error() {
        let result = check(
            "fn main() -> bool {
                let a: i32 = 1;
                return a && true;
            }",
        );
        assert!(result.is_err());
    }
}
