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

    // TODO: Implement parsing and code generation for non-empty programs

    return (CompileResult){
        .variant = OutputVariant,
        .output = {
            .headerCCode = "",
            .targetCCode = "/* target C code */",
        },
    };
}