use crate::ast::*;

pub struct CodeGen {
    output: String,
    indent: usize,
}

impl CodeGen {
    pub fn new() -> Self {
        CodeGen {
            output: String::new(),
            indent: 0,
        }
    }

    fn emit(&mut self, s: &str) {
        self.output.push_str(s);
    }

    fn emit_line(&mut self, s: &str) {
        self.emit_indent();
        self.output.push_str(s);
        self.output.push('\n');
    }

    fn emit_indent(&mut self) {
        for _ in 0..self.indent {
            self.output.push_str("    ");
        }
    }

    fn indent(&mut self) {
        self.indent += 1;
    }

    fn dedent(&mut self) {
        self.indent = self.indent.saturating_sub(1);
    }

    pub fn generate(&mut self, program: &Program) -> String {
        // Standard C headers
        self.emit_line("#include <stdio.h>");
        self.emit_line("#include <stdlib.h>");
        self.emit_line("#include <stdbool.h>");
        self.emit_line("#include <stdint.h>");
        self.emit_line("");

        // Forward declare all structs
        for item in &program.items {
            if let Item::Struct(s) = item {
                self.emit_line(&format!("typedef struct {} {};", s.name, s.name));
            }
        }

        if program.items.iter().any(|i| matches!(i, Item::Struct(_))) {
            self.emit_line("");
        }

        // Generate struct definitions
        for item in &program.items {
            if let Item::Struct(s) = item {
                self.generate_struct(s);
                self.emit_line("");
            }
        }

        // Forward declare all functions
        for item in &program.items {
            if let Item::Function(f) = item {
                self.generate_function_decl(f);
            }
        }

        if program.items.iter().any(|i| matches!(i, Item::Function(_))) {
            self.emit_line("");
        }

        // Generate function definitions
        for item in &program.items {
            if let Item::Function(f) = item {
                self.generate_function(f);
                self.emit_line("");
            }
        }

        std::mem::take(&mut self.output)
    }

    fn generate_struct(&mut self, s: &StructDef) {
        self.emit_line(&format!("struct {} {{", s.name));
        self.indent();

        for field in &s.fields {
            self.emit_indent();
            self.emit(&self.type_to_c(&field.ty));
            self.emit(" ");
            self.emit(&field.name);
            self.emit(";\n");
        }

        self.dedent();
        self.emit_line("};");
    }

    fn generate_function_decl(&mut self, func: &Function) {
        let return_type = func
            .return_type
            .as_ref()
            .map(|t| self.type_to_c(t))
            .unwrap_or_else(|| "void".to_string());

        self.emit_indent();
        self.emit(&return_type);
        self.emit(" ");
        self.emit(&func.name);
        self.emit("(");

        if func.params.is_empty() {
            self.emit("void");
        } else {
            for (i, param) in func.params.iter().enumerate() {
                if i > 0 {
                    self.emit(", ");
                }
                self.emit(&self.type_to_c(&param.ty));
                self.emit(" ");
                self.emit(&param.name);
            }
        }

        self.emit(");\n");
    }

    fn generate_function(&mut self, func: &Function) {
        let return_type = func
            .return_type
            .as_ref()
            .map(|t| self.type_to_c(t))
            .unwrap_or_else(|| "void".to_string());

        self.emit_indent();
        self.emit(&return_type);
        self.emit(" ");
        self.emit(&func.name);
        self.emit("(");

        if func.params.is_empty() {
            self.emit("void");
        } else {
            for (i, param) in func.params.iter().enumerate() {
                if i > 0 {
                    self.emit(", ");
                }
                self.emit(&self.type_to_c(&param.ty));
                self.emit(" ");
                self.emit(&param.name);
            }
        }

        self.emit(") {\n");
        self.indent();

        for stmt in &func.body.statements {
            self.generate_statement(stmt);
        }

        self.dedent();
        self.emit_line("}");
    }

    fn generate_statement(&mut self, stmt: &Statement) {
        match stmt {
            Statement::Let(let_stmt) => self.generate_let_stmt(let_stmt),
            Statement::If(if_stmt) => self.generate_if_stmt(if_stmt),
            Statement::While(while_stmt) => self.generate_while_stmt(while_stmt),
            Statement::Return(return_stmt) => self.generate_return_stmt(return_stmt),
            Statement::Expr(expr_stmt) => {
                self.emit_indent();
                self.generate_expr(&expr_stmt.expr);
                self.emit(";\n");
            }
        }
    }

    fn generate_let_stmt(&mut self, let_stmt: &LetStmt) {
        self.emit_indent();

        if let Some(ref ty) = let_stmt.ty {
            self.emit(&self.type_to_c(ty));
        } else {
            // Default to int32_t if no type (shouldn't happen after type checking)
            self.emit("int32_t");
        }

        self.emit(" ");
        self.emit(&let_stmt.name);
        self.emit(" = ");
        self.generate_expr(&let_stmt.value);
        self.emit(";\n");
    }

