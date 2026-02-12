#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
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

// Helper function to create an error result
static CompileResult create_error(const char *erroneous_code, const char *error_message, const char *reasoning, const char *fix)
{
    return (CompileResult){
        .variant = CompileErrorVariant,
        .error = {
            .erroneous_code = (char *)erroneous_code,
            .error_message = (char *)error_message,
            .reasoning = (char *)reasoning,
            .fix = (char *)fix,
        },
    };
}

// Helper function to create an output result
static CompileResult create_output(const char *headerCCode, const char *targetCCode)
{
    return (CompileResult){
        .variant = OutputVariant,
        .output = {
            .headerCCode = (char *)headerCCode,
            .targetCCode = (char *)targetCCode,
        },
    };
}

#define MAX_SYMBOLS 64
#define MAX_SYMBOL_NAME 64
#define MAX_EXPR_LEN 512

typedef struct
{
    char names[MAX_SYMBOLS][MAX_SYMBOL_NAME];
    int32_t count;
} SymbolTable;

static int32_t is_ident_start(char c)
{
    return (int32_t)(isalpha((unsigned char)c) || c == '_');
}

static int32_t is_ident_char(char c)
{
    return (int32_t)(isalnum((unsigned char)c) || c == '_');
}

static void trim_in_place(char *s)
{
    if (!s)
    {
        return;
    }

    size_t len = strlen(s);
    size_t start = 0;
    while (start < len && isspace((unsigned char)s[start]))
    {
        start++;
    }

    size_t end = len;
    while (end > start && isspace((unsigned char)s[end - 1]))
    {
        end--;
    }

    if (start > 0)
    {
        memmove(s, s + start, end - start);
    }
    s[end - start] = '\0';
}

static int32_t symbol_exists(SymbolTable *table, const char *name)
{
    for (int32_t i = 0; i < table->count; i++)
    {
        if (strcmp(table->names[i], name) == 0)
        {
            return 1;
        }
    }
    return 0;
}

static int32_t add_symbol(SymbolTable *table, const char *name)
{
    if (table->count >= MAX_SYMBOLS)
    {
        return 0;
    }
    snprintf(table->names[table->count], MAX_SYMBOL_NAME, "%s", name);
    table->count++;
    return 1;
}

static int32_t append_text(char *dst, size_t dst_size, const char *text)
{
    size_t current_len = strlen(dst);
    size_t text_len = strlen(text);
    if (current_len + text_len + 1 > dst_size)
    {
        return 0;
    }
    memcpy(dst + current_len, text, text_len + 1);
    return 1;
}

static int32_t parse_identifier(const char *s, char *out, size_t out_size, size_t *consumed)
{
    size_t i = 0;
    if (!is_ident_start(s[i]))
    {
        return 0;
    }

    while (s[i] != '\0' && is_ident_char(s[i]))
    {
        i++;
    }

    if (i + 1 > out_size)
    {
        return 0;
    }

    memcpy(out, s, i);
    out[i] = '\0';
    *consumed = i;
    return 1;
}

static CompileResult translate_term(
    const char *source,
    const char *term,
    SymbolTable *symbols,
    int32_t *uses_args,
    int32_t *uses_string_h,
    char *out_term,
    size_t out_term_size)
{
    if (strcmp(term, "__args__") == 0)
    {
        return create_error(source,
                            "Type error: __args__ is not a number",
                            "__args__ is an array of command-line arguments. To use it as a number, access the length property (__args__.length) or an indexed element (__args__[index]).",
                            "Use __args__.length to get the argument count, or __args__[index].length to get a specific argument's length.");
    }

    if (strcmp(term, "__args__.length") == 0)
    {
        *uses_args = 1;
        snprintf(out_term, out_term_size, "(argc - 1)");
        return create_output("", "");
    }

    if (strncmp(term, "__args__[", 9) == 0)
    {
        const char *index_start = term + 9;
        const char *index_end = strchr(index_start, ']');
        if (index_end && strcmp(index_end, "].length") == 0)
        {
            char index_buffer[32] = {0};
            size_t index_len = (size_t)(index_end - index_start);
            if (index_len == 0 || index_len >= sizeof(index_buffer))
            {
                return create_error(source,
                                    "Invalid __args__ index",
                                    "Argument index must be a non-empty numeric value.",
                                    "Use a numeric index like __args__[1].length.");
            }

            memcpy(index_buffer, index_start, index_len);
            index_buffer[index_len] = '\0';

            for (size_t i = 0; i < index_len; i++)
            {
                if (!isdigit((unsigned char)index_buffer[i]))
                {
                    return create_error(source,
                                        "Invalid __args__ index",
                                        "Argument index must be numeric.",
                                        "Use a numeric index like __args__[1].length.");
                }
            }

            *uses_args = 1;
            *uses_string_h = 1;
            snprintf(out_term, out_term_size, "(argc > %s ? (int)strlen(argv[%s]) : 0)", index_buffer, index_buffer);
            return create_output("", "");
        }
    }

    int32_t is_number = 1;
    if (term[0] == '\0')
    {
        is_number = 0;
    }
    for (size_t i = 0; term[i] != '\0'; i++)
    {
        if (!isdigit((unsigned char)term[i]))
        {
            is_number = 0;
            break;
        }
    }
    if (is_number)
    {
        snprintf(out_term, out_term_size, "%s", term);
        return create_output("", "");
    }

    if (is_ident_start(term[0]))
    {
        for (size_t i = 1; term[i] != '\0'; i++)
        {
            if (!is_ident_char(term[i]))
            {
                return create_error(source,
                                    "Unsupported expression syntax",
                                    "The expression contains unsupported characters.",
                                    "Use identifiers, integer literals, __args__.length, __args__[index].length, and +.");
            }
        }

        if (!symbol_exists(symbols, term))
        {
            static char undefined_message[160];
            snprintf(undefined_message, sizeof(undefined_message), "Undefined identifier '%s'", term);
            return create_error(source,
                                undefined_message,
                                "The identifier is used but never defined.",
                                "Define the identifier before use or check for typos.");
        }

        snprintf(out_term, out_term_size, "%s", term);
        return create_output("", "");
    }

    return create_error(source,
                        "Unsupported expression syntax",
                        "The expression is not recognized by the current compiler subset.",
                        "Use identifiers, integer literals, __args__.length, __args__[index].length, and +.");
}

