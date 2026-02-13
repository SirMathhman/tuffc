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

// Helper function to check if a suffix is a valid type
static int is_valid_type_suffix(const char *suffix)
{
    static const char *valid_suffixes[] = {
        "U8", "U16", "U32", "U64",
        "I8", "I16", "I32", "I64",
        NULL // Sentinel
    };

    for (int i = 0; valid_suffixes[i] != NULL; i++)
    {
        if (strcmp(suffix, valid_suffixes[i]) == 0)
            return 1;
    }
    return 0;
}

// Helper function to check if a numeric value is within range for a type suffix
static int is_value_in_range(long value, const char *suffix)
{
    // Type range definitions using long long to handle full ranges
    struct TypeRange
    {
        const char *name;
        long long min;
        long long max;
    };

    static struct TypeRange ranges[] = {
        {"U8", 0, 255},
        {"I8", -128, 127},
        {"U16", 0, 65535},
        {"I16", -32768, 32767},
        {"U32", 0, 4294967295LL},
        {"I32", -2147483648LL, 2147483647LL},
        {"U64", 0, 18446744073709551615ULL},
        {"I64", -9223372036854775807LL - 1, 9223372036854775807LL},
        {NULL, 0, 0}};

    for (int i = 0; ranges[i].name != NULL; i++)
    {
        if (strcmp(suffix, ranges[i].name) == 0)
            return value >= ranges[i].min && value <= ranges[i].max;
    }

    return 0; // Unknown type
}

// Helper function to extract type from "read<TYPE>()" pattern
// Returns 1 if valid, 0 otherwise. Sets type_name buffer.
static int parse_read_type(const char *str, char *type_name, int max_len)
{
    if (strncmp(str, "read<", 5) != 0)
        return 0;

    const char *type_start = str + 5;
    const char *type_end = strchr(type_start, '>');

    if (type_end == NULL || strcmp(type_end, ">()") != 0)
        return 0;

    int type_len = type_end - type_start;
    if (type_len >= max_len)
        return 0;

    memcpy(type_name, type_start, type_len);
    type_name[type_len] = '\0';

    return is_valid_type_suffix(type_name);
}

// Helper to extract a substring and null-terminate it
static void extract_substring(char *dest, int dest_size, const char *src, int len)
{
    if (len >= dest_size)
        len = dest_size - 1;
    memcpy(dest, src, len);
    dest[len] = '\0';
}

// Helper to generate code output result
static CompileResult generate_result_code(const char *template_fmt, ...)
{
    CompileResult result;
    static char targetCode[256];
    va_list args;
    va_start(args, template_fmt);
    vsnprintf(targetCode, sizeof(targetCode), template_fmt, args);
    va_end(args);

    result.variant = OutputVariant;
    result.output.headerCCode = "";
    result.output.targetCCode = targetCode;
    return result;
}

// Helper to generate code for reading a single value from stdin
static CompileResult generate_read_code(void)
{
    static char code[256];
    const char *readCodeTemplate =
        "#include <stdio.h>\n"
        "int main() {\n"
        "    int value;\n"
        "    scanf(\"%d\", &value);\n"
        "    return (int)value;\n"
        "}\n";

    snprintf(code, sizeof(code), "%s", readCodeTemplate);

    CompileResult result;
    result.variant = OutputVariant;
    result.output.headerCCode = "";
    result.output.targetCCode = code;
    return result;
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

    // Check for binary operations FIRST (e.g., "read<U8>() + read<U8>()")
    const char *plus_op = strchr(source, '+');
    if (plus_op != NULL)
    {
        // Try to parse as binary addition
        // Split by the '+' operator
        int left_len = plus_op - source;
        char left_op[128];
        extract_substring(left_op, sizeof(left_op), source, left_len);

        // Trim whitespace from left operand
        while (left_len > 0 && isspace(left_op[left_len - 1]))
        {
            left_op[--left_len] = '\0';
        }

        // Get right operand and trim leading whitespace
        const char *right_op_start = plus_op + 1;
        while (*right_op_start && isspace(*right_op_start))
        {
            right_op_start++;
        }

        // Try to parse both operands as read<TYPE>()
        char left_type[16], right_type[16];
        if (parse_read_type(left_op, left_type, sizeof(left_type)) &&
            parse_read_type(right_op_start, right_type, sizeof(right_type)))
        {
            // Generate C code that reads two values and returns their sum
            return generate_result_code(
                "#include <stdio.h>\nint main() {\n    int a, b;\n    scanf(\"%%d %%d\", &a, &b);\n    return a + b;\n}\n");
        }
    }

    // Check for read<TYPE>() pattern
    const char *read_pattern = "read<";
    if (strncmp(source, read_pattern, 5) == 0)
    {
        char type_name[16];
        if (parse_read_type(source, type_name, sizeof(type_name)))
        {
            // Generate C code that reads from stdin and returns the value
            return generate_read_code();
        }
        else
        {
            return make_error(source, "Unknown type in read function",
                              "The type in read<T>() is not a recognized integer type.",
                              "Specify a valid integer type for the read function.");
        }
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
                extract_substring(suffix, sizeof(suffix), suffix_start, suffix_len);

                // Check if suffix is a valid type
                if (!is_valid_type_suffix(suffix))
                {
                    return make_error(source, "Unknown type suffix",
                                      "The suffix does not correspond to a numeric type.",
                                      "Specify a valid numeric type suffix.");
                }

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

    // If we get here, the source doesn't match any recognized pattern
    return make_error(source, "Invalid syntax",
                      "The source code does not match any recognized expression pattern.",
                      "Check the syntax of your input and ensure it matches a valid expression format (empty, numeric literal, read<TYPE>(), or binary addition).");
}