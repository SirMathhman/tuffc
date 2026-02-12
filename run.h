#pragma once


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