static CompileResult translate_expression(
    const char *source,
    char *expression,
    SymbolTable *symbols,
    int32_t *uses_args,
    int32_t *uses_string_h,
    char *out_expr,
    size_t out_expr_size)
{
    out_expr[0] = '\0';

    char work[MAX_EXPR_LEN] = {0};
    snprintf(work, sizeof(work), "%s", expression);

    char *segment_start = work;
    int32_t first_term = 1;

    while (1)
    {
        char *plus = strchr(segment_start, '+');
        if (plus)
        {
            *plus = '\0';
        }

        trim_in_place(segment_start);
        if (segment_start[0] == '\0')
        {
            return create_error(source,
                                "Invalid expression",
                                "Expression contains an empty term around '+'.",
                                "Provide a value on both sides of '+'.");
        }

        char translated_term[MAX_EXPR_LEN] = {0};
        CompileResult term_result = translate_term(source, segment_start, symbols, uses_args, uses_string_h, translated_term, sizeof(translated_term));
        if (term_result.variant == CompileErrorVariant)
        {
            return term_result;
        }

        if (!first_term)
        {
            if (!append_text(out_expr, out_expr_size, " + "))
            {
                return create_error(source,
                                    "Generated expression too large",
                                    "The generated C expression exceeded compiler buffer limits.",
                                    "Simplify the source expression.");
            }
        }

        if (!append_text(out_expr, out_expr_size, translated_term))
        {
            return create_error(source,
                                "Generated expression too large",
                                "The generated C expression exceeded compiler buffer limits.",
                                "Simplify the source expression.");
        }
        first_term = 0;

        if (!plus)
        {
            break;
        }
        segment_start = plus + 1;
    }

    return create_output("", "");
}

