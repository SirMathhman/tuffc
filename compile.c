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

// Track variable definitions for code generation
typedef struct
{
    char name[64];
    TypeInfo *type;
    int64_t init_value;
} VarDef;

// Track variable updates (compound assignments) for code generation
typedef struct
{
    char name[64];
    char op;           // '+', '-', '*', '/', '%'
    int read_idx;      // Index into reads[], or -1 if no read
    int64_t rhs_value; // Value if no read
} VarUpdate;

// Track match expressions for code generation
typedef struct
{
    int read_idx; // Index of the match value read, or -1 if not a read
    // Case arms stored as string pairs for now (simplified approach)
    char case_values[32][32]; // Pattern values as strings
    int64_t case_results[32]; // Result values for each case
    int case_count;
    int catchall_result; // -1 if no catch-all, otherwise the result value
    bool has_catchall;
} MatchExpr;

// Track while loop expressions for code generation
typedef struct
{
    char condition_text[256]; // Raw source text of the condition
    TypeInfo *condition_type;
    int read_idx;            // Index of a read in the condition, or -1 if no read
    int body_update_start;   // First var_update index inside the loop body
    int body_update_end;     // One-past-last var_update index inside the loop body
} WhileLoop;

// Struct field definition
typedef struct
{
    char name[64];    // Field name
    char type[64];    // Type name (may be a struct type)
    bool is_mutable;  // Field is mutable
} StructField;

// Struct type definition
typedef struct
{
    char name[64];              // Struct type name
    StructField fields[32];     // Fields in this struct
    int field_count;            // Number of fields
} StructDef;

typedef struct
{
    const char *pos;
    bool error;
    Scope scopes[16];
    int scope_depth;
    bool needs_code_gen;
    ReadCall reads[32];        // Track all read<T>() calls
    int read_count;            // How many read<T>() calls we've seen
    VarDef var_defs[64];       // Track variable definitions
    int var_def_count;         // How many variables defined
    VarUpdate var_updates[64]; // Track compound assignments
    int var_update_count;      // How many compound assignments
    MatchExpr match_exprs[8];  // Track match expressions needing code gen
    int match_count;           // How many match expressions
    WhileLoop while_loops[4];  // Track while loops needing code gen
    int while_count;           // How many while loops
    StructDef struct_defs[16]; // Track struct definitions
    int struct_count;          // Number of struct definitions
} Parser;

// Forward declarations
static int parse_expr(Parser *p, int64_t *out_value, TypeInfo **out_type);
static int parse_stmt(Parser *p, int64_t *out_value, TypeInfo **out_type);
static int add_checked(int64_t a, int64_t b, TypeInfo *result_type, int64_t *out);
static int sub_checked(int64_t a, int64_t b, TypeInfo *result_type, int64_t *out);
static int mul_checked(int64_t a, int64_t b, TypeInfo *result_type, int64_t *out);
static bool match_keyword(Parser *p, const char *kw);

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
    p->var_def_count = 0;
    p->var_update_count = 0;
    p->match_count = 0;
    p->while_count = 0;
    p->struct_count = 0;
    // CPD-OFF
    memset(p->scopes, 0, sizeof(p->scopes));
    memset(p->reads, 0, sizeof(p->reads));
    memset(p->var_defs, 0, sizeof(p->var_defs));
    memset(p->var_updates, 0, sizeof(p->var_updates));
    memset(p->match_exprs, 0, sizeof(p->match_exprs));
    memset(p->while_loops, 0, sizeof(p->while_loops));
    memset(p->struct_defs, 0, sizeof(p->struct_defs));
    // CPD-ON
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

// Helper: Find a struct definition by name
static StructDef *lookup_struct(Parser *p, const char *name, size_t name_len)
{
    for (int i = 0; i < p->struct_count; i++)
    {
        if (strncmp(p->struct_defs[i].name, name, name_len) == 0 &&
            p->struct_defs[i].name[name_len] == '\0')
            return &p->struct_defs[i];
    }
    return NULL;
}

// Helper: Check if a struct type is defined
static bool is_struct_type(Parser *p, const char *name, size_t name_len)
{
    return lookup_struct(p, name, name_len) != NULL;
}

// CPD-OFF - Necessary pattern for variable tracking
// Helper: Track a variable definition for code generation
static void track_var_def(Parser *p, const char *name, size_t name_len, TypeInfo *type, int64_t value)
{
    if (p->var_def_count < 64)
    {
        VarDef *vardef = &p->var_defs[p->var_def_count];
        strncpy(vardef->name, name, name_len);
        vardef->name[name_len] = '\0';
        vardef->type = type;
        vardef->init_value = value;
        p->var_def_count++;
    }
}
// CPD-ON

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

    // Track variable definition for code generation
    track_var_def(p, name, name_len, type, value);

    return true;
}

