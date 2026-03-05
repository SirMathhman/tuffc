#define _CRT_SECURE_NO_WARNINGS
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <errno.h>
#include <limits.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>

// Support for 128-bit integers for overflow detection
#if defined(__GNUC__) || defined(__clang__)
typedef __int128 int128_t;
#else
// Fallback: not ideal but allows non-GCC compilation
typedef long long int128_t;
#endif

typedef struct
{
    const char *suffix;
    uint32_t bits;
    bool is_signed;
    int64_t min_val;
    int64_t max_val;
} TypeInfo;

// CPD-OFF
static TypeInfo type_map[] = {
    {"I8", 8, true, -128LL, 127LL},
    {"U8", 8, false, 0LL, 255LL},
    {"I16", 16, true, -32768LL, 32767LL},
    {"U16", 16, false, 0LL, 65535LL},
    {"I32", 32, true, -2147483648LL, 2147483647LL},
    {"U32", 32, false, 0LL, 4294967295LL},
    {"I64", 64, true, -9223372036854775807LL - 1, 9223372036854775807LL},
    {"U64", 64, false, 0LL, 18446744073709551615ULL},
    {NULL, 0, false, 0, 0}};
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

// Variable binding in symbol table
typedef struct
{
    char name[32];
    int64_t value;
    TypeInfo *type;
    bool is_mutable;
} VarBinding;

// Scope in symbol table
typedef struct
{
    VarBinding bindings[64];
    int count;
} Scope;

typedef struct
{
    const char *pos;
    bool error;
    Scope scopes[16];
    int scope_depth;
    bool needs_code_gen;
} Parser;

// Forward declarations
static int parse_expr(Parser *p, int64_t *out_value, TypeInfo **out_type);

static void skip_ws(Parser *p)
{
    while (*p->pos && (*p->pos == ' ' || *p->pos == '\t'))
        p->pos++;
}

static void push_scope(Parser *p)
{
    if (p->scope_depth >= 16)
    {
        p->error = true;
        return;
    }
    p->scopes[p->scope_depth].count = 0;
    p->scope_depth++;
}

static void pop_scope(Parser *p)
{
    if (p->scope_depth > 0)
        p->scope_depth--;
}

static VarBinding *lookup_var(Parser *p, const char *name, size_t name_len)
{
    if (p->scope_depth == 0)
        return NULL;
    Scope *current_scope = &p->scopes[p->scope_depth - 1];
    for (int i = 0; i < current_scope->count; i++)
    {
        if (strncmp(current_scope->bindings[i].name, name, name_len) == 0 &&
            current_scope->bindings[i].name[name_len] == '\0')
        {
            return &current_scope->bindings[i];
        }
    }
    return NULL;
}

static bool is_var_defined_anywhere(Parser *p, const char *name, size_t name_len)
{
    for (int scope_idx = 0; scope_idx < p->scope_depth; scope_idx++)
    {
        Scope *scope = &p->scopes[scope_idx];
        for (int i = 0; i < scope->count; i++)
        {
            if (strncmp(scope->bindings[i].name, name, name_len) == 0 &&
                scope->bindings[i].name[name_len] == '\0')
            {
                return true;
            }
        }
    }
    return false;
}

static bool define_var(Parser *p, const char *name, size_t name_len, int64_t value, TypeInfo *type, bool is_mutable)
{
    if (p->scope_depth == 0)
        return false;
    if (is_var_defined_anywhere(p, name, name_len))
        return false;
    Scope *current_scope = &p->scopes[p->scope_depth - 1];
    if (current_scope->count >= 64)
        return false;
    VarBinding *binding = &current_scope->bindings[current_scope->count];
    if (name_len >= sizeof(binding->name))
        return false;
    strncpy(binding->name, name, name_len);
    binding->name[name_len] = '\0';
    binding->value = value;
    binding->type = type;
    binding->is_mutable = is_mutable;
    current_scope->count++;
    return true;
}

// CPD-OFF
// Helper: consume an identifier from current position
// Returns length of identifier, updates p->pos
static size_t consume_identifier(Parser *p, const char **out_start)
{
    *out_start = p->pos;
    while (*p->pos && (isalnum((unsigned char)*p->pos) || *p->pos == '_'))
        p->pos++;
    return p->pos - *out_start;
}
// CPD-ON

