#pragma once

#include <stdio.h>

typedef struct
{
    char *headerCCode;
    char *targetCCode;
} Output;

// Cross-platform safe fopen wrapper (uses fopen_s on MSVC)
FILE *safe_fopen(const char *path, const char *mode);

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