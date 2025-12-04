use crate::ast::*;
use crate::lexer::{Lexer, Span, Token, TokenKind};

pub struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

#[derive(Debug, Clone)]
pub struct ParseError {
    pub message: String,
    pub span: Span,
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Parse error at line {} column {}: {}",
            self.span.line, self.span.column, self.message
        )
    }
}

impl std::error::Error for ParseError {}

pub type ParseResult<T> = Result<T, ParseError>;

impl Parser {
    pub fn new(source: &str) -> Self {
        let mut lexer = Lexer::new(source);
        let tokens = lexer.tokenize();
        Parser { tokens, pos: 0 }
    }

    fn peek(&self) -> &Token {
        self.tokens.get(self.pos).unwrap_or(&self.tokens[self.tokens.len() - 1])
    }

    fn peek_kind(&self) -> &TokenKind {
        &self.peek().kind
    }

    fn advance(&mut self) -> &Token {
        let token = &self.tokens[self.pos];
        if self.pos < self.tokens.len() - 1 {
            self.pos += 1;
        }
        token
    }

    fn check(&self, kind: &TokenKind) -> bool {
        std::mem::discriminant(self.peek_kind()) == std::mem::discriminant(kind)
    }

    fn expect(&mut self, kind: &TokenKind) -> ParseResult<Token> {
        if self.check(kind) {
            Ok(self.advance().clone())
        } else {
            Err(ParseError {
                message: format!("Expected '{}', found '{}'", kind, self.peek_kind()),
                span: self.peek().span.clone(),
            })
        }
    }

    fn expect_ident(&mut self) -> ParseResult<(String, Span)> {
        let token = self.advance().clone();
        match token.kind {
            TokenKind::Ident(name) => Ok((name, token.span)),
            _ => Err(ParseError {
                message: format!("Expected identifier, found '{}'", token.kind),
                span: token.span,
            }),
        }
    }

    pub fn parse_program(&mut self) -> ParseResult<Program> {
        let mut items = Vec::new();

        while !self.check(&TokenKind::Eof) {
            items.push(self.parse_item()?);
        }

        Ok(Program { items })
    }

    fn parse_item(&mut self) -> ParseResult<Item> {
        match self.peek_kind() {
            TokenKind::Fn => Ok(Item::Function(self.parse_function()?)),
            TokenKind::Struct => Ok(Item::Struct(self.parse_struct()?)),
            _ => Err(ParseError {
                message: format!("Expected 'fn' or 'struct', found '{}'", self.peek_kind()),
                span: self.peek().span.clone(),
            }),
        }
    }

    fn parse_function(&mut self) -> ParseResult<Function> {
        let start_span = self.expect(&TokenKind::Fn)?.span;
        let (name, _) = self.expect_ident()?;

        self.expect(&TokenKind::LParen)?;
        let params = self.parse_params()?;
        self.expect(&TokenKind::RParen)?;

        let return_type = if self.check(&TokenKind::Arrow) {
            self.advance();
            Some(self.parse_type()?)
        } else {
            None
        };

        let body = self.parse_block()?;

        Ok(Function {
            name,
            params,
            return_type,
            body,
            span: Span::new(
                start_span.start,
                self.tokens[self.pos.saturating_sub(1)].span.end,
                start_span.line,
                start_span.column,
            ),
        })
    }

    fn parse_params(&mut self) -> ParseResult<Vec<Param>> {
        let mut params = Vec::new();

        if !self.check(&TokenKind::RParen) {
            params.push(self.parse_param()?);

            while self.check(&TokenKind::Comma) {
                self.advance();
                params.push(self.parse_param()?);
            }
        }

        Ok(params)
    }

    fn parse_param(&mut self) -> ParseResult<Param> {
        let (name, span) = self.expect_ident()?;
        self.expect(&TokenKind::Colon)?;
        let ty = self.parse_type()?;

        Ok(Param { name, ty, span })
    }

