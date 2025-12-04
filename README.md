# Tuff Compiler (tuffc)

A self-hosted compiler for the Tuff programming language — a statically-typed, systems-level language designed to eventually compile itself.

## Building

```bash
cargo build --release
```

## Usage

```bash
# Compile a Tuff program to an executable
tuffc source.tuff -o output

# Generate C code only (for inspection or manual compilation)
tuffc source.tuff --emit-c

# Skip type checking (not recommended)
tuffc source.tuff --no-check
```

## Language Overview

Tuff is a simple, statically-typed language with:

- **Functions**: `fn name(params) -> return_type { body }`
- **Variables**: `let name: type = value;`
- **Types**: `i32`, `i64`, `bool`, `void`, pointers (`*T`), structs
- **Control Flow**: `if`/`else`, `while`
- **Operators**: Arithmetic (`+`, `-`, `*`, `/`, `%`), comparison (`==`, `!=`, `<`, `>`, `<=`, `>=`), logical (`&&`, `||`, `!`)

### Example

```tuff
fn factorial(n: i32) -> i32 {
    let result: i32 = 1;
    let i: i32 = 1;
    while i <= n {
        result = result * i;
        i = i + 1;
    }
    return result;
}

fn main() -> i32 {
    return factorial(5);  // Returns 120
}
```

See the [docs/grammar.md](docs/grammar.md) for the complete language specification.

## Architecture

The compiler is structured as a traditional multi-pass compiler:

1. **Lexer** (`src/lexer.rs`) — Tokenizes source code
2. **Parser** (`src/parser.rs`) — Builds an Abstract Syntax Tree
3. **Semantic Analysis** (`src/semantic.rs`) — Type checking and validation
4. **Code Generation** (`src/codegen.rs`) — Emits C code
5. **Backend** — Uses system C compiler (clang/gcc) to produce executables

## Requirements

- Rust 1.70+ (for building the compiler)
- A C compiler (clang or gcc) for generating executables

## Testing

```bash
cargo test
```

## License

MIT
