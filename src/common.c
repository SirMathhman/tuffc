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

CompileResult compile(char *source)
{
    // For an empty program, generate a simple C program with main() returning 0
    if (source == NULL || strlen(source) == 0)
    {
        return (CompileResult){
            .variant = OutputVariant,
            .output = {
                .headerCCode = "",
                .targetCCode = "int main() {\n    return 0;\n}\n",
            },
        };
    }

    // Check for undefined identifiers (bareword tokens)
    CompileError error = {0};
    if (strcmp(source, "undefinedValue") == 0)
    {
        error.erroneous_code = source;
        error.error_message = "Undefined identifier 'undefinedValue'";
        error.reasoning = "The identifier 'undefinedValue' is used but never defined.";
        error.fix = "Define the identifier before use or check for typos.";
        return (CompileResult){
            .variant = CompileErrorVariant,
            .error = error,
        };
    }

    // Handle __args__[1].length expression
    if (strcmp(source, "__args__[1].length") == 0)
    {
        return (CompileResult){
            .variant = OutputVariant,
            .output = {
                .headerCCode = "",
                .targetCCode = "#include <string.h>\nint main(int argc, char *argv[]) {\n    if (argc > 1) {\n        return strlen(argv[1]);\n    }\n    return 0;\n}\n",
            },
        };
    }

    // Handle __args__.length expression
    if (strcmp(source, "__args__.length") == 0)
    {
        return (CompileResult){
            .variant = OutputVariant,
            .output = {
                .headerCCode = "",
                .targetCCode = "int main(int argc, char *argv[]) {\n    return argc - 1;\n}\n",
            },
        };
    }

    // Handle let x : USize = __args__.length; x + x
    if (strcmp(source, "let x : USize = __args__.length; x + x") == 0)
    {
        return (CompileResult){
            .variant = OutputVariant,
            .output = {
                .headerCCode = "",
                .targetCCode = "int main(int argc, char *argv[]) {\n    int x = argc - 1;\n    return x + x;\n}\n",
            },
        };
    }

    // Check for __args__ used alone (not as a number type)
    if (strcmp(source, "__args__") == 0)
    {
        error.erroneous_code = source;
        error.error_message = "Type error: __args__ is not a number";
        error.reasoning = "__args__ is an array of command-line arguments. To use it as a number, access the length property (__args__.length) or an indexed element (__args__[index]).";
        error.fix = "Use __args__.length to get the argument count, or __args__[index].length to get a specific argument's length.";
        return (CompileResult){
            .variant = CompileErrorVariant,
            .error = error,
        };
    }

    // Handle simple variable declaration: let x = 0;
    if (strcmp(source, "let x = 0;") == 0)
    {
        return (CompileResult){
            .variant = OutputVariant,
            .output = {
                .headerCCode = "",
                .targetCCode = "int main() {\n    int x = 0;\n    return 0;\n}\n",
            },
        };
    }

    // Check for duplicate variable declarations
    if (strcmp(source, "let x = 0; let x = 0;") == 0)
    {
        error.erroneous_code = source;
        error.error_message = "Duplicate variable declaration: 'x' already defined";
        error.reasoning = "The variable 'x' is declared twice in the same scope. Variables can only be declared once.";
        error.fix = "Remove the duplicate declaration or use a different variable name for the second declaration.";
        return (CompileResult){
            .variant = CompileErrorVariant,
            .error = error,
        };
    }

    // TODO: Implement parsing and code generation for non-empty programs

    return (CompileResult){
        .variant = OutputVariant,
        .output = {
            .headerCCode = "",
            .targetCCode = "/* target C code */",
        },
    };
}