    fn parse_struct(&mut self) -> ParseResult<StructDef> {
        let start_span = self.expect(&TokenKind::Struct)?.span;
        let (name, _) = self.expect_ident()?;

        self.expect(&TokenKind::LBrace)?;
        let mut fields = Vec::new();

        while !self.check(&TokenKind::RBrace) {
            fields.push(self.parse_field()?);
        }

        let end_span = self.expect(&TokenKind::RBrace)?.span;

        Ok(StructDef {
            name,
            fields,
            span: Span::new(start_span.start, end_span.end, start_span.line, start_span.column),
        })
    }

    fn parse_field(&mut self) -> ParseResult<Field> {
        let (name, span) = self.expect_ident()?;
        self.expect(&TokenKind::Colon)?;
        let ty = self.parse_type()?;
        self.expect(&TokenKind::Semicolon)?;

        Ok(Field { name, ty, span })
    }

    fn parse_type(&mut self) -> ParseResult<Type> {
        if self.check(&TokenKind::Star) {
            self.advance();
            let inner = self.parse_type()?;
            return Ok(Type::Pointer(Box::new(inner)));
        }

        let token = self.advance().clone();
        match token.kind {
            TokenKind::I32 => Ok(Type::I32),
            TokenKind::I64 => Ok(Type::I64),
            TokenKind::Bool => Ok(Type::Bool),
            TokenKind::Void => Ok(Type::Void),
            TokenKind::Ident(name) => Ok(Type::Named(name)),
            _ => Err(ParseError {
                message: format!("Expected type, found '{}'", token.kind),
                span: token.span,
            }),
        }
    }

    fn parse_block(&mut self) -> ParseResult<Block> {
        let start_span = self.expect(&TokenKind::LBrace)?.span;
        let mut statements = Vec::new();

        while !self.check(&TokenKind::RBrace) {
            statements.push(self.parse_statement()?);
        }

        let end_span = self.expect(&TokenKind::RBrace)?.span;

        Ok(Block {
            statements,
            span: Span::new(start_span.start, end_span.end, start_span.line, start_span.column),
        })
    }

    fn parse_statement(&mut self) -> ParseResult<Statement> {
        match self.peek_kind() {
            TokenKind::Let => Ok(Statement::Let(self.parse_let_stmt()?)),
            TokenKind::If => Ok(Statement::If(self.parse_if_stmt()?)),
            TokenKind::While => Ok(Statement::While(self.parse_while_stmt()?)),
            TokenKind::Return => Ok(Statement::Return(self.parse_return_stmt()?)),
            _ => Ok(Statement::Expr(self.parse_expr_stmt()?)),
        }
    }

    fn parse_let_stmt(&mut self) -> ParseResult<LetStmt> {
        let start_span = self.expect(&TokenKind::Let)?.span;
        let (name, _) = self.expect_ident()?;

        let ty = if self.check(&TokenKind::Colon) {
            self.advance();
            Some(self.parse_type()?)
        } else {
            None
        };

        self.expect(&TokenKind::Eq)?;
        let value = self.parse_expr()?;
        let end_span = self.expect(&TokenKind::Semicolon)?.span;

        Ok(LetStmt {
            name,
            ty,
            value,
            span: Span::new(start_span.start, end_span.end, start_span.line, start_span.column),
        })
    }

    fn parse_if_stmt(&mut self) -> ParseResult<IfStmt> {
        let start_span = self.expect(&TokenKind::If)?.span;
        let condition = self.parse_expr()?;
        let then_block = self.parse_block()?;

        let else_block = if self.check(&TokenKind::Else) {
            self.advance();
            if self.check(&TokenKind::If) {
                Some(Box::new(ElseBranch::If(self.parse_if_stmt()?)))
            } else {
                Some(Box::new(ElseBranch::Block(self.parse_block()?)))
            }
        } else {
            None
        };

        Ok(IfStmt {
            condition,
            then_block,
            else_block,
            span: Span::new(
                start_span.start,
                self.tokens[self.pos.saturating_sub(1)].span.end,
                start_span.line,
                start_span.column,
            ),
        })
    }

