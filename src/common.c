#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <stdarg.h>
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

// Helper function to generate C code that returns a specific exit code
static void generate_main_return_code(char *buffer, size_t bufsize, long returnValue)
{
    snprintf(buffer, bufsize, "int main() {\n    return %ld;\n}\n", returnValue);
}

CompileResult compile(char *source)
{
    CompileResult result;
    static char targetCode[256];

    // For empty source code, generate a valid C program that exits with code 0
    if (source == NULL || strlen(source) == 0)
    {
        result.variant = OutputVariant;
        result.output.headerCCode = "";
        generate_main_return_code(targetCode, sizeof(targetCode), 0);
        result.output.targetCCode = targetCode;
        return result;
    }

    // Try to parse source as a numeric literal
    char *endptr;
    long num = strtol(source, &endptr, 10);
    if (endptr == source + strlen(source) && endptr != source)
    {
        // Successfully parsed entire source as a number
        result.variant = OutputVariant;
        result.output.headerCCode = "";
        generate_main_return_code(targetCode, sizeof(targetCode), num);
        result.output.targetCCode = targetCode;
        return result;
    }

    // Default scenario is unknown source code.
    result.variant = CompileErrorVariant;
    result.error.erroneous_code = source;
    result.error.error_message = "Unknown compilation error";
    result.error.reasoning = "The compiler encountered an unexpected condition that it doesn't know how to handle.";
    result.error.fix = "Please report this issue to the developers with the source code that caused the error.";
    return result;
}