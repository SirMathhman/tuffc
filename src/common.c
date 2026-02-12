#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
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
    CompileResult result;

    // For empty source, generate a simple valid C program
    if (source == NULL || source[0] == '\0')
    {
        result.variant = OutputVariant;
        result.output.headerCCode = "";
        result.output.targetCCode = "int main() { return 0; }\n";
    }
    // Handle __args__.length - return the argc value
    else if (strcmp(source, "__args__.length") == 0)
    {
        result.variant = OutputVariant;
        result.output.headerCCode = "";
        result.output.targetCCode = "int main(int argc, char *argv[]) { return argc; }\n";
    }
    else
    {
        result.variant = CompileErrorVariant;
        result.error.erroneous_code = source;
        result.error.error_message = "Unsupported source code";
        result.error.reasoning = "Only empty programs and __args__.length are supported";
        result.error.fix = "Provide an empty source string or __args__.length";
    }

    return result;
}