    fn generate_if_stmt(&mut self, if_stmt: &IfStmt) {
        self.emit_indent();
        self.emit("if (");
        self.generate_expr(&if_stmt.condition);
        self.emit(") {\n");

        self.indent();
        for stmt in &if_stmt.then_block.statements {
            self.generate_statement(stmt);
        }
        self.dedent();

        if let Some(else_branch) = &if_stmt.else_block {
            match else_branch.as_ref() {
                ElseBranch::Block(block) => {
                    self.emit_line("} else {");
                    self.indent();
                    for stmt in &block.statements {
                        self.generate_statement(stmt);
                    }
                    self.dedent();
                    self.emit_line("}");
                }
                ElseBranch::If(nested_if) => {
                    self.emit_indent();
                    self.emit("} else ");
                    // Remove indent from nested if since we already emitted "} else "
                    self.emit("if (");
                    self.generate_expr(&nested_if.condition);
                    self.emit(") {\n");

                    self.indent();
                    for stmt in &nested_if.then_block.statements {
                        self.generate_statement(stmt);
                    }
                    self.dedent();

                    if let Some(nested_else) = &nested_if.else_block {
                        self.generate_else_branch(nested_else);
                    } else {
                        self.emit_line("}");
                    }
                }
            }
        } else {
            self.emit_line("}");
        }
    }

    fn generate_else_branch(&mut self, else_branch: &ElseBranch) {
        match else_branch {
            ElseBranch::Block(block) => {
                self.emit_line("} else {");
                self.indent();
                for stmt in &block.statements {
                    self.generate_statement(stmt);
                }
                self.dedent();
                self.emit_line("}");
            }
            ElseBranch::If(nested_if) => {
                self.emit_indent();
                self.emit("} else if (");
                self.generate_expr(&nested_if.condition);
                self.emit(") {\n");

                self.indent();
                for stmt in &nested_if.then_block.statements {
                    self.generate_statement(stmt);
                }
                self.dedent();

                if let Some(nested_else) = &nested_if.else_block {
                    self.generate_else_branch(nested_else);
                } else {
                    self.emit_line("}");
                }
            }
        }
    }

    fn generate_while_stmt(&mut self, while_stmt: &WhileStmt) {
        self.emit_indent();
        self.emit("while (");
        self.generate_expr(&while_stmt.condition);
        self.emit(") {\n");

        self.indent();
        for stmt in &while_stmt.body.statements {
            self.generate_statement(stmt);
        }
        self.dedent();

        self.emit_line("}");
    }

    fn generate_return_stmt(&mut self, return_stmt: &ReturnStmt) {
        self.emit_indent();
        if let Some(ref value) = return_stmt.value {
            self.emit("return ");
            self.generate_expr(value);
            self.emit(";\n");
        } else {
            self.emit("return;\n");
        }
    }

    fn generate_expr(&mut self, expr: &Expr) {
        match &expr.kind {
            ExprKind::IntLiteral(n) => {
                self.emit(&n.to_string());
            }
            ExprKind::BoolLiteral(b) => {
                self.emit(if *b { "true" } else { "false" });
            }
            ExprKind::StringLiteral(s) => {
                self.emit("\"");
                // Escape the string for C
                for c in s.chars() {
                    match c {
                        '\n' => self.emit("\\n"),
                        '\t' => self.emit("\\t"),
                        '\r' => self.emit("\\r"),
                        '"' => self.emit("\\\""),
                        '\\' => self.emit("\\\\"),
                        _ => self.emit(&c.to_string()),
                    }
                }
                self.emit("\"");
            }
            ExprKind::Ident(name) => {
                self.emit(name);
            }
            ExprKind::Binary(op, left, right) => {
                self.emit("(");
                self.generate_expr(left);
                self.emit(" ");
                self.emit(&self.binary_op_to_c(*op));
                self.emit(" ");
                self.generate_expr(right);
                self.emit(")");
            }
            ExprKind::Unary(op, operand) => {
                self.emit("(");
                self.emit(&self.unary_op_to_c(*op));
                self.generate_expr(operand);
                self.emit(")");
            }
            ExprKind::Call(callee, args) => {
                self.generate_expr(callee);
                self.emit("(");
                for (i, arg) in args.iter().enumerate() {
                    if i > 0 {
                        self.emit(", ");
                    }
                    self.generate_expr(arg);
                }
                self.emit(")");
            }
            ExprKind::FieldAccess(obj, field) => {
                self.generate_expr(obj);
                self.emit(".");
                self.emit(field);
            }
            ExprKind::Index(arr, idx) => {
                self.generate_expr(arr);
                self.emit("[");
                self.generate_expr(idx);
                self.emit("]");
            }
            ExprKind::Assign(target, value) => {
                self.emit("(");
                self.generate_expr(target);
                self.emit(" = ");
                self.generate_expr(value);
                self.emit(")");
            }
        }
    }

