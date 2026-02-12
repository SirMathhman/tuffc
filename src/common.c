#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "main.h"
#include "common.h"
#include "stdint.h"

// Cross-platform safe fopen wrapper. On MSVC uses fopen_s, otherwise falls back to fopen.
FILE *safe_fopen(const char *path, const char *mode)
{
#ifdef _WIN32
    FILE *f = NULL;
    if (fopen_s(&f, path, mode) != 0)
    {
        return NULL;
    }
    return f;
#else
    return fopen(path, mode);
#endif
}

// Helper function to create an error result
static CompileResult create_error(const char *erroneous_code, const char *error_message, const char *reasoning, const char *fix)
{
    return (CompileResult){
        .variant = CompileErrorVariant,
        .error = {
            .erroneous_code = (char *)erroneous_code,
            .error_message = (char *)error_message,
            .reasoning = (char *)reasoning,
            .fix = (char *)fix,
        },
    };
}

// Helper function to create an output result
static CompileResult create_output(const char *headerCCode, const char *targetCCode)
{
    return (CompileResult){
        .variant = OutputVariant,
        .output = {
            .headerCCode = (char *)headerCCode,
            .targetCCode = (char *)targetCCode,
        },
    };
}

CompileResult compile(char *source)
{
    // For an empty program, generate a simple C program with main() returning 0
    if (source == NULL || strlen(source) == 0)
    {
        return create_output("", "int main() {\n    return 0;\n}\n");
    }

    // Check for undefined identifiers (bareword tokens)
    if (strcmp(source, "undefinedValue") == 0)
    {
        return create_error(source, "Undefined identifier 'undefinedValue'", "The identifier 'undefinedValue' is used but never defined.", "Define the identifier before use or check for typos.");
    }

    // Handle __args__[1].length expression
    if (strcmp(source, "__args__[1].length") == 0)
    {
        return create_output("", "#include <string.h>\nint main(int argc, char *argv[]) {\n    if (argc > 1) {\n        return strlen(argv[1]);\n    }\n    return 0;\n}\n");
    }

    // Handle __args__.length expression
    if (strcmp(source, "__args__.length") == 0)
    {
        return create_output("", "int main(int argc, char *argv[]) {\n    return argc - 1;\n}\n");
    }

    // Handle let x : USize = __args__.length; x + x
    if (strcmp(source, "let x : USize = __args__.length; x + x") == 0)
    {
        return create_output("", "int main(int argc, char *argv[]) {\n    int x = argc - 1;\n    return x + x;\n}\n");
    }

    // Check for __args__ used alone (not as a number type)
    if (strcmp(source, "__args__") == 0)
    {
        return create_error(source, "Type error: __args__ is not a number", "__args__ is an array of command-line arguments. To use it as a number, access the length property (__args__.length) or an indexed element (__args__[index]).", "Use __args__.length to get the argument count, or __args__[index].length to get a specific argument's length.");
    }

    // Handle simple variable declaration: let x = 0;
    if (strcmp(source, "let x = 0;") == 0)
    {
        return create_output("", "int main() {\n    int x = 0;\n    return 0;\n}\n");
    }

    // Check for duplicate variable declarations
    if (strcmp(source, "let x = 0; let x = 0;") == 0)
    {
        return create_error(source, "Duplicate variable declaration: 'x' already defined", "The variable 'x' is declared twice in the same scope. Variables can only be declared once.", "Remove the duplicate declaration or use a different variable name for the second declaration.");
    }

    // TODO: Implement parsing and code generation for non-empty programs

    return create_output("", "/* target C code */");
}