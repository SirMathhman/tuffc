#define _CRT_SECURE_NO_WARNINGS
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <errno.h>
#include <limits.h>
#include <ctype.h>

typedef struct
{
    const char *suffix;
    int bits;
    int is_signed;
    long long min_val;
    long long max_val;
} TypeInfo;

// CPD-OFF
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
// CPD-ON

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

typedef struct
{
    const char *pos;
    int error;
} Parser;

// Forward declarations
static int parse_expr(Parser *p, long long *out_value, TypeInfo **out_type);

static void skip_ws(Parser *p)
{
    while (*p->pos && (*p->pos == ' ' || *p->pos == '\t'))
        p->pos++;
}

static int parse_primary(Parser *p, long long *out_value, TypeInfo **out_type)
{
    skip_ws(p);

    // Handle parenthesized expression
    if (*p->pos == '(')
    {
        p->pos++;
        if (parse_expr(p, out_value, out_type) != 1)
        {
            p->error = 1;
            return -1;
        }
        skip_ws(p);
        if (*p->pos != ')')
        {
            p->error = 1;
            return -1;
        }
        p->pos++;
        return 1;
    }

    // Parse a literal
    const char *start = p->pos;

    // Skip optional minus
    if (*p->pos == '-')
        p->pos++;

    // Find end of digits
    const char *digit_end = p->pos;
    while (*digit_end >= '0' && *digit_end <= '9')
        digit_end++;

    // Need at least one digit
    if (digit_end == p->pos)
    {
        p->error = 1;
        return -1;
    }

    // Find suffix - must be letters followed by digits (e.g., U8, I16, U64)
    const char *suffix_start = digit_end;
    const char *suffix_end = suffix_start;
    // First, consume alphabetic characters
    while (*suffix_end && isalpha((unsigned char)*suffix_end))
        suffix_end++;
    // Then, consume numeric characters
    while (*suffix_end && isdigit((unsigned char)*suffix_end))
        suffix_end++;

    // Need a suffix
    if (suffix_end == suffix_start)
    {
        p->error = 1;
        return -1;
    }

    // Extract and look up type
    size_t suffix_len = suffix_end - suffix_start;
    char suffix_buf[16];
    if (suffix_len >= sizeof(suffix_buf))
    {
        p->error = 1;
        return -1;
    }
    strncpy(suffix_buf, suffix_start, suffix_len);
    suffix_buf[suffix_len] = '\0';

    TypeInfo *type = find_type(suffix_buf);
    if (!type)
    {
        p->error = 1;
        return -1;
    }

    // Parse the numeric value
    char *endptr;
    errno = 0;
    long long value = strtoll(start, &endptr, 10);

    if (errno != 0 || endptr != digit_end)
    {
        p->error = 1;
        return -1;
    }

    // Check bounds
    if (value < type->min_val || value > type->max_val)
    {
        p->error = 1;
        return -1;
    }

    p->pos = suffix_end;
    *out_value = value;
    *out_type = type;
    return 1;
}

static TypeInfo *promote_type(TypeInfo *t1, TypeInfo *t2)
{
    if (!t1)
        return t2;
    if (!t2)
        return t1;

    // Promote to more bits
    if (t1->bits > t2->bits)
        return t1;
    if (t2->bits > t1->bits)
        return t2;

    // Same bits: prefer signed (or error - for now prefer signed)
    return t1;
}

static int add_checked(long long a, long long b, TypeInfo *result_type, long long *out)
{
    // Use 128-bit to detect overflow
    __int128 sum = (__int128)a + b;
    if (sum < result_type->min_val || sum > result_type->max_val)
        return 0;
    *out = (long long)sum;
    return 1;
}

static int sub_checked(long long a, long long b, TypeInfo *result_type, long long *out)
{
    __int128 diff = (__int128)a - b;
    if (diff < result_type->min_val || diff > result_type->max_val)
        return 0;
    *out = (long long)diff;
    return 1;
}

static int mul_checked(long long a, long long b, TypeInfo *result_type, long long *out)
{
    __int128 prod = (__int128)a * b;
    if (prod < result_type->min_val || prod > result_type->max_val)
        return 0;
    *out = (long long)prod;
    return 1;
}

static int parse_term(Parser *p, long long *out_value, TypeInfo **out_type)
{
    // CPD-OFF
    if (parse_primary(p, out_value, out_type) != 1)
        return -1;

    while (1)
    {
        skip_ws(p);
        char op = *p->pos;

        if (op == '*' || op == '/' || op == '%')
        {
            p->pos++;

            long long right_val;
            TypeInfo *right_type;
            if (parse_primary(p, &right_val, &right_type) != 1)
                return -1;

            TypeInfo *result_type = promote_type(*out_type, right_type);

            long long result;
            if (op == '*')
            {
                if (!mul_checked(*out_value, right_val, result_type, &result))
                {
                    p->error = 1;
                    return -1;
                }
            }
            else if (op == '/')
            {
                if (right_val == 0)
                {
                    p->error = 1;
                    return -1;
                }
                result = *out_value / right_val;
            }
            else
            { // op == '%'
                if (right_val == 0)
                {
                    p->error = 1;
                    return -1;
                }
                result = *out_value % right_val;
            }

            *out_value = result;
            *out_type = result_type;
        }
        else
        {
            break;
        }
    }
    // CPD-ON

    return 1;
}

static int parse_expr(Parser *p, long long *out_value, TypeInfo **out_type)
{
    // CPD-OFF
    if (parse_term(p, out_value, out_type) != 1)
        return -1;

    while (1)
    {
        skip_ws(p);
        char op = *p->pos;

        if (op == '+' || op == '-')
        {
            p->pos++;

            long long right_val;
            TypeInfo *right_type;
            if (parse_term(p, &right_val, &right_type) != 1)
                return -1;

            TypeInfo *result_type = promote_type(*out_type, right_type);

            long long result;
            if (op == '+')
            {
                if (!add_checked(*out_value, right_val, result_type, &result))
                {
                    p->error = 1;
                    return -1;
                }
            }
            else
            { // op == '-'
                if (!sub_checked(*out_value, right_val, result_type, &result))
                {
                    p->error = 1;
                    return -1;
                }
            }

            *out_value = result;
            *out_type = result_type;
        }
        else
        {
            break;
        }
    }
    // CPD-ON

    return 1;
}

static int parse_expression(const char *input, long long *out_value, TypeInfo **out_type)
{
    if (!input || *input == '\0')
    {
        *out_value = 0;
        *out_type = NULL;
        return 1;
    }

    Parser p;
    p.pos = input;
    p.error = 0;

    if (parse_expr(&p, out_value, out_type) != 1 || p.error)
        return -1;

    skip_ws(&p);
    if (*p.pos != '\0')
        return -1;

    return 1;
}

static char *generate_code(long long value)
{
    const char *template = "int main() {\n    return %lld;\n}\n";
    char *code = malloc(1024);
    if (!code)
        return NULL;
    snprintf(code, 1024, template, value);
    return code;
}

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

char *compile(const char *input)
{
    long long value;
    TypeInfo *type;

    int parse_result = parse_expression(input, &value, &type);

    if (parse_result == 1)
    {
        return generate_code(value);
    }
    else
    {
        return generate_error();
    }
}