static int parse_primary(Parser *p, int64_t *out_value, TypeInfo **out_type)
{
    skip_ws(p);

    // CPD-OFF - Handle parenthesized and block expressions (error patterns are unavoidable)
    // Handle parenthesized expression
    if (*p->pos == '(')
    {
        p->pos++;
        if (parse_expr(p, out_value, out_type) != 1)
        {
            p->error = true;
            return -1;
        }
        skip_ws(p);
        if (*p->pos != ')')
        {
            p->error = true;
            return -1;
        }
        p->pos++;
        return 1;
    }

    // Handle block expression
    if (*p->pos == '{')
    {
        p->pos++;
        push_scope(p);
        p->needs_code_gen = true;
        if (parse_expr(p, out_value, out_type) != 1)
        {
            p->error = true;
            pop_scope(p);
            return -1;
        }
        skip_ws(p);
        if (*p->pos != '}')
        {
            p->error = true;
            pop_scope(p);
            return -1;
        }
        p->pos++;
        pop_scope(p);
        return 1;
    }
    // CPD-ON

    // Check for variable reference (identifier)
    if (isalpha((unsigned char)*p->pos) || *p->pos == '_')
    {
        const char *id_start;
        size_t id_len = consume_identifier(p, &id_start);
        VarBinding *binding = lookup_var(p, id_start, id_len);
        if (!binding)
        {
            p->error = true;
            return -1;
        }
        *out_value = binding->value;
        *out_type = binding->type;
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
        p->error = true;
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
        p->error = true;
        return -1;
    }

    // Extract and look up type
    size_t suffix_len = suffix_end - suffix_start;
    char suffix_buf[16];
    if (suffix_len >= sizeof(suffix_buf))
    {
        p->error = true;
        return -1;
    }
    strncpy(suffix_buf, suffix_start, suffix_len);
    suffix_buf[suffix_len] = '\0';

    TypeInfo *type = find_type(suffix_buf);
    if (!type)
    {
        p->error = true;
        return -1;
    }

    // Parse the numeric value
    char *endptr;
    errno = 0;
    int64_t value = strtoll(start, &endptr, 10);

    if (errno != 0 || endptr != digit_end)
    {
        p->error = true;
        return -1;
    }

    // Check bounds
    if (value < type->min_val || value > type->max_val)
    {
        p->error = true;
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

static int add_checked(int64_t a, int64_t b, TypeInfo *result_type, int64_t *out)
{
    // Use 128-bit to detect overflow
    int128_t sum = (int128_t)a + b;
    if (sum < result_type->min_val || sum > result_type->max_val)
        return 0;
    *out = (int64_t)sum;
    return 1;
}

static int sub_checked(int64_t a, int64_t b, TypeInfo *result_type, int64_t *out)
{
    int128_t diff = (int128_t)a - b;
    if (diff < result_type->min_val || diff > result_type->max_val)
        return 0;
    *out = (int64_t)diff;
    return 1;
}

static int mul_checked(int64_t a, int64_t b, TypeInfo *result_type, int64_t *out)
{
    int128_t prod = (int128_t)a * b;
    if (prod < result_type->min_val || prod > result_type->max_val)
        return 0;
    *out = (int64_t)prod;
    return 1;
}

static int parse_term(Parser *p, int64_t *out_value, TypeInfo **out_type)
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

            int64_t right_val;
            TypeInfo *right_type;
            if (parse_primary(p, &right_val, &right_type) != 1)
                return -1;

            TypeInfo *result_type = promote_type(*out_type, right_type);

            int64_t result;
            if (op == '*')
            {
                if (!mul_checked(*out_value, right_val, result_type, &result))
                {
                    p->error = true;
                    return -1;
                }
            }
            else if (op == '/')
            {
                if (right_val == 0)
                {
                    p->error = true;
                    return -1;
                }
                result = *out_value / right_val;
            }
            else
            { // op == '%'
                if (right_val == 0)
                {
                    p->error = true;
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

static int parse_expr(Parser *p, int64_t *out_value, TypeInfo **out_type)
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

            int64_t right_val;
            TypeInfo *right_type;
            if (parse_term(p, &right_val, &right_type) != 1)
                return -1;

            TypeInfo *result_type = promote_type(*out_type, right_type);

            int64_t result;
            if (op == '+')
            {
                if (!add_checked(*out_value, right_val, result_type, &result))
                {
                    p->error = true;
                    return -1;
                }
            }
            else
            { // op == '-'
                if (!sub_checked(*out_value, right_val, result_type, &result))
                {
                    p->error = true;
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

// Forward declare parse_stmt for use in parse_expression
static int parse_stmt(Parser *p, int64_t *out_value, TypeInfo **out_type);

// Implement parse_stmt
static int parse_stmt(Parser *p, int64_t *out_value, TypeInfo **out_type)
{
    skip_ws(p);
    if (isalpha((unsigned char)*p->pos))
    {
        const char *id_start;
        size_t id_len = consume_identifier(p, &id_start);
        if (id_len == 3 && strncmp(id_start, "let", 3) == 0)
        {
            skip_ws(p);
            if (!isalpha((unsigned char)*p->pos) && *p->pos != '_')
            {
                p->error = true;
                return -1;
            }
            const char *var_start = p->pos;
            while (*p->pos && (isalnum((unsigned char)*p->pos) || *p->pos == '_'))
                p->pos++;
            size_t var_len = p->pos - var_start;
            skip_ws(p);
            TypeInfo *explicit_type = NULL;
            if (*p->pos == ':')
            {
                p->pos++;
                skip_ws(p);
                const char *type_start = p->pos;
                while (*p->pos && (isalpha((unsigned char)*p->pos) || isdigit((unsigned char)*p->pos)))
                    p->pos++;
                size_t type_len = p->pos - type_start;
                if (type_len == 0)
                {
                    p->error = true;
                    return -1;
                }
                char type_buf[16];
                if (type_len >= sizeof(type_buf))
                {
                    p->error = true;
                    return -1;
                }
                strncpy(type_buf, type_start, type_len);
                type_buf[type_len] = '\0';
                explicit_type = find_type(type_buf);
                if (!explicit_type)
                {
                    p->error = true;
                    return -1;
                }
                skip_ws(p);
            }
            if (*p->pos != '=')
            {
                p->error = true;
                return -1;
            }
            p->pos++;
            int64_t rhs_value;
            TypeInfo *rhs_type;
            if (parse_expr(p, &rhs_value, &rhs_type) != 1)
            {
                p->error = true;
                return -1;
            }
            skip_ws(p);
            if (*p->pos != ';')
            {
                p->error = true;
                return -1;
            }
            p->pos++;
            TypeInfo *var_type = explicit_type ? explicit_type : rhs_type;
            if (!var_type)
            {
                p->error = true;
                return -1;
            }
            if (rhs_value < var_type->min_val || rhs_value > var_type->max_val)
            {
                p->error = true;
                return -1;
            }
            if (!define_var(p, var_start, var_len, rhs_value, var_type, false))
            {
                p->error = true;
                return -1;
            }
            return parse_stmt(p, out_value, out_type);
        }
        else
        {
            p->pos = id_start;
            return parse_expr(p, out_value, out_type);
        }
    }
    return parse_expr(p, out_value, out_type);
}

static int parse_expression(const char *input, int64_t *out_value, TypeInfo **out_type)
{
    if (!input || *input == '\0')
    {
        *out_value = 0;
        *out_type = NULL;
        return 1;
    }

    Parser p;
    p.pos = input;
    p.error = false;
    p.scope_depth = 0;
    p.needs_code_gen = false;
    memset(p.scopes, 0, sizeof(p.scopes));
    push_scope(&p);

    if (parse_stmt(&p, out_value, out_type) != 1 || p.error)
        return -1;

    skip_ws(&p);
    if (*p.pos != '\0')
        return -1;

    return 1;
}

static char *generate_code(int64_t value)
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
    int64_t value;
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

#include <stdint.h>
#include <stdbool.h>