    fn parse_while_stmt(&mut self) -> ParseResult<WhileStmt> {
        let start_span = self.expect(&TokenKind::While)?.span;
        let condition = self.parse_expr()?;
        let body = self.parse_block()?;

        Ok(WhileStmt {
            condition,
            body,
            span: Span::new(
                start_span.start,
                self.tokens[self.pos.saturating_sub(1)].span.end,
                start_span.line,
                start_span.column,
            ),
        })
    }

    fn parse_return_stmt(&mut self) -> ParseResult<ReturnStmt> {
        let start_span = self.expect(&TokenKind::Return)?.span;

        let value = if !self.check(&TokenKind::Semicolon) {
            Some(self.parse_expr()?)
        } else {
            None
        };

        let end_span = self.expect(&TokenKind::Semicolon)?.span;

        Ok(ReturnStmt {
            value,
            span: Span::new(start_span.start, end_span.end, start_span.line, start_span.column),
        })
    }

    fn parse_expr_stmt(&mut self) -> ParseResult<ExprStmt> {
        let expr = self.parse_expr()?;
        let start = expr.span.clone();
        let end_span = self.expect(&TokenKind::Semicolon)?.span;

        Ok(ExprStmt {
            expr,
            span: Span::new(start.start, end_span.end, start.line, start.column),
        })
    }

    fn parse_expr(&mut self) -> ParseResult<Expr> {
        self.parse_assignment()
    }

    fn parse_assignment(&mut self) -> ParseResult<Expr> {
        let expr = self.parse_or()?;

        if self.check(&TokenKind::Eq) {
            self.advance();
            let value = self.parse_assignment()?;
            let span = Span::new(
                expr.span.start,
                value.span.end,
                expr.span.line,
                expr.span.column,
            );
            return Ok(Expr {
                kind: ExprKind::Assign(Box::new(expr), Box::new(value)),
                span,
            });
        }

        Ok(expr)
    }

    fn parse_or(&mut self) -> ParseResult<Expr> {
        let mut left = self.parse_and()?;

        while self.check(&TokenKind::OrOr) {
            self.advance();
            let right = self.parse_and()?;
            let span = Span::new(
                left.span.start,
                right.span.end,
                left.span.line,
                left.span.column,
            );
            left = Expr {
                kind: ExprKind::Binary(BinaryOp::Or, Box::new(left), Box::new(right)),
                span,
            };
        }

        Ok(left)
    }

    fn parse_and(&mut self) -> ParseResult<Expr> {
        let mut left = self.parse_equality()?;

        while self.check(&TokenKind::AndAnd) {
            self.advance();
            let right = self.parse_equality()?;
            let span = Span::new(
                left.span.start,
                right.span.end,
                left.span.line,
                left.span.column,
            );
            left = Expr {
                kind: ExprKind::Binary(BinaryOp::And, Box::new(left), Box::new(right)),
                span,
            };
        }

        Ok(left)
    }

    fn parse_equality(&mut self) -> ParseResult<Expr> {
        let mut left = self.parse_comparison()?;

        loop {
            let op = match self.peek_kind() {
                TokenKind::EqEq => BinaryOp::Eq,
                TokenKind::NotEq => BinaryOp::NotEq,
                _ => break,
            };
            self.advance();
            let right = self.parse_comparison()?;
            let span = Span::new(
                left.span.start,
                right.span.end,
                left.span.line,
                left.span.column,
            );
            left = Expr {
                kind: ExprKind::Binary(op, Box::new(left), Box::new(right)),
                span,
            };
        }

        Ok(left)
    }

    fn parse_comparison(&mut self) -> ParseResult<Expr> {
        let mut left = self.parse_term()?;

        loop {
            let op = match self.peek_kind() {
                TokenKind::Lt => BinaryOp::Lt,
                TokenKind::Gt => BinaryOp::Gt,
                TokenKind::LtEq => BinaryOp::LtEq,
                TokenKind::GtEq => BinaryOp::GtEq,
                _ => break,
            };
            self.advance();
            let right = self.parse_term()?;
            let span = Span::new(
                left.span.start,
                right.span.end,
                left.span.line,
                left.span.column,
            );
            left = Expr {
                kind: ExprKind::Binary(op, Box::new(left), Box::new(right)),
                span,
            };
        }

        Ok(left)
    }

