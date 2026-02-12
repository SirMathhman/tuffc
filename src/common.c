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
    result.variant = OutputVariant;
    
    // For empty source, generate a simple valid C program
    if (source == NULL || source[0] == '\0')
    {
        result.output.headerCCode = "";
        result.output.targetCCode = "int main() { return 0; }\n";
    }
    else
    {
        result.output.headerCCode = "";
        result.output.targetCCode = source;
    }
    
    return result;
}