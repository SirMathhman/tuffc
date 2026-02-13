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

// Helper function to create a specific compilation error result
static CompileResult make_error(char *source, const char *message, const char *reasoning, const char *fix)
{
    CompileResult result;
    result.variant = CompileErrorVariant;
    result.error.erroneous_code = source;
    result.error.error_message = (char *)message;
    result.error.reasoning = (char *)reasoning;
    result.error.fix = (char *)fix;
    return result;
}

// Helper function to check if a numeric value is within range for a type suffix
static int is_value_in_range(long value, const char *suffix)
{
    // Type range specifications
    struct
    {
        const char *type;
        long min;
        long max;
    } type_ranges[] = {
        {"U8", 0, 255},
        {"I8", -128, 127},
        {"U16", 0, 65535},
        {"I16", -32768, 32767},
        {NULL, 0, 0} // Sentinel for unknown types
    };

    // Check each type range
    for (int i = 0; type_ranges[i].type != NULL; i++)
    {
        if (strcmp(suffix, type_ranges[i].type) == 0)
        {
            return value >= type_ranges[i].min && value <= type_ranges[i].max;
        }
    }

    // Unknown suffix - accept any value
    return 1;
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

    // Check if source contains a minus sign with a type suffix (invalid)
    // e.g., "-100U8" is not allowed
    const char *pos = source;
    int has_minus = 0;
    while (*pos)
    {
        if (*pos == '-')
        {
            has_minus = 1;
        }
        // Check if there are alphabetic characters (potential type suffix)
        if (has_minus && isalpha(*pos))
        {
            // Found minus sign followed (eventually) by letters - invalid
            return make_error(source, "Negative number with type suffix is not allowed",
                              "Type-suffixed literals cannot be negative. The minus operator is not allowed on type-suffixed numeric literals.",
                              "Use a positive number or omit the type suffix.");
        }
        pos++;
    }

    // Try to parse source as a numeric literal, possibly with a type suffix
    char *endptr;
    long num = strtol(source, &endptr, 10);

    // Check if we parsed at least one digit
    if (endptr != source)
    {
        // Check if the rest is a valid type suffix (U8, U16, I8, etc.)
        // Accept alphanumeric characters in the suffix
        int valid = 1;
        char *suffix_start = endptr;
        while (*endptr != '\0')
        {
            if (!isalnum(*endptr))
            {
                valid = 0;
                break;
            }
            endptr++;
        }

        if (valid)
        {
            // Validate numeric value against type suffix constraints
            if (suffix_start != endptr) // There is a type suffix
            {
                // Extract the suffix
                int suffix_len = endptr - suffix_start;
                char suffix[16];
                memcpy(suffix, suffix_start, suffix_len);
                suffix[suffix_len] = '\0';

                // Check if value is in range for the type
                if (!is_value_in_range(num, suffix))
                {
                    return make_error(source, "Numeric value out of range for type",
                                      "The literal value does not fit within the range of the specified type.",
                                      "Use a value within the valid range for the type or remove the type suffix.");
                }
            }

            // Successfully parsed as a numeric literal with optional suffix
            result.variant = OutputVariant;
            result.output.headerCCode = "";
            generate_main_return_code(targetCode, sizeof(targetCode), num);
            result.output.targetCCode = targetCode;
            return result;
        }
    }

    // Default scenario is unknown source code.
    return make_error(source, "Invalid syntax",
                      "The source code does not match any recognized pattern. Expected empty input, a numeric literal, or a numeric literal with a type suffix.",
                      "Check the syntax and ensure the input is a valid numeric literal, optionally with a type suffix like U8, U16, I32, etc.");
}