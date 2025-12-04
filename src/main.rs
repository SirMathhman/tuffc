mod ast;
mod codegen;
mod lexer;
mod parser;
mod semantic;

use std::env;
use std::fs;
use std::path::Path;
use std::process::Command;

use codegen::CodeGen;
use parser::Parser;
use semantic::TypeChecker;

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        eprintln!("Usage: tuffc <source.tuff> [options]");
        eprintln!("Options:");
        eprintln!("  -o <output>    Output executable name");
        eprintln!("  --emit-c       Emit C code only (don't compile)");
        eprintln!("  --no-check     Skip type checking");
        std::process::exit(1);
    }

    let source_path = &args[1];
    let mut output_name: Option<String> = None;
    let mut emit_c_only = false;
    let mut skip_check = false;

    let mut i = 2;
    while i < args.len() {
        match args[i].as_str() {
            "-o" => {
                if i + 1 < args.len() {
                    output_name = Some(args[i + 1].clone());
                    i += 1;
                } else {
                    eprintln!("Error: -o requires an argument");
                    std::process::exit(1);
                }
            }
            "--emit-c" => {
                emit_c_only = true;
            }
            "--no-check" => {
                skip_check = true;
            }
            _ => {
                eprintln!("Unknown option: {}", args[i]);
                std::process::exit(1);
            }
        }
        i += 1;
    }

    // Read source file
    let source = match fs::read_to_string(source_path) {
        Ok(content) => content,
        Err(e) => {
            eprintln!("Error reading file '{}': {}", source_path, e);
            std::process::exit(1);
        }
    };

    // Parse
    let mut parser = Parser::new(&source);
    let program = match parser.parse_program() {
        Ok(prog) => prog,
        Err(e) => {
            eprintln!("{}", e);
            std::process::exit(1);
        }
    };

    // Type check
    if !skip_check {
        let mut checker = TypeChecker::new();
        if let Err(errors) = checker.check_program(&program) {
            for error in errors {
                eprintln!("{}", error);
            }
            std::process::exit(1);
        }
    }

    // Generate C code
    let mut codegen = CodeGen::new();
    let c_code = codegen.generate(&program);

    // Determine output paths
    let source_stem = Path::new(source_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");

    let c_output_path = format!("{}.c", source_stem);

    if emit_c_only {
        // Write C code and exit
        if let Err(e) = fs::write(&c_output_path, &c_code) {
            eprintln!("Error writing C file: {}", e);
            std::process::exit(1);
        }
        println!("Generated: {}", c_output_path);
        return;
    }

    // Write C code to temp file
    if let Err(e) = fs::write(&c_output_path, &c_code) {
        eprintln!("Error writing C file: {}", e);
        std::process::exit(1);
    }

    // Compile C code
    let exe_output = output_name.unwrap_or_else(|| {
        if cfg!(windows) {
            format!("{}.exe", source_stem)
        } else {
            source_stem.to_string()
        }
    });

    // Try different C compilers
    let compilers = ["gcc", "clang", "cc"];
    let mut compiled = false;

    for compiler in &compilers {
        let result = Command::new(compiler)
            .args([&c_output_path, "-o", &exe_output])
            .output();

        match result {
            Ok(output) => {
                if output.status.success() {
                    compiled = true;
                    println!("Compiled: {}", exe_output);
                    break;
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    eprintln!("C compiler error:\n{}", stderr);
                    std::process::exit(1);
                }
            }
            Err(_) => continue, // Try next compiler
        }
    }

    if !compiled {
        eprintln!("Error: No C compiler found. Please install gcc or clang.");
        eprintln!("C code has been saved to: {}", c_output_path);
        std::process::exit(1);
    }

    // Clean up C file
    let _ = fs::remove_file(&c_output_path);
}
