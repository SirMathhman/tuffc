# Tuff Language Grammar

Tuff is a statically-typed, systems-level programming language designed to be simple enough to implement a self-hosted compiler.

## Lexical Elements

### Keywords

```
fn let if else while return struct true false
```

### Types

```
i32 i64 bool void
```

### Operators

```
+  -  *  /  %          // Arithmetic
== != < > <= >=        // Comparison
&& ||                  // Logical
!                      // Unary not
&  *                   // Address-of, dereference (context-dependent)
=                      // Assignment
```

### Punctuation

```
( ) { } [ ] ; , : ->
```

### Literals

- Integer: `0`, `42`, `-17`
- Boolean: `true`, `false`
- String: `"hello world"` (for later bootstrap)

### Identifiers

Start with letter or underscore, followed by letters, digits, or underscores.

```
[a-zA-Z_][a-zA-Z0-9_]*
```

### Comments

```
// Single-line comment
```

## Grammar (EBNF)

```ebnf
program        = { item } ;

item           = function_def
               | struct_def ;

struct_def     = "struct" IDENT "{" { field } "}" ;
field          = IDENT ":" type ";" ;

function_def   = "fn" IDENT "(" [ params ] ")" [ "->" type ] block ;
params         = param { "," param } ;
param          = IDENT ":" type ;

type           = "i32"
               | "i64"
               | "bool"
               | "void"
               | "*" type
               | IDENT ;

block          = "{" { statement } "}" ;

statement      = let_stmt
               | if_stmt
               | while_stmt
               | return_stmt
               | expr_stmt ;

let_stmt       = "let" IDENT [ ":" type ] "=" expr ";" ;
if_stmt        = "if" expr block [ "else" ( if_stmt | block ) ] ;
while_stmt     = "while" expr block ;
return_stmt    = "return" [ expr ] ";" ;
expr_stmt      = expr ";" ;

expr           = assignment ;
assignment     = or_expr [ "=" assignment ] ;
or_expr        = and_expr { "||" and_expr } ;
and_expr       = equality { "&&" equality } ;
equality       = comparison { ( "==" | "!=" ) comparison } ;
comparison     = term { ( "<" | ">" | "<=" | ">=" ) term } ;
term           = factor { ( "+" | "-" ) factor } ;
factor         = unary { ( "*" | "/" | "%" ) unary } ;
unary          = ( "!" | "-" | "&" | "*" ) unary
               | call ;
call           = primary { "(" [ args ] ")" | "." IDENT | "[" expr "]" } ;
args           = expr { "," expr } ;
primary        = INT_LITERAL
               | BOOL_LITERAL
               | STRING_LITERAL
               | IDENT
               | "(" expr ")" ;
```

## Examples

### Hello World (with extern)

```tuff
fn main() -> i32 {
    return 0;
}
```

### Variables and Arithmetic

```tuff
fn add(a: i32, b: i32) -> i32 {
    return a + b;
}

fn main() -> i32 {
    let x: i32 = 10;
    let y: i32 = 20;
    let z: i32 = add(x, y);
    return z;
}
```

### Control Flow

```tuff
fn max(a: i32, b: i32) -> i32 {
    if a > b {
        return a;
    } else {
        return b;
    }
}

fn factorial(n: i32) -> i32 {
    let result: i32 = 1;
    let i: i32 = 1;
    while i <= n {
        result = result * i;
        i = i + 1;
    }
    return result;
}
```

### Structs

```tuff
struct Point {
    x: i32;
    y: i32;
}

fn distance_squared(p: Point) -> i32 {
    return p.x * p.x + p.y * p.y;
}
```

## Type System

- All types are known at compile time
- No implicit conversions
- Pointers are explicit with `*T` syntax
- Function return type defaults to `void` if omitted
