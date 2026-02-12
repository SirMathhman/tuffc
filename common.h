#pragma once

#include <stdio.h>

typedef struct
{
    char *headerCCode;
    char *targetCCode;
} Output;

typedef struct
{
    char *erroneous_code;
    char *error_message;
    char *reasoning;
    char *fix;
} CompileError;

typedef struct
{
    enum
    {
        OutputVariant,
        CompileErrorVariant,
    } variant;
    union
    {
        Output output;
        CompileError error;
    };
} CompileResult;

CompileResult compile(char *source);

// Cross-platform wrapper for secure fopen variants on MSVC
// Returns NULL on failure (same as fopen)
FILE *safe_fopen(const char *path, const char *mode);