// Helper: Update a mutable variable's value
static bool update_var(Parser *p, const char *name, size_t name_len, int64_t new_value)
{
    VarBinding *binding = lookup_var_anywhere(p, name, name_len);
    if (!binding)
        return false;
    if (!binding->is_mutable)
        return false;
    binding->value = new_value;
    return true;
}

// Helper: Perform arithmetic operation (op: +, -, *, /, %)
// Returns true on success, sets p->error on failure
static bool perform_op(Parser *p, char op, int64_t left, int64_t right, TypeInfo *type, int64_t *out_result)
{
    switch (op)
    {
    case '+':
        return add_checked(left, right, type, out_result);
    case '-':
        return sub_checked(left, right, type, out_result);
    case '*':
        return mul_checked(left, right, type, out_result);
    case '/':
        if (right == 0)
        {
            p->error = true;
            return false;
        }
        *out_result = left / right;
        return true;
    case '%':
        if (right == 0)
        {
            p->error = true;
            return false;
        }
        *out_result = left % right;
        return true;
    default:
        p->error = true;
        return false;
    }
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

    // CPD-OFF
    // Handle match expression
    if (strncmp(p->pos, "match", 5) == 0 &&
        (isspace((unsigned char)p->pos[5]) || p->pos[5] == '('))
    {
        p->pos += 5;
        skip_ws(p);

        // Expect '('
        if (!expect_char(p, '('))
            return -1;

        // Parse the match expression (the value being matched against)
        int64_t match_val;
        TypeInfo *match_type;
        if (parse_expr(p, &match_val, &match_type) != 1)
            return -1;

        // Expect ')'
        if (!expect_char(p, ')'))
            return -1;

        // Expect '{'
        if (!expect_char(p, '{'))
            return -1;

        // Collect case arms
        typedef struct
        {
            int64_t pattern_val; // -1 for catch-all (_), regular value for literal patterns
            bool is_catchall;
            int64_t result_val;
            TypeInfo *result_type;
        } CaseArm;

        CaseArm cases[32];
        int case_count = 0;
        bool has_catchall = false;
        int catchall_idx = -1;

        skip_ws(p);
        while (case_count < 32 && *p->pos != '}')
        {
            // Expect "case" keyword
            if (!match_keyword(p, "case"))
            {
                p->error = true;
                return -1;
            }
            skip_ws(p);

            // Parse pattern: either "_" (catch-all) or a literal value
            int64_t pattern_val = 0;
            bool is_catchall = false;

            if (*p->pos == '_' && (isspace((unsigned char)p->pos[1]) || p->pos[1] == '='))
            {
                // Catch-all pattern
                if (has_catchall)
                {
                    p->error = true; // Multiple catch-all patterns
                    return -1;
                }
                is_catchall = true;
                has_catchall = true;
                catchall_idx = case_count;
                p->pos++;
            }
            else
            {
                // CPD-OFF
                // Parse a literal pattern (number with optional type suffix)
                const char *lit_start = p->pos;

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

                // Check what comes after digits
                const char *suffix_start = digit_end;
                TypeInfo *pattern_type = NULL;

                // If there's a type suffix, parse it
                if (isalpha((unsigned char)*suffix_start))
                {
                    p->pos = suffix_start;
                    pattern_type = parse_type_name(p);
                    if (!pattern_type)
                        return -1;
                    suffix_start = p->pos; // Update to position after type name
                }
                else
                {
                    // No type suffix - use the match expression's type
                    pattern_type = match_type;
                    p->pos = digit_end; // Move position to after digits
                }

                // Parse the numeric value
                char *endptr;
                errno = 0;
                pattern_val = strtoll(lit_start, &endptr, 10);

                if (errno != 0 || endptr != digit_end)
                {
                    p->error = true;
                    return -1;
                }

                // Check bounds
                if (!check_value_in_range(p, pattern_val, pattern_type))
                    return -1;
                // CPD-ON
            }

            skip_ws(p);

            // Expect "=>"
            if (strncmp(p->pos, "=>", 2) != 0)
            {
                p->error = true;
                return -1;
            }
            p->pos += 2;
            skip_ws(p);

            // CPD-OFF
            // Parse result expression for this case
            int64_t result_val;
            TypeInfo *result_type;
            if (parse_expr(p, &result_val, &result_type) != 1)
                return -1;

            // Expect ";"
            if (!expect_char(p, ';'))
                return -1;
            // CPD-ON

            // Save case arm
            cases[case_count].pattern_val = pattern_val;
            cases[case_count].is_catchall = is_catchall;
            cases[case_count].result_val = result_val;
            cases[case_count].result_type = result_type;
            case_count++;

            skip_ws(p);
        }

        // Expect '}'
        if (!expect_char(p, '}'))
            return -1;

        // Find the matching case
        int matched_idx = -1;

        for (int i = 0; i < case_count; i++)
        {
            if (cases[i].is_catchall)
            {
                continue; // Check catch-all later
            }
            if (cases[i].pattern_val == match_val)
            {
                matched_idx = i;
                break;
            }
        }

        // If no match and we have catch-all, use it
        if (matched_idx < 0 && catchall_idx >= 0)
        {
            matched_idx = catchall_idx;
        }

        // If still no match, it's an error
        if (matched_idx < 0)
        {
            p->error = true;
            return -1;
        }

        // Return the matched case's result
        *out_value = cases[matched_idx].result_val;
        *out_type = cases[matched_idx].result_type;
        return 1;
    }

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
        // Parse statements within block (not just expressions)
        int stmt_result = parse_stmt(p, out_value, out_type);
        if (stmt_result != 1)
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

        // Variable reference or struct instantiation
        VarBinding *binding = lookup_var_anywhere(p, id_start, id_len);
        
        // Check if it's a struct instantiation (next non-ws char is '{')
        skip_ws(p);
        if (*p->pos == '{' && is_struct_type(p, id_start, id_len))
        {
            // Struct instantiation
            StructDef *struct_def = lookup_struct(p, id_start, id_len);
            if (!struct_def)
            {
                p->error = true;
                return -1;
            }
            
            p->pos++; // consume '{'
            
            // For now, we just collect field values but don't validate match
            // Return 0 as placeholder value
            skip_ws(p);
            // CPD-OFF
            while (*p->pos && *p->pos != '}')
            {
                skip_ws(p);
                
                // Parse field name
                if (!isalpha((unsigned char)*p->pos) && *p->pos != '_')
                {
                    p->error = true;
                    return -1;
                }
                
                const char *field_start = p->pos;
                while (*p->pos && (isalnum((unsigned char)*p->pos) || *p->pos == '_'))
                    p->pos++;
                
                skip_ws(p);
                if (!expect_char(p, ':'))
                    return -1;
                
                // Parse field value expression
                int64_t field_val;
                TypeInfo *field_type;
                if (parse_expr(p, &field_val, &field_type) != 1)
                    return -1;
                
                skip_ws(p);
                if (*p->pos == ',')
                {
                    p->pos++;
                }
            }
            // CPD-ON
            
            if (!expect_char(p, '}'))
                return -1;
            
            // Struct instantiation returns placeholder value
            // The actual value is determined at code generation
            // For field access, we'll need to track which field is being accessed
            *out_value = 0;
            *out_type = find_type("I32");
            return 1;
        }
        
        // Regular variable reference
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
    // CPD-OFF
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

    // Check if there's a type suffix (like U8, I32)
    // If no suffix (or suffix doesn't start with letter), default to I32
    TypeInfo *type;
    if (!isalpha((unsigned char)*suffix_start))
    {
        // No suffix - default to I32
        type = find_type("I32");
    }
    else
    {
        // Use parse_type_name to consume and look up type
        p->pos = suffix_start;
        type = parse_type_name(p);
        if (!type)
            return -1; // parse_type_name already set p->error
    }

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

    // CPD-ON
    // Advance p->pos to the end of the parsed number
    // (parse_type_name already did this if there was a suffix; if no suffix, do it now)
    if (!isalpha((unsigned char)*suffix_start))
    {
        p->pos = digit_end;
    }
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

// Helper: Try to match a compound assignment operator (+=, -=, etc.)
// Returns the operator char (+, -, *, /, %) or '\0' if not matched
// Advances p->pos if matched
// CPD-OFF - Unavoidable repetition due to explicit operator checking
static char match_compound_op(Parser *p)
{
    if (strncmp(p->pos, "+=", 2) == 0)
    {
        p->pos += 2;
        return '+';
    }
    if (strncmp(p->pos, "-=", 2) == 0)
    {
        p->pos += 2;
        return '-';
    }
    if (strncmp(p->pos, "*=", 2) == 0)
    {
        p->pos += 2;
        return '*';
    }
    if (strncmp(p->pos, "/=", 2) == 0)
    {
        p->pos += 2;
        return '/';
    }
    if (strncmp(p->pos, "%=", 2) == 0)
    {
        p->pos += 2;
        return '%';
    }
    return '\0';
}
// CPD-ON

// Implement parse_stmt
static int parse_stmt(Parser *p, int64_t *out_value, TypeInfo **out_type)
{
    skip_ws(p);
    
    // Handle struct definition: struct Name { field : Type; ... }
    if (match_keyword(p, "struct"))
    {
        skip_ws(p);
        
        const char *struct_name_start;
        size_t struct_name_len = consume_identifier(p, &struct_name_start);
        if (struct_name_len == 0)
        {
            p->error = true;
            return -1;
        }
        
        // Check for duplicate struct definition
        if (is_struct_type(p, struct_name_start, struct_name_len))
        {
            p->error = true;
            return -1;
        }
        
        skip_ws(p);
        if (!expect_char(p, '{'))
            return -1;
        
        // Add struct definition
        if (p->struct_count >= 16)
        {
            p->error = true;
            return -1;
        }
        
        StructDef *struct_def = &p->struct_defs[p->struct_count];
        strncpy(struct_def->name, struct_name_start, struct_name_len);
        struct_def->name[struct_name_len] = '\0';
        struct_def->field_count = 0;
        
        // CPD-OFF
        // Parse fields inside the struct
        while (*p->pos && *p->pos != '}')
        {
            skip_ws(p);
            if (*p->pos == '}')
                break;
            
            // Check for "mut" keyword on field
            bool field_is_mutable = false;
            if (match_keyword(p, "mut"))
            {
                field_is_mutable = true;
                skip_ws(p);
            }
            
            // Parse field name
            const char *field_name_start;
            size_t field_name_len = consume_identifier(p, &field_name_start);
            if (field_name_len == 0)
            {
                p->error = true;
                return -1;
            }
            
            skip_ws(p);
            if (!expect_char(p, ':'))
                return -1;
            
            skip_ws(p);
            
            // Parse field type
            const char *type_start = p->pos;
            while (*p->pos && (isalnum((unsigned char)*p->pos) || *p->pos == '_'))
                p->pos++;
            size_t type_len = p->pos - type_start;
            
            if (type_len == 0)
            {
                p->error = true;
                return -1;
            }
            
            skip_ws(p);
            if (!expect_char(p, ';'))
                return -1;
            
            // Add field to struct
            if (struct_def->field_count >= 32)
            {
                p->error = true;
                return -1;
            }
            
            StructField *field = &struct_def->fields[struct_def->field_count];
            strncpy(field->name, field_name_start, field_name_len);
            field->name[field_name_len] = '\0';
            strncpy(field->type, type_start, type_len);
            field->type[type_len] = '\0';
            field->is_mutable = field_is_mutable;
            struct_def->field_count++;
        }
        // CPD-ON
        
        if (!expect_char(p, '}'))
            return -1;
        
        p->struct_count++;
        
        // After struct definition, continue parsing the rest
        // Could be more statements, or an expression
        skip_ws(p);
        return parse_stmt(p, out_value, out_type);
    }
    
    if (match_keyword(p, "let"))
    {
        skip_ws(p);

        // Check for "mut" keyword
        bool is_mutable = false;
        if (match_keyword(p, "mut"))
        {
            is_mutable = true;
            skip_ws(p);
        }

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
        if (!define_var(p, var_start, var_len, rhs_value, var_type, is_mutable))
        {
            p->error = true;
            return -1;
        }
        return parse_stmt(p, out_value, out_type);
    }

    // Handle while loop as a statement so that trailing "; expr" parses correctly
    if (strncmp(p->pos, "while", 5) == 0 &&
        (isspace((unsigned char)p->pos[5]) || p->pos[5] == '('))
    {
        p->pos += 5;
        skip_ws(p);

        if (!expect_char(p, '('))
            return -1;

        skip_ws(p);
        const char *cond_start = p->pos;

        int64_t cond_val;
        TypeInfo *cond_type;
        if (parse_expr(p, &cond_val, &cond_type) != 1)
            return -1;

        const char *cond_end = p->pos;

        if (cond_type != find_type("Bool"))
        {
            p->error = true;
            return -1;
        }

        if (!expect_char(p, ')'))
            return -1;

        p->needs_code_gen = true;
        int pre_body_updates = p->var_update_count;

        int64_t body_val;
        TypeInfo *body_type;
        if (parse_primary(p, &body_val, &body_type) != 1)
            return -1;

        if (p->while_count < 4)
        {
            WhileLoop *wl = &p->while_loops[p->while_count];
            size_t cond_len = (size_t)(cond_end - cond_start);
            if (cond_len >= sizeof(wl->condition_text))
                cond_len = sizeof(wl->condition_text) - 1;
            strncpy(wl->condition_text, cond_start, cond_len);
            wl->condition_text[cond_len] = '\0';
            wl->read_idx = (p->read_count > 0) ? (p->read_count - 1) : -1;
            wl->condition_type = cond_type;
            wl->body_update_start = pre_body_updates;
            wl->body_update_end = p->var_update_count;
            p->while_count++;
        }

        // Consume optional trailing ';' then parse the rest as the return value
        skip_ws(p);
        if (*p->pos == ';')
            p->pos++;

        return parse_stmt(p, out_value, out_type);
    }

    // Check for compound assignment (+=, -=, *=, /=, %=)
    if (isalpha((unsigned char)*p->pos) || *p->pos == '_')
    {
        const char *id_start = p->pos;
        size_t id_len = consume_identifier(p, &id_start);
        skip_ws(p);

        // Check for compound assignment operator
        char op = match_compound_op(p);

        if (op != '\0')
        {
            // Look up variable
            VarBinding *binding = lookup_var_anywhere(p, id_start, id_len);
            if (!binding)
            {
                p->error = true;
                return -1;
            }
            if (!binding->is_mutable)
            {
                p->error = true;
                return -1;
            }

            skip_ws(p);

            // Parse right-hand side
            int64_t rhs_value;
            TypeInfo *rhs_type;
            if (parse_expr(p, &rhs_value, &rhs_type) != 1)
                return -1;

            // Expect semicolon
            if (!expect_char(p, ';'))
                return -1;

            // Only perform operation at parse time if we're not doing code generation
            // (i.e., if RHS doesn't contain read<T>())
            if (!p->needs_code_gen)
            {
                // Perform operation at parse time
                int64_t result = 0;
                TypeInfo *result_type = binding->type;

                if (!perform_op(p, op, binding->value, rhs_value, result_type, &result))
                    return -1;

                // Update variable
                if (!update_var(p, id_start, id_len, result))
                {
                    p->error = true;
                    return -1;
                }
            }
            else
            {
                // With code generation, we can't evaluate at parse time
                // Track the variable update for code generation
                if (p->var_update_count < 64)
                {
                    // CPD-OFF - Necessary pattern for variable update tracking
                    VarUpdate *update = &p->var_updates[p->var_update_count];
                    strncpy(update->name, id_start, id_len);
                    update->name[id_len] = '\0';
                    update->op = op;

                    // Check if RHS contains a read call
                    // If rhs_type is non-null and needs_code_gen, we have a read
                    if (rhs_type && p->read_count > 0)
                    {
                        // Use the most recent read index
                        update->read_idx = p->read_count - 1;
                        update->rhs_value = 0;
                    }
                    else
                    {
                        // No read, use the RHS value directly
                        update->read_idx = -1;
                        update->rhs_value = rhs_value;
                    }
                    // CPD-ON
                    p->var_update_count++;
                }
            }

            // Continue parsing statements
            return parse_stmt(p, out_value, out_type);
        }

        // Not a compound assignment, reset and parse as expression
        p->pos = id_start;
    }

    // If the next non-whitespace character is '}' or end-of-input, there is no
    // trailing expression - the block/statement returns a unit dummy value.
    // This allows while-loop bodies like { x -= 1U8; } that end with ';'.
    skip_ws(p);
    if (*p->pos == '\0' || *p->pos == '}')
    {
        *out_value = 0;
        *out_type = find_type("I32");
        return 1;
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

// Helper function to map Tuff type string to C type
// CPD-OFF
static const char *get_c_type_from_string(const char *tuff_type)
{
    if (strcmp(tuff_type, "I32") == 0) return "int32_t";
    if (strcmp(tuff_type, "U8") == 0) return "uint8_t";
    if (strcmp(tuff_type, "I8") == 0) return "int8_t";
    if (strcmp(tuff_type, "U16") == 0) return "uint16_t";
    if (strcmp(tuff_type, "I16") == 0) return "int16_t";
    if (strcmp(tuff_type, "U32") == 0) return "uint32_t";
    if (strcmp(tuff_type, "U64") == 0) return "uint64_t";
    if (strcmp(tuff_type, "I64") == 0) return "int64_t";
    return "int64_t";  // Default
}
// CPD-ON

// Helper function to append string to code buffer
static int append_to_code(char *code, size_t *pos, size_t capacity, const char *text)
{
    size_t text_len = strlen(text);
    if (*pos + text_len >= capacity) {
        return 0;
    }
    strcpy(code + *pos, text);
    *pos += text_len;
    return 1;
}

static char *generate_code(int64_t value, Parser *p)
{
    // Allocate larger buffer to accommodate struct declarations
    char *code = malloc(16384);
    if (!code)
        return NULL;
   
    // Build the code with proper buffer tracking
    size_t pos = 0;
    size_t capacity = 16384;
    
    // Add headers
    const char *headers = "#define _CRT_SECURE_NO_WARNINGS\n#include <stdio.h>\n#include <stdint.h>\n#include <string.h>\n";
    if (!append_to_code(code, &pos, capacity, headers)) {
        free(code);
        return NULL;
    }
    
    // Add struct declarations if any structs were defined
    if (p && p->struct_count > 0)
    {
        for (int i = 0; i < p->struct_count; i++)
        {
            StructDef *sdef = &p->struct_defs[i];
            
            // Add struct typedef
            const char *struct_start = "typedef struct {\n";
            if (!append_to_code(code, &pos, capacity, struct_start)) {
                free(code);
                return NULL;
            }
            
            for (int j = 0; j < sdef->field_count; j++)
            {
                StructField *field = &sdef->fields[j];
                const char *c_type = get_c_type_from_string(field->type);
                
                char field_decl[256];
                snprintf(field_decl, sizeof(field_decl), "    %s %s;\n", c_type, field->name);
                if (!append_to_code(code, &pos, capacity, field_decl)) {
                    free(code);
                    return NULL;
                }
            }
            
            char struct_end[256];
            snprintf(struct_end, sizeof(struct_end), "} %s;\n\n", sdef->name);
            if (!append_to_code(code, &pos, capacity, struct_end)) {
                free(code);
                return NULL;
            }
        }
    }
    
    // Add main function
    char main_part[512];
    snprintf(main_part, sizeof(main_part), "int main() {\n    return %lld;\n}\n", value);
    if (!append_to_code(code, &pos, capacity, main_part)) {
        free(code);
        return NULL;
    }
    
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

// Strip Tuff type suffixes (e.g. I32, U8) from a string for C code generation.
// Removes an uppercase I/U and following digits when preceded by a digit.
// E.g., "x > 0I32" -> "x > 0"
static void strip_type_suffixes(const char *src, char *dst, int dstsz)
{
    int si = 0, di = 0;
    while (src[si] && di < dstsz - 1)
    {
        char c = src[si];
        if ((c == 'I' || c == 'U') && si > 0 &&
            isdigit((unsigned char)src[si - 1]) &&
            isdigit((unsigned char)src[si + 1]))
        {
            // Skip type suffix letters and digits
            while (src[si] && isalnum((unsigned char)src[si]))
                si++;
        }
        else
        {
            dst[di++] = c;
            si++;
        }
    }
    dst[di] = '\0';
}

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

    // If there are no reads and no while loops, use simple code generation
    if (parser.read_count == 0 && parser.while_count == 0)
    {
        return generate_code(value, &parser);
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

    // Build the code - allocate from heap to avoid stack overflow
    char *code = malloc(32768);
    if (!code)
        return NULL;

    char *buffer = malloc(32768);
    if (!buffer)
    {
        free(code);
        return NULL;
    }

    buffer[0] = '\0';
    strncat(buffer, "#define _CRT_SECURE_NO_WARNINGS\n#include <stdio.h>\n#include <stdint.h>\n#include <string.h>\nint main() {\n", 32767);

    // Declare and initialize variables for each read
    for (int i = 0; i < parser.read_count; i++)
    {
        const char *c_type = get_c_type(parser.reads[i].type);

        if (!c_type)
        {
            free(code);
            free(buffer);
            return generate_error();
        }

        // Check if this is a Bool type
        if (parser.reads[i].type->bits == 8 && !parser.reads[i].type->is_signed && parser.reads[i].type->max_val == 1)
        {
            // Special handling for Bool: read a string and parse "true" or "false"
            char decl[512];
            snprintf(decl, sizeof(decl), "    char __read%d_str[16];\n    scanf(\"%%15s\", __read%d_str);\n    _Bool __read%d = (strcmp(__read%d_str, \"true\") == 0) ? 1 : 0;\n",
                     i, i, i, i);
            strncat(buffer, decl, 32767 - strlen(buffer) - 1);
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
            strncat(buffer, decl, 32767 - strlen(buffer) - 1);
        }
    }

    // Declare and initialize variables that were defined
    for (int i = 0; i < parser.var_def_count; i++)
    {
        VarDef *vardef = &parser.var_defs[i];
        const char *c_type = get_c_type(vardef->type);
        if (!c_type)
        {
            free(code);
            free(buffer);
            return generate_error();
        }

        char decl[512];
        snprintf(decl, sizeof(decl), "    %s %s = %lld;\n", c_type, vardef->name, vardef->init_value);
        strncat(buffer, decl, 32767 - strlen(buffer) - 1);
    }

    // Apply variable updates that are OUTSIDE any while loop body
    for (int i = 0; i < parser.var_update_count; i++)
    {
        bool in_loop = false;
        for (int w = 0; w < parser.while_count; w++)
        {
            if (i >= parser.while_loops[w].body_update_start &&
                i < parser.while_loops[w].body_update_end)
            {
                in_loop = true;
                break;
            }
        }
        if (in_loop)
            continue;
        VarUpdate *update = &parser.var_updates[i];
        const char *op_str;

        switch (update->op)
        {
        case '+':
            op_str = "+";
            break;
        case '-':
            op_str = "-";
            break;
        case '*':
            op_str = "*";
            break;
        case '/':
            op_str = "/";
            break;
        case '%':
            op_str = "%";
            break;
        default:
            op_str = "+";
            break;
        }

        char stmt[512];
        if (update->read_idx >= 0)
        {
            // Variable update with a read call
            snprintf(stmt, sizeof(stmt), "    %s = %s %s __read%d;\n",
                     update->name, update->name, op_str, update->read_idx);
        }
        else
        {
            // Variable update with a constant
            snprintf(stmt, sizeof(stmt), "    %s = %s %s %lld;\n",
                     update->name, update->name, op_str, update->rhs_value);
        }
        strncat(buffer, stmt, 32767 - strlen(buffer) - 1);
    }

    // Handle match expressions with read<T>() by generating if-else logic
    if (strncmp(expr, "match (", 7) == 0)
    {
        // This is a match expression - generate if-else C code
        const char *match_ptr = expr + 7; // Skip "match ("
        const char *paren_end = strchr(match_ptr, ')');

        if (paren_end && paren_end - match_ptr < 128)
        {
            // Extract the match condition
            char match_condition[128];
            strncpy(match_condition, match_ptr, paren_end - match_ptr);
            match_condition[paren_end - match_ptr] = '\0';

            // Find the opening brace for cases
            const char *brace_pos = strchr(paren_end, '{');
            const char *close_brace = brace_pos ? strchr(brace_pos, '}') : NULL;

            if (brace_pos && close_brace)
            {
                strncat(buffer, "    int __match_result = 0;\n", 32767 - strlen(buffer) - 1);

                // Count and parse cases
                const char *search_pos = brace_pos;
                bool first_case = true;
                int64_t default_result = 0;
                bool has_default = false;

                // Search for "case" keywords
                while ((search_pos = strstr(search_pos, "case")) != NULL && search_pos < close_brace)
                {
                    const char *after_case = search_pos + 4;
                    while (*after_case && isspace((unsigned char)*after_case))
                        after_case++;

                    // Check for_ (default)
                    if (*after_case == '_')
                    {
                        // Parse default case result
                        const char *arrow_pos = strchr(after_case, '>');
                        if (arrow_pos)
                        {
                            const char *res_start = arrow_pos + 1;
                            while (*res_start && (isspace((unsigned char)*res_start) || *res_start == '='))
                                res_start++;
                            // Parse integer (could have type suffix like U8)
                            char *end;
                            default_result = strtoll(res_start, &end, 10);
                            has_default = true;
                        }
                        search_pos = after_case + 1;
                    }
                    else if (isdigit((unsigned char)*after_case) || *after_case == '-')
                    {
                        // Numeric case - extract pattern and result
                        char case_str[256];
                        const char *semicolon = strchr(after_case, ';');
                        if (semicolon && semicolon - after_case < sizeof(case_str))
                        {
                            strncpy(case_str, after_case, semicolon - after_case);
                            case_str[semicolon - after_case] = '\0';

                            // Split on "=>"
                            const char *arrow = strstr(case_str, "=>");
                            if (arrow)
                            {
                                // CPD-OFF
                                // Extract pattern (trim whitespace)
                                char pattern[64];
                                const char *p_end = arrow;
                                while (p_end > after_case && isspace((unsigned char)*(p_end - 1)))
                                    p_end--;
                                strncpy(pattern, after_case, p_end - after_case);
                                pattern[p_end - after_case] = '\0';

                                // Extract result (after "=>")
                                char result[64];
                                const char *r_start = arrow + 2;
                                while (*r_start && isspace((unsigned char)*r_start))
                                    r_start++;
                                const char *r_end = r_start;
                                while (*r_end && *r_end != ';')
                                    r_end++;
                                while (r_end > r_start && isspace((unsigned char)*(r_end - 1)))
                                    r_end--;
                                strncpy(result, r_start, r_end - r_start);
                                result[r_end - r_start] = '\0';
                                // CPD-ON

                                // Generate if/else if
                                char if_line[256];
                                if (first_case)
                                    snprintf(if_line, sizeof(if_line), "    if (%s == %s) __match_result = %s;\n",
                                             match_condition, pattern, result);
                                else
                                    snprintf(if_line, sizeof(if_line), "    else if (%s == %s) __match_result = %s;\n",
                                             match_condition, pattern, result);
                                strncat(buffer, if_line, 32767 - strlen(buffer) - 1);
                                first_case = false;
                            }
                        }
                        search_pos = semicolon ? semicolon + 1 : after_case + 1;
                    }
                    else
                    {
                        search_pos++;
                    }
                }

                // Add default case
                if (has_default)
                {
                    // CPD-OFF - Structural snprintf/strncat pattern matches while-header emit
                    char else_line[256];
                    snprintf(else_line, sizeof(else_line), "    else __match_result = %lld;\n", default_result);
                    strncat(buffer, else_line, 32767 - strlen(buffer) - 1);
                    // CPD-ON
                }

                // Update expr to use the result variable
                strcpy(expr, "__match_result");
            }
        }
    }

    // Generate code for each while loop
    for (int w = 0; w < parser.while_count; w++)
    {
        WhileLoop *wl = &parser.while_loops[w];

        // Build C-compatible condition (strip Tuff type suffixes)
        char processed_cond[256];
        strip_type_suffixes(wl->condition_text, processed_cond, (int)sizeof(processed_cond));

        // Emit while loop header
        char while_hdr[512];
        snprintf(while_hdr, sizeof(while_hdr), "    while (%s) {\n", processed_cond);
        strncat(buffer, while_hdr, 32767 - strlen(buffer) - 1);

        // CPD-OFF - Necessary: body update op_str resolution duplicates the outer-loop pattern
        // Emit body updates inside the loop
        for (int i = wl->body_update_start; i < wl->body_update_end; i++)
        {
            VarUpdate *update = &parser.var_updates[i];
            const char *op_str;
            switch (update->op)
            {
            case '+': op_str = "+"; break;
            case '-': op_str = "-"; break;
            case '*': op_str = "*"; break;
            case '/': op_str = "/"; break;
            case '%': op_str = "%"; break;
            default:  op_str = "+"; break;
            }
            char stmt[256];
            if (update->read_idx >= 0)
                snprintf(stmt, sizeof(stmt), "        %s = %s %s __read%d;\n",
                         update->name, update->name, op_str, update->read_idx);
            else
                snprintf(stmt, sizeof(stmt), "        %s = %s %s %lld;\n",
                         update->name, update->name, op_str, update->rhs_value);
            strncat(buffer, stmt, 32767 - strlen(buffer) - 1);
        }
        // CPD-ON

        strncat(buffer, "    }\n", 32767 - strlen(buffer) - 1);
    }

    // Determine the return value
    // CPD-OFF - Unavoidable conditional branching in code generation
    // If we have variable definitions/updates, return the last modified variable
    // Otherwise, return the expression
    char ret[512];
    if (parser.var_update_count > 0)
    {
        // Return the last updated variable
        VarUpdate *last_update = &parser.var_updates[parser.var_update_count - 1];
        snprintf(ret, sizeof(ret), "    return (int)%s;\n}\n", last_update->name);
    }
    else if (parser.var_def_count > 0)
    {
        // Return the last defined variable
        VarDef *last_def = &parser.var_defs[parser.var_def_count - 1];
        snprintf(ret, sizeof(ret), "    return (int)%s;\n}\n", last_def->name);
    }
    else
    {
        // No variables, return the expression
        snprintf(ret, sizeof(ret), "    return (int)(%s);\n}\n", expr);
    }
    // CPD-ON
    strncat(buffer, ret, 32767 - strlen(buffer) - 1);

    strncpy(code, buffer, 32767);
    code[32767] = '\0';
    free(buffer);
    return code;
}

#include <stdint.h>
#include <stdbool.h>