    fn parse_term(&mut self) -> ParseResult<Expr> {
        let mut left = self.parse_factor()?;

        loop {
            let op = match self.peek_kind() {
                TokenKind::Plus => BinaryOp::Add,
                TokenKind::Minus => BinaryOp::Sub,
                _ => break,
            };
            self.advance();
            let right = self.parse_factor()?;
            let span = Span::new(
                left.span.start,
                right.span.end,
                left.span.line,
                left.span.column,
            );
            left = Expr {
                kind: ExprKind::Binary(op, Box::new(left), Box::new(right)),
                span,
            };
        }

        Ok(left)
    }

    fn parse_factor(&mut self) -> ParseResult<Expr> {
        let mut left = self.parse_unary()?;

        loop {
            let op = match self.peek_kind() {
                TokenKind::Star => BinaryOp::Mul,
                TokenKind::Slash => BinaryOp::Div,
                TokenKind::Percent => BinaryOp::Mod,
                _ => break,
            };
            self.advance();
            let right = self.parse_unary()?;
            let span = Span::new(
                left.span.start,
                right.span.end,
                left.span.line,
                left.span.column,
            );
            left = Expr {
                kind: ExprKind::Binary(op, Box::new(left), Box::new(right)),
                span,
            };
        }

        Ok(left)
    }

    fn parse_unary(&mut self) -> ParseResult<Expr> {
        let op = match self.peek_kind() {
            TokenKind::Bang => Some(UnaryOp::Not),
            TokenKind::Minus => Some(UnaryOp::Neg),
            TokenKind::Ampersand => Some(UnaryOp::AddrOf),
            TokenKind::Star => Some(UnaryOp::Deref),
            _ => None,
        };

        if let Some(op) = op {
            let start_span = self.advance().span.clone();
            let operand = self.parse_unary()?;
            let span = Span::new(
                start_span.start,
                operand.span.end,
                start_span.line,
                start_span.column,
            );
            return Ok(Expr {
                kind: ExprKind::Unary(op, Box::new(operand)),
                span,
            });
        }

        self.parse_call()
    }

    fn parse_call(&mut self) -> ParseResult<Expr> {
        let mut expr = self.parse_primary()?;

        loop {
            if self.check(&TokenKind::LParen) {
                self.advance();
                let args = self.parse_args()?;
                let end_span = self.expect(&TokenKind::RParen)?.span;
                let span = Span::new(
                    expr.span.start,
                    end_span.end,
                    expr.span.line,
                    expr.span.column,
                );
                expr = Expr {
                    kind: ExprKind::Call(Box::new(expr), args),
                    span,
                };
            } else if self.check(&TokenKind::Dot) {
                self.advance();
                let (field_name, field_span) = self.expect_ident()?;
                let span = Span::new(
                    expr.span.start,
                    field_span.end,
                    expr.span.line,
                    expr.span.column,
                );
                expr = Expr {
                    kind: ExprKind::FieldAccess(Box::new(expr), field_name),
                    span,
                };
            } else if self.check(&TokenKind::LBracket) {
                self.advance();
                let index = self.parse_expr()?;
                let end_span = self.expect(&TokenKind::RBracket)?.span;
                let span = Span::new(
                    expr.span.start,
                    end_span.end,
                    expr.span.line,
                    expr.span.column,
                );
                expr = Expr {
                    kind: ExprKind::Index(Box::new(expr), Box::new(index)),
                    span,
                };
            } else {
                break;
            }
        }

        Ok(expr)
    }

    fn parse_args(&mut self) -> ParseResult<Vec<Expr>> {
        let mut args = Vec::new();

        if !self.check(&TokenKind::RParen) {
            args.push(self.parse_expr()?);

            while self.check(&TokenKind::Comma) {
                self.advance();
                args.push(self.parse_expr()?);
            }
        }

        Ok(args)
    }

