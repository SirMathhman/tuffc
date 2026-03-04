#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <errno.h>
#include <limits.h>

// Helper: parse a numeric suffix and get type info
typedef struct
{
    const char *suffix;
    int bits;
    int is_signed;
    long long min_val;
    long long max_val;
} TypeInfo;

static TypeInfo type_map[] = {
    {"I8", 8, 1, -128LL, 127LL},
    {"U8", 8, 0, 0LL, 255LL},
    {"I16", 16, 1, -32768LL, 32767LL},
    {"U16", 16, 0, 0LL, 65535LL},
    {"I32", 32, 1, -2147483648LL, 2147483647LL},
    {"U32", 32, 0, 0LL, 4294967295LL},
    {"I64", 64, 1, -9223372036854775807LL - 1, 9223372036854775807LL},
    {"U64", 64, 0, 0LL, 18446744073709551615ULL},
    {NULL, 0, 0, 0, 0}};

// Find type info by suffix
static TypeInfo *find_type(const char *suffix)
{
    for (int i = 0; type_map[i].suffix != NULL; i++)
    {
        if (strcmp(type_map[i].suffix, suffix) == 0)
        {
            return &type_map[i];
        }
    }
    return NULL;
}

// Parse a numeric literal with type suffix (e.g., "100U8")
static int parse_literal(const char *input, long long *out_value, TypeInfo **out_type)
{
    if (!input || *input == '\0')
    {
        // Empty input: generate code that returns 0
        *out_value = 0;
        *out_type = NULL;
        return 1;
    }

    // Find where the suffix starts
    // Suffix is all trailing non-digit characters after the optional leading minus and digits
    const char *p = input;

    // Skip optional minus sign
    if (*p == '-')
        p++;

    // Find end of numeric part
    const char *digit_end = p;
    while (*digit_end >= '0' && *digit_end <= '9')
        digit_end++;

    // Check if we have a valid structure: digits followed by suffix
    if (digit_end == p)
    {
        // No digits found
        return -1;
    }

    const char *suffix = digit_end;
    if (*suffix == '\0')
    {
        // No suffix (e.g., "100" without U8)
        return -1;
    }

    // Find type info
    TypeInfo *type = find_type(suffix);
    if (!type)
    {
        return -1; // Unknown type suffix
    }

    // Parse the numeric value
    char *endptr;
    errno = 0;
    long long value = strtoll(input, &endptr, 10);

    if (errno != 0 || endptr != digit_end)
    {
        return -1; // Parse error
    }

    // Check if value fits in the type
    if (value < type->min_val || value > type->max_val)
    {
        return -1; // Overflow/underflow
    }

    *out_value = value;
    *out_type = type;
    return 1; // Success
}

// Generate C code for the literal
static char *generate_code(long long value)
{
    // Generate C code that returns the value
    const char *template = "int main() {\n    return %lld;\n}\n";
    int max_len = 1024;
    char *code = malloc(max_len);
    if (!code)
        return NULL;

    snprintf(code, max_len, template, value);
    return code;
}

// Generate a compile error
static char *generate_error()
{
    const char *error_code = "#error \"Invalid numeric literal or type overflow\"\n";
    size_t len = strlen(error_code);
    char *code = malloc(len + 1);
    if (!code)
        return NULL;
    memcpy(code, error_code, len + 1);
    return code;
}

// Stub implementation of compile function.
// Takes an input string and returns a newly allocated string.
// Caller is responsible for freeing the returned string.

char *compile(const char *input)
{
    long long value;
    TypeInfo *type;

    int parse_result = parse_literal(input, &value, &type);

    if (parse_result == 1)
    {
        // Valid literal: generate code that returns the value
        return generate_code(value);
    }
    else
    {
        // Invalid literal: generate code that won't compile
        return generate_error();
    }
}