CompileResult compile(char *source)
{
    static char header_buffer[64];
    static char target_buffer[4096];

    header_buffer[0] = '\0';
    target_buffer[0] = '\0';

    if (source == NULL)
    {
        return create_output("", "int main() {\n    return 0;\n}\n");
    }

    size_t source_len = strlen(source);
    char *source_copy = (char *)malloc(source_len + 1);
    if (!source_copy)
    {
        return create_error(source,
                            "Out of memory",
                            "Failed to allocate memory while compiling source.",
                            "Try compiling a smaller input or increase available memory.");
    }
    memcpy(source_copy, source, source_len + 1);
    trim_in_place(source_copy);

    if (source_copy[0] == '\0')
    {
        free(source_copy);
        return create_output("", "int main() {\n    return 0;\n}\n");
    }

    SymbolTable symbols = {0};
    char declarations[2048] = {0};
    char return_expr[MAX_EXPR_LEN] = "0";
    int32_t has_expression_statement = 0;
    int32_t uses_args = 0;
    int32_t uses_string_h = 0;

    char *statement_start = source_copy;
    while (1)
    {
        char *delimiter = strchr(statement_start, ';');
        char statement[MAX_EXPR_LEN] = {0};

        if (delimiter)
        {
            size_t stmt_len = (size_t)(delimiter - statement_start);
            if (stmt_len >= sizeof(statement))
            {
                free(source_copy);
                return create_error(source,
                                    "Statement too long",
                                    "A statement exceeded parser limits.",
                                    "Break long statements into smaller expressions.");
            }
            memcpy(statement, statement_start, stmt_len);
            statement[stmt_len] = '\0';
        }
        else
        {
            snprintf(statement, sizeof(statement), "%s", statement_start);
        }

        trim_in_place(statement);

        if (statement[0] != '\0')
        {
            if (strncmp(statement, "let ", 4) == 0)
            {
                const char *cursor = statement + 4;
                while (*cursor != '\0' && isspace((unsigned char)*cursor))
                {
                    cursor++;
                }

                char var_name[MAX_SYMBOL_NAME] = {0};
                size_t consumed = 0;
                if (!parse_identifier(cursor, var_name, sizeof(var_name), &consumed))
                {
                    free(source_copy);
                    return create_error(source,
                                        "Invalid declaration",
                                        "Expected an identifier after 'let'.",
                                        "Use syntax like: let x = 0;");
                }
                cursor += consumed;

                while (*cursor != '\0' && isspace((unsigned char)*cursor))
                {
                    cursor++;
                }

                if (*cursor == ':')
                {
                    cursor++;
                    while (*cursor != '\0' && isspace((unsigned char)*cursor))
                    {
                        cursor++;
                    }

                    char type_name[MAX_SYMBOL_NAME] = {0};
                    if (!parse_identifier(cursor, type_name, sizeof(type_name), &consumed))
                    {
                        free(source_copy);
                        return create_error(source,
                                            "Invalid declaration type",
                                            "Expected a type name after ':'.",
                                            "Use syntax like: let x : USize = __args__.length;");
                    }
                    cursor += consumed;
                    while (*cursor != '\0' && isspace((unsigned char)*cursor))
                    {
                        cursor++;
                    }
                }

                if (*cursor != '=')
                {
                    free(source_copy);
                    return create_error(source,
                                        "Invalid declaration",
                                        "Expected '=' in variable declaration.",
                                        "Use syntax like: let x = 0;");
                }
                cursor++;

                while (*cursor != '\0' && isspace((unsigned char)*cursor))
                {
                    cursor++;
                }

                char init_expr[MAX_EXPR_LEN] = {0};
                snprintf(init_expr, sizeof(init_expr), "%s", cursor);
                trim_in_place(init_expr);

                if (init_expr[0] == '\0')
                {
                    free(source_copy);
                    return create_error(source,
                                        "Invalid declaration",
                                        "Expected initializer expression after '='.",
                                        "Use syntax like: let x = 0;");
                }

                if (symbol_exists(&symbols, var_name))
                {
                    free(source_copy);
                    static char duplicate_message[192];
                    snprintf(duplicate_message, sizeof(duplicate_message), "Duplicate variable declaration: '%s' already defined", var_name);
                    return create_error(source,
                                        duplicate_message,
                                        "The variable is declared twice in the same scope. Variables can only be declared once.",
                                        "Remove the duplicate declaration or use a different variable name for the second declaration.");
                }

                char translated_expr[MAX_EXPR_LEN] = {0};
                CompileResult expression_result = translate_expression(source, init_expr, &symbols, &uses_args, &uses_string_h, translated_expr, sizeof(translated_expr));
                if (expression_result.variant == CompileErrorVariant)
                {
                    free(source_copy);
                    return expression_result;
                }

                char declaration_line[MAX_EXPR_LEN] = {0};
                snprintf(declaration_line, sizeof(declaration_line), "    int %s = %s;\n", var_name, translated_expr);
                if (!append_text(declarations, sizeof(declarations), declaration_line))
                {
                    free(source_copy);
                    return create_error(source,
                                        "Generated output too large",
                                        "The generated declaration output exceeded compiler buffer limits.",
                                        "Reduce declaration complexity.");
                }

                if (!add_symbol(&symbols, var_name))
                {
                    free(source_copy);
                    return create_error(source,
                                        "Too many variables",
                                        "The number of declared variables exceeded compiler limits.",
                                        "Reduce the number of variable declarations.");
                }
            }
            else
            {
                char expr_buffer[MAX_EXPR_LEN] = {0};
                snprintf(expr_buffer, sizeof(expr_buffer), "%s", statement);

                CompileResult expression_result = translate_expression(source, expr_buffer, &symbols, &uses_args, &uses_string_h, return_expr, sizeof(return_expr));
                if (expression_result.variant == CompileErrorVariant)
                {
                    free(source_copy);
                    return expression_result;
                }
                has_expression_statement = 1;
            }
        }

        if (!delimiter)
        {
            break;
        }

        statement_start = delimiter + 1;
    }

    free(source_copy);

    if (uses_string_h)
    {
        append_text(target_buffer, sizeof(target_buffer), "#include <string.h>\n");
    }

    if (uses_args)
    {
        append_text(target_buffer, sizeof(target_buffer), "int main(int argc, char *argv[]) {\n");
    }
    else
    {
        append_text(target_buffer, sizeof(target_buffer), "int main() {\n");
    }

    append_text(target_buffer, sizeof(target_buffer), declarations);

    if (has_expression_statement)
    {
        char return_line[MAX_EXPR_LEN] = {0};
        snprintf(return_line, sizeof(return_line), "    return %s;\n", return_expr);
        append_text(target_buffer, sizeof(target_buffer), return_line);
    }
    else
    {
        append_text(target_buffer, sizeof(target_buffer), "    return 0;\n");
    }

    append_text(target_buffer, sizeof(target_buffer), "}\n");

    return create_output(header_buffer, target_buffer);
}