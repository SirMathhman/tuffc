use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub struct Span {
    pub start: usize,
    pub end: usize,
    pub line: usize,
    pub column: usize,
}

impl Span {
    pub fn new(start: usize, end: usize, line: usize, column: usize) -> Self {
        Span {
            start,
            end,
            line,
            column,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum TokenKind {
    // Keywords
    Fn,
    Let,
    If,
    Else,
    While,
    Return,
    Struct,
    True,
    False,

    // Types
    I32,
    I64,
    Bool,
    Void,

    // Literals
    IntLiteral(i64),
    StringLiteral(String),

    // Identifier
    Ident(String),

    // Operators
    Plus,
    Minus,
    Star,
    Slash,
    Percent,
    EqEq,
    NotEq,
    Lt,
    Gt,
    LtEq,
    GtEq,
    AndAnd,
    OrOr,
    Bang,
    Ampersand,
    Eq,

    // Punctuation
    LParen,
    RParen,
    LBrace,
    RBrace,
    LBracket,
    RBracket,
    Semicolon,
    Comma,
    Colon,
    Arrow,
    Dot,

    // Special
    Eof,
}

impl fmt::Display for TokenKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TokenKind::Fn => write!(f, "fn"),
            TokenKind::Let => write!(f, "let"),
            TokenKind::If => write!(f, "if"),
            TokenKind::Else => write!(f, "else"),
            TokenKind::While => write!(f, "while"),
            TokenKind::Return => write!(f, "return"),
            TokenKind::Struct => write!(f, "struct"),
            TokenKind::True => write!(f, "true"),
            TokenKind::False => write!(f, "false"),
            TokenKind::I32 => write!(f, "i32"),
            TokenKind::I64 => write!(f, "i64"),
            TokenKind::Bool => write!(f, "bool"),
            TokenKind::Void => write!(f, "void"),
            TokenKind::IntLiteral(n) => write!(f, "{}", n),
            TokenKind::StringLiteral(s) => write!(f, "\"{}\"", s),
            TokenKind::Ident(s) => write!(f, "{}", s),
            TokenKind::Plus => write!(f, "+"),
            TokenKind::Minus => write!(f, "-"),
            TokenKind::Star => write!(f, "*"),
            TokenKind::Slash => write!(f, "/"),
            TokenKind::Percent => write!(f, "%"),
            TokenKind::EqEq => write!(f, "=="),
            TokenKind::NotEq => write!(f, "!="),
            TokenKind::Lt => write!(f, "<"),
            TokenKind::Gt => write!(f, ">"),
            TokenKind::LtEq => write!(f, "<="),
            TokenKind::GtEq => write!(f, ">="),
            TokenKind::AndAnd => write!(f, "&&"),
            TokenKind::OrOr => write!(f, "||"),
            TokenKind::Bang => write!(f, "!"),
            TokenKind::Ampersand => write!(f, "&"),
            TokenKind::Eq => write!(f, "="),
            TokenKind::LParen => write!(f, "("),
            TokenKind::RParen => write!(f, ")"),
            TokenKind::LBrace => write!(f, "{{"),
            TokenKind::RBrace => write!(f, "}}"),
            TokenKind::LBracket => write!(f, "["),
            TokenKind::RBracket => write!(f, "]"),
            TokenKind::Semicolon => write!(f, ";"),
            TokenKind::Comma => write!(f, ","),
            TokenKind::Colon => write!(f, ":"),
            TokenKind::Arrow => write!(f, "->"),
            TokenKind::Dot => write!(f, "."),
            TokenKind::Eof => write!(f, "EOF"),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Token {
    pub kind: TokenKind,
    pub span: Span,
}

impl Token {
    pub fn new(kind: TokenKind, span: Span) -> Self {
        Token { kind, span }
    }
}

pub struct Lexer<'a> {
    source: &'a str,
    chars: std::iter::Peekable<std::str::CharIndices<'a>>,
    current_pos: usize,
    line: usize,
    column: usize,
}

impl<'a> Lexer<'a> {
    pub fn new(source: &'a str) -> Self {
        Lexer {
            source,
            chars: source.char_indices().peekable(),
            current_pos: 0,
            line: 1,
            column: 1,
        }
    }

    fn peek(&mut self) -> Option<char> {
        self.chars.peek().map(|&(_, c)| c)
    }

    fn advance(&mut self) -> Option<char> {
        if let Some((pos, c)) = self.chars.next() {
            self.current_pos = pos + c.len_utf8();
            if c == '\n' {
                self.line += 1;
                self.column = 1;
            } else {
                self.column += 1;
            }
            Some(c)
        } else {
            None
        }
    }

    fn skip_whitespace(&mut self) {
        while let Some(c) = self.peek() {
            if c.is_whitespace() {
                self.advance();
            } else if c == '/' {
                // Check for comment
                let saved_pos = self.current_pos;
                let saved_line = self.line;
                let saved_column = self.column;
                self.advance();
                if self.peek() == Some('/') {
                    // Single-line comment
                    while let Some(c) = self.peek() {
                        if c == '\n' {
                            break;
                        }
                        self.advance();
                    }
                } else {
                    // Not a comment, restore state
                    self.chars = self.source[saved_pos..].char_indices().peekable();
                    self.current_pos = saved_pos;
                    self.line = saved_line;
                    self.column = saved_column;
                    break;
                }
            } else {
                break;
            }
        }
    }

    fn read_identifier(&mut self, start: usize, start_line: usize, start_column: usize) -> Token {
        while let Some(c) = self.peek() {
            if c.is_alphanumeric() || c == '_' {
                self.advance();
            } else {
                break;
            }
        }

        let text = &self.source[start..self.current_pos];
        let kind = match text {
            "fn" => TokenKind::Fn,
            "let" => TokenKind::Let,
            "if" => TokenKind::If,
            "else" => TokenKind::Else,
            "while" => TokenKind::While,
            "return" => TokenKind::Return,
            "struct" => TokenKind::Struct,
            "true" => TokenKind::True,
            "false" => TokenKind::False,
            "i32" => TokenKind::I32,
            "i64" => TokenKind::I64,
            "bool" => TokenKind::Bool,
            "void" => TokenKind::Void,
            _ => TokenKind::Ident(text.to_string()),
        };

        Token::new(
            kind,
            Span::new(start, self.current_pos, start_line, start_column),
        )
    }

    fn read_number(&mut self, start: usize, start_line: usize, start_column: usize) -> Token {
        while let Some(c) = self.peek() {
            if c.is_ascii_digit() {
                self.advance();
            } else {
                break;
            }
        }

        let text = &self.source[start..self.current_pos];
        let value: i64 = text.parse().unwrap_or(0);

        Token::new(
            TokenKind::IntLiteral(value),
            Span::new(start, self.current_pos, start_line, start_column),
        )
    }

    fn read_string(&mut self, start: usize, start_line: usize, start_column: usize) -> Token {
        let mut value = String::new();

        while let Some(c) = self.peek() {
            if c == '"' {
                self.advance();
                break;
            } else if c == '\\' {
                self.advance();
                if let Some(escaped) = self.peek() {
                    self.advance();
                    match escaped {
                        'n' => value.push('\n'),
                        't' => value.push('\t'),
                        'r' => value.push('\r'),
                        '\\' => value.push('\\'),
                        '"' => value.push('"'),
                        _ => {
                            value.push('\\');
                            value.push(escaped);
                        }
                    }
                }
            } else {
                self.advance();
                value.push(c);
            }
        }

        Token::new(
            TokenKind::StringLiteral(value),
            Span::new(start, self.current_pos, start_line, start_column),
        )
    }

    pub fn next_token(&mut self) -> Token {
        self.skip_whitespace();

        let start = self.current_pos;
        let start_line = self.line;
        let start_column = self.column;

        let c = match self.advance() {
            Some(c) => c,
            None => {
                return Token::new(
                    TokenKind::Eof,
                    Span::new(start, start, start_line, start_column),
                )
            }
        };

        // Identifiers and keywords
        if c.is_alphabetic() || c == '_' {
            return self.read_identifier(start, start_line, start_column);
        }

        // Numbers
        if c.is_ascii_digit() {
            return self.read_number(start, start_line, start_column);
        }

        // Strings
        if c == '"' {
            return self.read_string(start, start_line, start_column);
        }

        // Operators and punctuation
        let kind = match c {
            '+' => TokenKind::Plus,
            '-' => {
                if self.peek() == Some('>') {
                    self.advance();
                    TokenKind::Arrow
                } else {
                    TokenKind::Minus
                }
            }
            '*' => TokenKind::Star,
            '/' => TokenKind::Slash,
            '%' => TokenKind::Percent,
            '=' => {
                if self.peek() == Some('=') {
                    self.advance();
                    TokenKind::EqEq
                } else {
                    TokenKind::Eq
                }
            }
            '!' => {
                if self.peek() == Some('=') {
                    self.advance();
                    TokenKind::NotEq
                } else {
                    TokenKind::Bang
                }
            }
            '<' => {
                if self.peek() == Some('=') {
                    self.advance();
                    TokenKind::LtEq
                } else {
                    TokenKind::Lt
                }
            }
            '>' => {
                if self.peek() == Some('=') {
                    self.advance();
                    TokenKind::GtEq
                } else {
                    TokenKind::Gt
                }
            }
            '&' => {
                if self.peek() == Some('&') {
                    self.advance();
                    TokenKind::AndAnd
                } else {
                    TokenKind::Ampersand
                }
            }
            '|' => {
                if self.peek() == Some('|') {
                    self.advance();
                    TokenKind::OrOr
                } else {
                    panic!(
                        "Unexpected character '|' at line {} column {}",
                        start_line, start_column
                    );
                }
            }
            '(' => TokenKind::LParen,
            ')' => TokenKind::RParen,
            '{' => TokenKind::LBrace,
            '}' => TokenKind::RBrace,
            '[' => TokenKind::LBracket,
            ']' => TokenKind::RBracket,
            ';' => TokenKind::Semicolon,
            ',' => TokenKind::Comma,
            ':' => TokenKind::Colon,
            '.' => TokenKind::Dot,
            _ => panic!(
                "Unexpected character '{}' at line {} column {}",
                c, start_line, start_column
            ),
        };

        Token::new(
            kind,
            Span::new(start, self.current_pos, start_line, start_column),
        )
    }

    pub fn tokenize(&mut self) -> Vec<Token> {
        let mut tokens = Vec::new();
        loop {
            let token = self.next_token();
            let is_eof = token.kind == TokenKind::Eof;
            tokens.push(token);
            if is_eof {
                break;
            }
        }
        tokens
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keywords() {
        let mut lexer = Lexer::new("fn let if else while return struct true false");
        let tokens = lexer.tokenize();

        assert_eq!(tokens[0].kind, TokenKind::Fn);
        assert_eq!(tokens[1].kind, TokenKind::Let);
        assert_eq!(tokens[2].kind, TokenKind::If);
        assert_eq!(tokens[3].kind, TokenKind::Else);
        assert_eq!(tokens[4].kind, TokenKind::While);
        assert_eq!(tokens[5].kind, TokenKind::Return);
        assert_eq!(tokens[6].kind, TokenKind::Struct);
        assert_eq!(tokens[7].kind, TokenKind::True);
        assert_eq!(tokens[8].kind, TokenKind::False);
        assert_eq!(tokens[9].kind, TokenKind::Eof);
    }

    #[test]
    fn test_types() {
        let mut lexer = Lexer::new("i32 i64 bool void");
        let tokens = lexer.tokenize();

        assert_eq!(tokens[0].kind, TokenKind::I32);
        assert_eq!(tokens[1].kind, TokenKind::I64);
        assert_eq!(tokens[2].kind, TokenKind::Bool);
        assert_eq!(tokens[3].kind, TokenKind::Void);
    }

    #[test]
    fn test_identifiers() {
        let mut lexer = Lexer::new("foo bar _test my_var x1");
        let tokens = lexer.tokenize();

        assert_eq!(tokens[0].kind, TokenKind::Ident("foo".to_string()));
        assert_eq!(tokens[1].kind, TokenKind::Ident("bar".to_string()));
        assert_eq!(tokens[2].kind, TokenKind::Ident("_test".to_string()));
        assert_eq!(tokens[3].kind, TokenKind::Ident("my_var".to_string()));
        assert_eq!(tokens[4].kind, TokenKind::Ident("x1".to_string()));
    }

    #[test]
    fn test_numbers() {
        let mut lexer = Lexer::new("0 42 12345");
        let tokens = lexer.tokenize();

        assert_eq!(tokens[0].kind, TokenKind::IntLiteral(0));
        assert_eq!(tokens[1].kind, TokenKind::IntLiteral(42));
        assert_eq!(tokens[2].kind, TokenKind::IntLiteral(12345));
    }

    #[test]
    fn test_strings() {
        let mut lexer = Lexer::new(r#""hello" "world\n" "tab\there""#);
        let tokens = lexer.tokenize();

        assert_eq!(
            tokens[0].kind,
            TokenKind::StringLiteral("hello".to_string())
        );
        assert_eq!(
            tokens[1].kind,
            TokenKind::StringLiteral("world\n".to_string())
        );
        assert_eq!(
            tokens[2].kind,
            TokenKind::StringLiteral("tab\there".to_string())
        );
    }

    #[test]
    fn test_operators() {
        let mut lexer = Lexer::new("+ - * / % == != < > <= >= && || ! & =");
        let tokens = lexer.tokenize();

        assert_eq!(tokens[0].kind, TokenKind::Plus);
        assert_eq!(tokens[1].kind, TokenKind::Minus);
        assert_eq!(tokens[2].kind, TokenKind::Star);
        assert_eq!(tokens[3].kind, TokenKind::Slash);
        assert_eq!(tokens[4].kind, TokenKind::Percent);
        assert_eq!(tokens[5].kind, TokenKind::EqEq);
        assert_eq!(tokens[6].kind, TokenKind::NotEq);
        assert_eq!(tokens[7].kind, TokenKind::Lt);
        assert_eq!(tokens[8].kind, TokenKind::Gt);
        assert_eq!(tokens[9].kind, TokenKind::LtEq);
        assert_eq!(tokens[10].kind, TokenKind::GtEq);
        assert_eq!(tokens[11].kind, TokenKind::AndAnd);
        assert_eq!(tokens[12].kind, TokenKind::OrOr);
        assert_eq!(tokens[13].kind, TokenKind::Bang);
        assert_eq!(tokens[14].kind, TokenKind::Ampersand);
        assert_eq!(tokens[15].kind, TokenKind::Eq);
    }

    #[test]
    fn test_punctuation() {
        let mut lexer = Lexer::new("( ) { } [ ] ; , : -> .");
        let tokens = lexer.tokenize();

        assert_eq!(tokens[0].kind, TokenKind::LParen);
        assert_eq!(tokens[1].kind, TokenKind::RParen);
        assert_eq!(tokens[2].kind, TokenKind::LBrace);
        assert_eq!(tokens[3].kind, TokenKind::RBrace);
        assert_eq!(tokens[4].kind, TokenKind::LBracket);
        assert_eq!(tokens[5].kind, TokenKind::RBracket);
        assert_eq!(tokens[6].kind, TokenKind::Semicolon);
        assert_eq!(tokens[7].kind, TokenKind::Comma);
        assert_eq!(tokens[8].kind, TokenKind::Colon);
        assert_eq!(tokens[9].kind, TokenKind::Arrow);
        assert_eq!(tokens[10].kind, TokenKind::Dot);
    }

    #[test]
    fn test_comments() {
        let mut lexer = Lexer::new("fn main() // this is a comment\n{ return 0; }");
        let tokens = lexer.tokenize();

        assert_eq!(tokens[0].kind, TokenKind::Fn);
        assert_eq!(tokens[1].kind, TokenKind::Ident("main".to_string()));
        assert_eq!(tokens[2].kind, TokenKind::LParen);
        assert_eq!(tokens[3].kind, TokenKind::RParen);
        assert_eq!(tokens[4].kind, TokenKind::LBrace);
        assert_eq!(tokens[5].kind, TokenKind::Return);
    }

    #[test]
    fn test_function() {
        let mut lexer = Lexer::new("fn add(a: i32, b: i32) -> i32 { return a + b; }");
        let tokens = lexer.tokenize();

        assert_eq!(tokens[0].kind, TokenKind::Fn);
        assert_eq!(tokens[1].kind, TokenKind::Ident("add".to_string()));
        assert_eq!(tokens[2].kind, TokenKind::LParen);
        assert_eq!(tokens[3].kind, TokenKind::Ident("a".to_string()));
        assert_eq!(tokens[4].kind, TokenKind::Colon);
        assert_eq!(tokens[5].kind, TokenKind::I32);
        assert_eq!(tokens[6].kind, TokenKind::Comma);
        assert_eq!(tokens[7].kind, TokenKind::Ident("b".to_string()));
        assert_eq!(tokens[8].kind, TokenKind::Colon);
        assert_eq!(tokens[9].kind, TokenKind::I32);
        assert_eq!(tokens[10].kind, TokenKind::RParen);
        assert_eq!(tokens[11].kind, TokenKind::Arrow);
        assert_eq!(tokens[12].kind, TokenKind::I32);
        assert_eq!(tokens[13].kind, TokenKind::LBrace);
        assert_eq!(tokens[14].kind, TokenKind::Return);
        assert_eq!(tokens[15].kind, TokenKind::Ident("a".to_string()));
        assert_eq!(tokens[16].kind, TokenKind::Plus);
        assert_eq!(tokens[17].kind, TokenKind::Ident("b".to_string()));
        assert_eq!(tokens[18].kind, TokenKind::Semicolon);
        assert_eq!(tokens[19].kind, TokenKind::RBrace);
    }

    #[test]
    fn test_span_tracking() {
        let mut lexer = Lexer::new("fn\nmain");
        let tokens = lexer.tokenize();

        assert_eq!(tokens[0].span.line, 1);
        assert_eq!(tokens[0].span.column, 1);
        assert_eq!(tokens[1].span.line, 2);
        assert_eq!(tokens[1].span.column, 1);
    }
}