    fn type_to_c(&self, ty: &Type) -> String {
        match ty {
            Type::I32 => "int32_t".to_string(),
            Type::I64 => "int64_t".to_string(),
            Type::Bool => "bool".to_string(),
            Type::Void => "void".to_string(),
            Type::Pointer(inner) => format!("{}*", self.type_to_c(inner)),
            Type::Named(name) => name.clone(),
        }
    }

    fn binary_op_to_c(&self, op: BinaryOp) -> String {
        match op {
            BinaryOp::Add => "+".to_string(),
            BinaryOp::Sub => "-".to_string(),
            BinaryOp::Mul => "*".to_string(),
            BinaryOp::Div => "/".to_string(),
            BinaryOp::Mod => "%".to_string(),
            BinaryOp::Eq => "==".to_string(),
            BinaryOp::NotEq => "!=".to_string(),
            BinaryOp::Lt => "<".to_string(),
            BinaryOp::Gt => ">".to_string(),
            BinaryOp::LtEq => "<=".to_string(),
            BinaryOp::GtEq => ">=".to_string(),
            BinaryOp::And => "&&".to_string(),
            BinaryOp::Or => "||".to_string(),
        }
    }

    fn unary_op_to_c(&self, op: UnaryOp) -> String {
        match op {
            UnaryOp::Neg => "-".to_string(),
            UnaryOp::Not => "!".to_string(),
            UnaryOp::Deref => "*".to_string(),
            UnaryOp::AddrOf => "&".to_string(),
        }
    }
}

impl Default for CodeGen {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::Parser;

    fn generate(source: &str) -> String {
        let mut parser = Parser::new(source);
        let program = parser.parse_program().expect("Parse failed");
        let mut codegen = CodeGen::new();
        codegen.generate(&program)
    }

    #[test]
    fn test_simple_main() {
        let c_code = generate("fn main() -> i32 { return 0; }");
        assert!(c_code.contains("int32_t main(void)"));
        assert!(c_code.contains("return 0;"));
    }

    #[test]
    fn test_function_with_params() {
        let c_code = generate("fn add(a: i32, b: i32) -> i32 { return a + b; }");
        assert!(c_code.contains("int32_t add(int32_t a, int32_t b)"));
        assert!(c_code.contains("return (a + b);"));
    }

    #[test]
    fn test_let_statement() {
        let c_code = generate("fn main() { let x: i32 = 42; }");
        assert!(c_code.contains("int32_t x = 42;"));
    }

    #[test]
    fn test_if_statement() {
        let c_code = generate(
            "fn main() -> i32 {
                let x: i32 = 5;
                if x > 0 {
                    return 1;
                } else {
                    return 0;
                }
            }",
        );
        assert!(c_code.contains("if ((x > 0))"));
        assert!(c_code.contains("} else {"));
    }

    #[test]
    fn test_while_loop() {
        let c_code = generate(
            "fn main() -> i32 {
                let i: i32 = 0;
                while i < 10 {
                    i = i + 1;
                }
                return i;
            }",
        );
        assert!(c_code.contains("while ((i < 10))"));
        assert!(c_code.contains("(i = (i + 1));"));
    }

    #[test]
    fn test_struct_definition() {
        let c_code = generate(
            "struct Point {
                x: i32;
                y: i32;
            }",
        );
        assert!(c_code.contains("typedef struct Point Point;"));
        assert!(c_code.contains("struct Point {"));
        assert!(c_code.contains("int32_t x;"));
        assert!(c_code.contains("int32_t y;"));
    }

    #[test]
    fn test_function_call() {
        let c_code = generate(
            "fn foo(x: i32) -> i32 { return x; }
            fn main() -> i32 { return foo(42); }",
        );
        assert!(c_code.contains("return foo(42);"));
    }

    #[test]
    fn test_pointer_types() {
        let c_code = generate(
            "fn main() {
                let x: i32 = 42;
                let p: *i32 = &x;
            }",
        );
        assert!(c_code.contains("int32_t* p = (&x);"));
    }

    #[test]
    fn test_field_access() {
        let c_code = generate(
            "struct Point { x: i32; y: i32; }
            fn get_x(p: Point) -> i32 { return p.x; }",
        );
        assert!(c_code.contains("return p.x;"));
    }

    #[test]
    fn test_bool_literals() {
        let c_code = generate(
            "fn main() -> bool {
                let a: bool = true;
                let b: bool = false;
                return a;
            }",
        );
        assert!(c_code.contains("bool a = true;"));
        assert!(c_code.contains("bool b = false;"));
    }

    #[test]
    fn test_includes() {
        let c_code = generate("fn main() { }");
        assert!(c_code.contains("#include <stdio.h>"));
        assert!(c_code.contains("#include <stdlib.h>"));
        assert!(c_code.contains("#include <stdbool.h>"));
        assert!(c_code.contains("#include <stdint.h>"));
    }

    #[test]
    fn test_unary_operators() {
        let c_code = generate(
            "fn main() -> i32 {
                let x: i32 = -5;
                let y: bool = !true;
                return x;
            }",
        );
        assert!(c_code.contains("int32_t x = (-5);"));
        assert!(c_code.contains("bool y = (!true);"));
    }
}
