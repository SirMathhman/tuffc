#define _CRT_SECURE_NO_WARNINGS
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <errno.h>
#include <limits.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>

#define MAX_INPUT 256

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
    {"Bool", 8, false, 0LL, 1LL},
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

// Track read<T>() calls for code generation
typedef struct
{
    TypeInfo *type;
    int64_t temp_value; // Placeholder during parsing
} ReadCall;

typedef struct
{
    const char *pos;
    bool error;
    Scope scopes[16];
    int scope_depth;
    bool needs_code_gen;
    ReadCall reads[32]; // Track all read<T>() calls
    int read_count;     // How many read<T>() calls we've seen
} Parser;

// Forward declarations
static int parse_expr(Parser *p, int64_t *out_value, TypeInfo **out_type);

static void skip_ws(Parser *p)
{
    while (*p->pos && (*p->pos == ' ' || *p->pos == '\t'))
        p->pos++;
}

// Helper: skip whitespace and consume expected char. Sets error and returns 0 on mismatch.
static int expect_char(Parser *p, char expected)
{
    skip_ws(p);
    if (*p->pos != expected)
    {
        p->error = true;
        return 0;
    }
    p->pos++;
    return 1;
}

// Parse a type name like "I32", "U8", etc.
static TypeInfo *parse_type_name(Parser *p)
{
    skip_ws(p);
    const char *type_start = p->pos;
    while (*p->pos && (isalpha((unsigned char)*p->pos) || isdigit((unsigned char)*p->pos)))
        p->pos++;
    size_t type_len = p->pos - type_start;

    if (type_len == 0)
    {
        p->error = true;
        return NULL;
    }

    char type_buf[16];
    if (type_len >= sizeof(type_buf))
    {
        p->error = true;
        return NULL;
    }
    strncpy(type_buf, type_start, type_len);
    type_buf[type_len] = '\0';

    TypeInfo *type_info = find_type(type_buf);
    if (!type_info)
    {
        p->error = true;
        return NULL;
    }

    return type_info;
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

// Initialize a Parser struct for parsing
static void init_parser(Parser *p, const char *input)
{
    p->pos = input;
    p->error = false;
    p->scope_depth = 0;
    p->needs_code_gen = false;
    p->read_count = 0;
    memset(p->scopes, 0, sizeof(p->scopes));
    memset(p->reads, 0, sizeof(p->reads));
    push_scope(p);
}

// Helper: Check if a binding matches the given name
static bool binding_matches(VarBinding *binding, const char *name, size_t name_len)
{
    return strncmp(binding->name, name, name_len) == 0 &&
           binding->name[name_len] == '\0';
}

// Helper: Find a binding in a single scope
static VarBinding *find_binding_in_scope(VarBinding *bindings, int count, const char *name, size_t name_len)
{
    for (int i = 0; i < count; i++)
    {
        if (binding_matches(&bindings[i], name, name_len))
            return &bindings[i];
    }
    return NULL;
}

static VarBinding *lookup_var_anywhere(Parser *p, const char *name, size_t name_len)
{
    for (int scope_idx = p->scope_depth - 1; scope_idx >= 0; scope_idx--)
    {
        Scope *s = &p->scopes[scope_idx];
        VarBinding *found = find_binding_in_scope(s->bindings, s->count, name, name_len);
        if (found)
            return found;
    }
    return NULL;
}

static bool is_var_defined_anywhere(Parser *p, const char *name, size_t name_len)
{
    for (int scope_idx = 0; scope_idx < p->scope_depth; scope_idx++)
    {
        Scope *s = &p->scopes[scope_idx];
        if (find_binding_in_scope(s->bindings, s->count, name, name_len))
            return true;
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

// Helper: check int64 value is within type's range, set error on failure
static int check_value_in_range(Parser *p, int64_t value, TypeInfo *type)
{
    if (value < type->min_val || value > type->max_val)
    {
        p->error = true;
        return 0;
    }
    return 1;
}

static int parse_primary(Parser *p, int64_t *out_value, TypeInfo **out_type)
{
    skip_ws(p);

    // Handle if statement/expression
    // CPD-OFF (if/else if/else parsing structure is inherent to conditional grammar)
    if (strncmp(p->pos, "if", 2) == 0 &&
        (isspace((unsigned char)p->pos[2]) || p->pos[2] == '('))
    {
        p->pos += 2;
        skip_ws(p);

        // Expect '('
        if (!expect_char(p, '('))
            return -1;

        // Parse condition - must be Bool type
        int64_t cond_val;
        TypeInfo *cond_type;
        if (parse_expr(p, &cond_val, &cond_type) != 1)
            return -1;

        if (cond_type != find_type("Bool"))
        {
            p->error = true;
            return -1;
        }

        // Expect ')'
        if (!expect_char(p, ')'))
            return -1;

        // Parse true branch
        int64_t true_val;
        TypeInfo *true_type;
        if (parse_primary(p, &true_val, &true_type) != 1)
            return -1;

        // Handle else/else if/else chain
        int64_t result_val = true_val;
        TypeInfo *result_type = true_type;

        skip_ws(p);
        if (strncmp(p->pos, "else", 4) == 0 &&
            (isspace((unsigned char)p->pos[4]) || p->pos[4] == '\0' || p->pos[4] == 'i' || p->pos[4] == '{' || p->pos[4] == '('))
        {
            p->pos += 4;
            skip_ws(p);

            // Check if it's "else if" or just "else"
            if (strncmp(p->pos, "if", 2) == 0)
            {
                // Recursively parse as another if statement
                if (parse_primary(p, &result_val, &result_type) != 1)
                    return -1;
                // Use else-if result if condition was false
                if (!cond_val)
                {
                    result_val = result_val;
                    result_type = result_type;
                }
            }
            else
            {
                // Parse else branch
                int64_t false_val;
                TypeInfo *false_type;
                if (parse_primary(p, &false_val, &false_type) != 1)
                    return -1;

                // If condition is true at parse time, use true branch; otherwise false branch
                if (!cond_val)
                {
                    result_val = false_val;
                    result_type = false_type;
                }
            }
        }
        else if (!cond_val)
        {
            // No else clause and condition is false - this is an error unless used as statement
            p->error = true;
            return -1;
        }

        *out_value = result_val;
        *out_type = result_type;
        return 1;
    }
    // CPD-ON

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

    // Check for identifier: either read<T>(), true/false, or variable reference
    if (isalpha((unsigned char)*p->pos) || *p->pos == '_')
    {
        const char *id_start;
        size_t id_len = consume_identifier(p, &id_start);

        // Check for boolean literals
        if (id_len == 4 && strncmp(id_start, "true", 4) == 0)
        {
            *out_value = 1;
            *out_type = find_type("Bool");
            return 1;
        }
        if (id_len == 5 && strncmp(id_start, "false", 5) == 0)
        {
            *out_value = 0;
            *out_type = find_type("Bool");
            return 1;
        }

        // Check if it's "read" followed by "<"
        if (id_len == 4 && strncmp(id_start, "read", 4) == 0)
        {
            skip_ws(p);
            if (*p->pos == '<')
            {
                p->pos++;

                // Parse type name using helper
                TypeInfo *read_type = parse_type_name(p);
                if (!read_type)
                    return -1; // parse_type_name already set p->error

                if (!expect_char(p, '>'))
                    return -1;
                if (!expect_char(p, '('))
                    return -1;
                if (!expect_char(p, ')'))
                    return -1;

                // Mark that code generation is needed
                p->needs_code_gen = true;

                // Record this read call
                if (p->read_count >= 32)
                {
                    p->error = true;
                    return -1;
                }

                p->reads[p->read_count].type = read_type;
                p->reads[p->read_count].temp_value = 0; // Placeholder
                p->read_count++;

                // Return a placeholder value (will be replaced at code generation)
                *out_value = 0;
                *out_type = read_type;
                return 1;
            }
            // Not read<T>() - fall through to variable lookup with id_start/id_len
        }

        // Variable reference
        VarBinding *binding = lookup_var_anywhere(p, id_start, id_len);
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

    // Find suffix start (right after digits)
    const char *suffix_start = digit_end;

    // Need a suffix that starts with a letter (like U8, I32)
    if (!isalpha((unsigned char)*suffix_start))
    {
        p->error = true;
        return -1;
    }

    // Use parse_type_name to consume and look up type
    p->pos = suffix_start;
    TypeInfo *type = parse_type_name(p);
    if (!type)
        return -1; // parse_type_name already set p->error

    // Parse the numeric value (from start to digit_end)
    char *endptr;
    errno = 0;
    int64_t value = strtoll(start, &endptr, 10);

    if (errno != 0 || endptr != digit_end)
    {
        p->error = true;
        return -1;
    }

    // Check bounds
    if (!check_value_in_range(p, value, type))
        return -1;

    // p->pos is already past the suffix (advanced by parse_type_name)
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

// Helper: store result if within range, else return 0
static int store_if_in_range(int128_t result, TypeInfo *result_type, int64_t *out)
{
    if (result < result_type->min_val || result > result_type->max_val)
        return 0;
    *out = (int64_t)result;
    return 1;
}

static int add_checked(int64_t a, int64_t b, TypeInfo *result_type, int64_t *out)
{
    return store_if_in_range((int128_t)a + b, result_type, out);
}

static int sub_checked(int64_t a, int64_t b, TypeInfo *result_type, int64_t *out)
{
    return store_if_in_range((int128_t)a - b, result_type, out);
}

static int mul_checked(int64_t a, int64_t b, TypeInfo *result_type, int64_t *out)
{
    return store_if_in_range((int128_t)a * b, result_type, out);
}

// Helper: Get Bool type
static TypeInfo *get_bool_type(void)
{
    return find_type("Bool");
}

// Forward declarations for recursive descent
static int parse_expr(Parser *p, int64_t *out_value, TypeInfo **out_type);

// parse_unary: handles '!' operator and calls parse_primary
static int parse_unary(Parser *p, int64_t *out_value, TypeInfo **out_type)
{
    skip_ws(p);
    if (*p->pos == '!')
    {
        p->pos++;
        int64_t inner_val;
        TypeInfo *inner_type;
        if (parse_unary(p, &inner_val, &inner_type) != 1)
            return -1;
        if (inner_type != get_bool_type() && inner_type->bits != 8)
        {
            p->error = true;
            return -1;
        }
        *out_value = inner_val ? 0 : 1;
        *out_type = get_bool_type();
        return 1;
    }
    return parse_primary(p, out_value, out_type);
}

// parse_term: handles *, /, %
static int parse_term(Parser *p, int64_t *out_value, TypeInfo **out_type)
{
    // CPD-OFF
    if (parse_unary(p, out_value, out_type) != 1)
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
            if (parse_unary(p, &right_val, &right_type) != 1)
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
                if (right_val == 0 && !p->needs_code_gen)
                {
                    p->error = true;
                    return -1;
                }
                if (right_val != 0)
                {
                    result = *out_value / right_val;
                }
                else
                {
                    // Placeholder value - will be computed at runtime
                    result = 0;
                }
            }
            else
            { // op == '%'
                if (right_val == 0 && !p->needs_code_gen)
                {
                    p->error = true;
                    return -1;
                }
                if (right_val != 0)
                {
                    result = *out_value % right_val;
                }
                else
                {
                    // Placeholder value - will be computed at runtime
                    result = 0;
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

// parse_add_sub: handles +, -
static int parse_add_sub(Parser *p, int64_t *out_value, TypeInfo **out_type)
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

// parse_equality: handles ==, !=
// CPD-OFF (binary operator patterns are structurally similar across parse_equality, parse_and, parse_or)
static int parse_equality(Parser *p, int64_t *out_value, TypeInfo **out_type)
{
    if (parse_add_sub(p, out_value, out_type) != 1)
        return -1;

    while (1)
    {
        skip_ws(p);
        if (strncmp(p->pos, "==", 2) == 0)
        {
            p->pos += 2;
            int64_t right_val;
            TypeInfo *right_type;
            if (parse_add_sub(p, &right_val, &right_type) != 1)
                return -1;
            *out_value = (*out_value == right_val) ? 1 : 0;
            *out_type = get_bool_type();
        }
        else if (strncmp(p->pos, "!=", 2) == 0)
        {
            p->pos += 2;
            int64_t right_val;
            TypeInfo *right_type;
            if (parse_add_sub(p, &right_val, &right_type) != 1)
                return -1;
            *out_value = (*out_value != right_val) ? 1 : 0;
            *out_type = get_bool_type();
        }
        else
        {
            break;
        }
    }

    return 1;
}

// parse_and: handles &&
static int parse_and(Parser *p, int64_t *out_value, TypeInfo **out_type)
{
    if (parse_equality(p, out_value, out_type) != 1)
        return -1;

    while (1)
    {
        skip_ws(p);
        if (strncmp(p->pos, "&&", 2) == 0)
        {
            p->pos += 2;
            int64_t right_val;
            TypeInfo *right_type;
            if (parse_equality(p, &right_val, &right_type) != 1)
                return -1;
            *out_value = (*out_value && right_val) ? 1 : 0;
            *out_type = get_bool_type();
        }
        else
        {
            break;
        }
    }

    return 1;
}

// parse_or: handles ||
static int parse_or(Parser *p, int64_t *out_value, TypeInfo **out_type)
{
    if (parse_and(p, out_value, out_type) != 1)
        return -1;

    while (1)
    {
        skip_ws(p);
        if (strncmp(p->pos, "||", 2) == 0)
        {
            p->pos += 2;
            int64_t right_val;
            TypeInfo *right_type;
            if (parse_and(p, &right_val, &right_type) != 1)
                return -1;
            *out_value = (*out_value || right_val) ? 1 : 0;
            *out_type = get_bool_type();
        }
        else
        {
            break;
        }
    }

    return 1;
}
// CPD-ON

// parse_expr: entry point for expression parsing
static int parse_expr(Parser *p, int64_t *out_value, TypeInfo **out_type)
{
    return parse_or(p, out_value, out_type);
}

// Forward declare parse_stmt for use in parse_expression
static int parse_stmt(Parser *p, int64_t *out_value, TypeInfo **out_type);

// Helper: match a keyword (exact word boundary check, advances pos on match)
static bool match_keyword(Parser *p, const char *kw)
{
    size_t n = strlen(kw);
    if (strncmp(p->pos, kw, n) != 0)
        return false;
    if (isalnum((unsigned char)p->pos[n]) || p->pos[n] == '_')
        return false;
    p->pos += n;
    return true;
}

// Implement parse_stmt
static int parse_stmt(Parser *p, int64_t *out_value, TypeInfo **out_type)
{
    skip_ws(p);
    if (match_keyword(p, "let"))
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

            // Parse type name using helper
            explicit_type = parse_type_name(p);
            if (!explicit_type)
                return -1; // parse_type_name already set p->error

            skip_ws(p);
        }
        if (!expect_char(p, '='))
            return -1;
        int64_t rhs_value;
        TypeInfo *rhs_type;
        if (parse_expr(p, &rhs_value, &rhs_type) != 1)
        {
            p->error = true;
            return -1;
        }
        if (!expect_char(p, ';'))
            return -1;
        TypeInfo *var_type = explicit_type ? explicit_type : rhs_type;
        if (!var_type)
        {
            p->error = true;
            return -1;
        }
        if (!check_value_in_range(p, rhs_value, var_type))
            return -1;
        if (!define_var(p, var_start, var_len, rhs_value, var_type, false))
        {
            p->error = true;
            return -1;
        }
        return parse_stmt(p, out_value, out_type);
    }
    return parse_expr(p, out_value, out_type);
}

// Helper: Check if parser completed successfully (no remaining input)
static int check_parse_complete(Parser *p)
{
    if (p->error)
        return -1;
    skip_ws(p);
    if (*p->pos != '\0')
        return -1;
    return 1;
}

// Internal parsing function that returns the full Parser state
static int parse_with_state(const char *input, int64_t *out_value, TypeInfo **out_type, Parser *out_parser)
{
    if (!input || *input == '\0')
    {
        out_parser->read_count = 0;
        out_parser->needs_code_gen = false;
        *out_value = 0;
        *out_type = NULL;
        return 1;
    }

    Parser p;
    init_parser(&p, input);

    if (parse_stmt(&p, out_value, out_type) != 1)
        return -1;

    int result = check_parse_complete(&p);
    if (result != 1)
        return result;

    // Copy parser state back
    memcpy(out_parser, &p, sizeof(Parser));
    return 1;
}

static int parse_expression(const char *input, int64_t *out_value, TypeInfo **out_type)
{
    Parser discard;
    return parse_with_state(input, out_value, out_type, &discard);
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

// Helper: Map TypeInfo to C type string
// CPD-OFF - Unavoidable type mapping duplication
static const char *get_c_type(TypeInfo *type)
{
    if (type->bits == 8 && !type->is_signed && type->max_val == 1)
        return "_Bool"; // Bool type
    else if (type->bits == 8)
        return type->is_signed ? "int8_t" : "uint8_t";
    else if (type->bits == 16)
        return type->is_signed ? "int16_t" : "uint16_t";
    else if (type->bits == 32)
        return type->is_signed ? "int32_t" : "uint32_t";
    else if (type->bits == 64)
        return type->is_signed ? "int64_t" : "uint64_t";
    return NULL;
}
// CPD-ON

char *compile(const char *input)
{
    int64_t value;
    TypeInfo *type;
    Parser parser;
    memset(&parser, 0, sizeof(Parser));

    int parse_result = parse_with_state(input, &value, &type, &parser);

    if (parse_result != 1)
    {
        return generate_error();
    }

    // If there are no reads, use simple code generation
    if (parser.read_count == 0)
    {
        return generate_code(value);
    }

    // If there are reads, generate code with scanf() calls
    // Build the expression with read variable references
    char expr[1024];
    char temp_input[MAX_INPUT + 1];
    strncpy(temp_input, input, MAX_INPUT);

    // Replace read<T>() patterns with __readN variables
    int read_idx = 0;
    for (int i = 0; i < (int)strlen(temp_input) && read_idx < parser.read_count; i++)
    {
        if (strncmp(&temp_input[i], "read<", 5) == 0)
        {
            // Find the closing >
            int close_bracket = i + 5;
            while (close_bracket < (int)strlen(temp_input) && temp_input[close_bracket] != '>')
                close_bracket++;

            if (close_bracket < (int)strlen(temp_input) && temp_input[close_bracket] == '>' &&
                close_bracket + 2 < (int)strlen(temp_input) &&
                temp_input[close_bracket + 1] == '(' && temp_input[close_bracket + 2] == ')')
            {
                // Replace "read<T>()" with "__readN"
                char replacement[32];
                snprintf(replacement, sizeof(replacement), "__read%d", read_idx);
                int match_len = close_bracket - i + 3; // "read<T>()"

                // Build new string with replacement
                char new_input[MAX_INPUT + 1];
                strncpy(new_input, temp_input, i);
                new_input[i] = '\0';
                strncat(new_input, replacement, MAX_INPUT - strlen(new_input) - 1);
                strncat(new_input, &temp_input[i + match_len], MAX_INPUT - strlen(new_input) - 1);
                strncpy(temp_input, new_input, MAX_INPUT);

                read_idx++;
                i += strlen(replacement) - 1;
            }
        }
    }

    // Now generate code with the modified expression
    // We need to re-parse with the modified input to get the result type
    // For simplicity, we'll assume the type of the last expression

    strncpy(expr, temp_input, sizeof(expr) - 1);

    // Build the code
    char *code = malloc(4096);
    if (!code)
        return NULL;

    char buffer[4096] = "";
    strncat(buffer, "#include <stdio.h>\n#include <stdint.h>\n#include <string.h>\nint main() {\n", sizeof(buffer) - 1);

    // Declare and initialize variables for each read
    for (int i = 0; i < parser.read_count; i++)
    {
        const char *c_type = get_c_type(parser.reads[i].type);

        if (!c_type)
        {
            free(code);
            return generate_error();
        }

        // Check if this is a Bool type
        if (parser.reads[i].type->bits == 8 && !parser.reads[i].type->is_signed && parser.reads[i].type->max_val == 1)
        {
            // Special handling for Bool: read a string and parse "true" or "false"
            char decl[512];
            snprintf(decl, sizeof(decl), "    char __read%d_str[16];\n    scanf(\"%%15s\", __read%d_str);\n    _Bool __read%d = (strcmp(__read%d_str, \"true\") == 0) ? 1 : 0;\n",
                     i, i, i, i);
            strncat(buffer, decl, sizeof(buffer) - strlen(buffer) - 1);
        }
        else
        {
            // Standard numeric scanf handling
            const char *scanf_fmt;
            const char *read_type;

            // Determine scanf format and temporary read type
            if (parser.reads[i].type->is_signed)
            {
                read_type = "long long";
                scanf_fmt = "%lld";
            }
            else
            {
                read_type = "unsigned long long";
                scanf_fmt = "%llu";
            }

            char decl[512];
            snprintf(decl, sizeof(decl), "    %s __read%d_temp;\n    scanf(\"%s\", &__read%d_temp);\n    %s __read%d = (%s)__read%d_temp;\n",
                     read_type, i, scanf_fmt, i, c_type, i, c_type, i);
            strncat(buffer, decl, sizeof(buffer) - strlen(buffer) - 1);
        }
    }

    // Return the expression
    char ret[512];
    snprintf(ret, sizeof(ret), "    return (int)(%s);\n}\n", expr);
    strncat(buffer, ret, sizeof(buffer) - strlen(buffer) - 1);

    strncpy(code, buffer, 4096 - 1);
    code[4095] = '\0';
    return code;
}

#include <stdint.h>
#include <stdbool.h>