    fn parse_primary(&mut self) -> ParseResult<Expr> {
        let token = self.advance().clone();

        match token.kind {
            TokenKind::IntLiteral(n) => Ok(Expr {
                kind: ExprKind::IntLiteral(n),
                span: token.span,
            }),
            TokenKind::True => Ok(Expr {
                kind: ExprKind::BoolLiteral(true),
                span: token.span,
            }),
            TokenKind::False => Ok(Expr {
                kind: ExprKind::BoolLiteral(false),
                span: token.span,
            }),
            TokenKind::StringLiteral(s) => Ok(Expr {
                kind: ExprKind::StringLiteral(s),
                span: token.span,
            }),
            TokenKind::Ident(name) => Ok(Expr {
                kind: ExprKind::Ident(name),
                span: token.span,
            }),
            TokenKind::LParen => {
                let expr = self.parse_expr()?;
                self.expect(&TokenKind::RParen)?;
                Ok(expr)
            }
            _ => Err(ParseError {
                message: format!("Expected expression, found '{}'", token.kind),
                span: token.span,
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_function() {
        let source = "fn main() -> i32 { return 0; }";
        let mut parser = Parser::new(source);
        let program = parser.parse_program().unwrap();

        assert_eq!(program.items.len(), 1);
        if let Item::Function(func) = &program.items[0] {
            assert_eq!(func.name, "main");
            assert_eq!(func.params.len(), 0);
            assert_eq!(func.return_type, Some(Type::I32));
            assert_eq!(func.body.statements.len(), 1);
        } else {
            panic!("Expected function");
        }
    }

    #[test]
    fn test_parse_function_with_params() {
        let source = "fn add(a: i32, b: i32) -> i32 { return a + b; }";
        let mut parser = Parser::new(source);
        let program = parser.parse_program().unwrap();

        if let Item::Function(func) = &program.items[0] {
            assert_eq!(func.name, "add");
            assert_eq!(func.params.len(), 2);
            assert_eq!(func.params[0].name, "a");
            assert_eq!(func.params[0].ty, Type::I32);
            assert_eq!(func.params[1].name, "b");
            assert_eq!(func.params[1].ty, Type::I32);
        } else {
            panic!("Expected function");
        }
    }

    #[test]
    fn test_parse_let_statement() {
        let source = "fn main() { let x: i32 = 42; }";
        let mut parser = Parser::new(source);
        let program = parser.parse_program().unwrap();

        if let Item::Function(func) = &program.items[0] {
            if let Statement::Let(let_stmt) = &func.body.statements[0] {
                assert_eq!(let_stmt.name, "x");
                assert_eq!(let_stmt.ty, Some(Type::I32));
                if let ExprKind::IntLiteral(n) = let_stmt.value.kind {
                    assert_eq!(n, 42);
                } else {
                    panic!("Expected int literal");
                }
            } else {
                panic!("Expected let statement");
            }
        } else {
            panic!("Expected function");
        }
    }

    #[test]
    fn test_parse_if_statement() {
        let source = "fn main() { if x > 0 { return 1; } else { return 0; } }";
        let mut parser = Parser::new(source);
        let program = parser.parse_program().unwrap();

        if let Item::Function(func) = &program.items[0] {
            if let Statement::If(if_stmt) = &func.body.statements[0] {
                assert!(if_stmt.else_block.is_some());
            } else {
                panic!("Expected if statement");
            }
        } else {
            panic!("Expected function");
        }
    }

    #[test]
    fn test_parse_while_statement() {
        let source = "fn main() { while i < 10 { i = i + 1; } }";
        let mut parser = Parser::new(source);
        let program = parser.parse_program().unwrap();

        if let Item::Function(func) = &program.items[0] {
            if let Statement::While(while_stmt) = &func.body.statements[0] {
                assert_eq!(while_stmt.body.statements.len(), 1);
            } else {
                panic!("Expected while statement");
            }
        } else {
            panic!("Expected function");
        }
    }

    #[test]
    fn test_parse_binary_expressions() {
        let source = "fn main() { let x: i32 = 1 + 2 * 3; }";
        let mut parser = Parser::new(source);
        let program = parser.parse_program().unwrap();

        if let Item::Function(func) = &program.items[0] {
            if let Statement::Let(let_stmt) = &func.body.statements[0] {
                // Should parse as 1 + (2 * 3) due to precedence
                if let ExprKind::Binary(BinaryOp::Add, left, right) = &let_stmt.value.kind {
                    if let ExprKind::IntLiteral(1) = left.kind {
                        if let ExprKind::Binary(BinaryOp::Mul, _, _) = right.kind {
                            return; // Correct!
                        }
                    }
                }
                panic!("Incorrect expression structure");
            }
        }
        panic!("Expected function with let statement");
    }

    #[test]
    fn test_parse_function_call() {
        let source = "fn main() { foo(1, 2, 3); }";
        let mut parser = Parser::new(source);
        let program = parser.parse_program().unwrap();

        if let Item::Function(func) = &program.items[0] {
            if let Statement::Expr(expr_stmt) = &func.body.statements[0] {
                if let ExprKind::Call(callee, args) = &expr_stmt.expr.kind {
                    if let ExprKind::Ident(name) = &callee.kind {
                        assert_eq!(name, "foo");
                    }
                    assert_eq!(args.len(), 3);
                    return;
                }
            }
        }
        panic!("Expected function call");
    }

    #[test]
    fn test_parse_struct() {
        let source = "struct Point { x: i32; y: i32; }";
        let mut parser = Parser::new(source);
        let program = parser.parse_program().unwrap();

        if let Item::Struct(s) = &program.items[0] {
            assert_eq!(s.name, "Point");
            assert_eq!(s.fields.len(), 2);
            assert_eq!(s.fields[0].name, "x");
            assert_eq!(s.fields[1].name, "y");
        } else {
            panic!("Expected struct");
        }
    }

    #[test]
    fn test_parse_field_access() {
        let source = "fn main() { let d: i32 = p.x; }";
        let mut parser = Parser::new(source);
        let program = parser.parse_program().unwrap();

        if let Item::Function(func) = &program.items[0] {
            if let Statement::Let(let_stmt) = &func.body.statements[0] {
                if let ExprKind::FieldAccess(obj, field) = &let_stmt.value.kind {
                    if let ExprKind::Ident(name) = &obj.kind {
                        assert_eq!(name, "p");
                    }
                    assert_eq!(field, "x");
                    return;
                }
            }
        }
        panic!("Expected field access");
    }

    #[test]
    fn test_parse_unary_operators() {
        let source = "fn main() { let x: i32 = -5; let y: bool = !true; }";
        let mut parser = Parser::new(source);
        let program = parser.parse_program().unwrap();

        if let Item::Function(func) = &program.items[0] {
            if let Statement::Let(let_stmt) = &func.body.statements[0] {
                if let ExprKind::Unary(UnaryOp::Neg, operand) = &let_stmt.value.kind {
                    if let ExprKind::IntLiteral(5) = operand.kind {
                        // Good!
                    } else {
                        panic!("Expected -5");
                    }
                } else {
                    panic!("Expected unary neg");
                }
            }
        }
    }

    #[test]
    fn test_parse_pointer_type() {
        let source = "fn main(ptr: *i32) { }";
        let mut parser = Parser::new(source);
        let program = parser.parse_program().unwrap();

        if let Item::Function(func) = &program.items[0] {
            assert_eq!(func.params[0].ty, Type::Pointer(Box::new(Type::I32)));
        } else {
            panic!("Expected function");
        }
    }

    #[test]
    fn test_parse_assignment() {
        let source = "fn main() { x = 5; }";
        let mut parser = Parser::new(source);
        let program = parser.parse_program().unwrap();

        if let Item::Function(func) = &program.items[0] {
            if let Statement::Expr(expr_stmt) = &func.body.statements[0] {
                if let ExprKind::Assign(target, value) = &expr_stmt.expr.kind {
                    if let ExprKind::Ident(name) = &target.kind {
                        assert_eq!(name, "x");
                    }
                    if let ExprKind::IntLiteral(5) = value.kind {
                        return;
                    }
                }
            }
        }
        panic!("Expected assignment");
    }
}
