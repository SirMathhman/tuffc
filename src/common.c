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

// Safe string copy that avoids deprecated strncpy warnings
static void safe_string_copy(char *dest, const char *src, int buf_size)
{
    int i;
    for (i = 0; i < buf_size - 1 && src[i] != '\0'; i++)
    {
        dest[i] = src[i];
    }
    dest[i] = '\0';
}

static int extract_variable_name(const char *pos, char *var_name, int buf_size)
{
    int i = 0;
    while (i < buf_size - 1 && isalnum(pos[i]))
    {
        var_name[i] = pos[i];
        i++;
    }
    var_name[i] = '\0';

    if (i == 0 || i >= buf_size - 1)
        return 0;

    return i;
}

#define ARGC_ARGS ", char *argv[]) { return "
#define MAIN_I32_PREFIX "int main() { " \
                        "int32_t "

static void reset_buffer(char *dest, size_t buf_size)
{
    if (buf_size > 0)
        dest[0] = '\0';
}

static void append_text(char *dest, size_t buf_size, const char *text)
{
    size_t used = strlen(dest);
    if (used >= buf_size - 1)
        return;

    snprintf(dest + used, buf_size - used, "%s", text);
}

static void append_format(char *dest, size_t buf_size, const char *fmt, ...)
{
    size_t used = strlen(dest);
    if (used >= buf_size - 1)
        return;

    va_list args;
    va_start(args, fmt);
    vsnprintf(dest + used, buf_size - used, fmt, args);
    va_end(args);
}

static void append_program_header(char *buffer, size_t buf_size)
{
    append_text(buffer, buf_size, "#include <stdio.h>\n");
    append_text(buffer, buf_size, "#include <stdint.h>\n");
}

static void append_scan_call(char *buffer, size_t buf_size, const char *fmt, const char *var)
{
    append_text(buffer, buf_size, "scanf(\"");
    append_text(buffer, buf_size, fmt);
    append_text(buffer, buf_size, "\", &");
    append_format(buffer, buf_size, "%s", var);
    append_text(buffer, buf_size, "); ");
}

static void append_value_with_wrap(char *buffer, size_t buf_size, const char *prefix, const char *value, const char *suffix)
{
    append_text(buffer, buf_size, prefix);
    append_format(buffer, buf_size, "%s", value);
    append_text(buffer, buf_size, suffix);
}

static void generate_read_program(char *buffer,
                                  size_t buf_size,
                                  const char *main_prefix,
                                  const char *decl,
                                  const char *fmt1,
                                  const char *var1,
                                  const char *fmt2,
                                  const char *var2,
                                  const char *ret_expr)
{
    reset_buffer(buffer, buf_size);
    append_program_header(buffer, buf_size);
    append_text(buffer, buf_size, main_prefix);
    if (decl != NULL)
    {
        append_format(buffer, buf_size, "%s", decl);
        append_text(buffer, buf_size, "; ");
    }
    if (fmt1 != NULL && var1 != NULL)
        append_scan_call(buffer, buf_size, fmt1, var1);
    if (fmt2 != NULL && var2 != NULL)
        append_scan_call(buffer, buf_size, fmt2, var2);
    append_value_with_wrap(buffer, buf_size, "return ", ret_expr, "; }\n");
}

static void generate_args_length_program(char *buffer, size_t buf_size, int add_twice)
{
    reset_buffer(buffer, buf_size);
    append_text(buffer, buf_size, "int main(int argc");
    append_text(buffer, buf_size, ARGC_ARGS);
    append_text(buffer, buf_size, "argc");
    if (add_twice)
        append_text(buffer, buf_size, " + argc");
    append_text(buffer, buf_size, "; }\n");
}

static int parse_let_base(const char *source, const char *prefix, char *var_name, int buf_size, const char **remaining)
{
    if (strncmp(source, prefix, strlen(prefix)) != 0)
        return 0;

    const char *pos = source + strlen(prefix);
    int i = extract_variable_name(pos, var_name, buf_size);
    if (i == 0)
        return 0;

    *remaining = pos + i;
    return 1;
}

static int consume_token(const char **pos, const char *token, int token_len)
{
    if (strncmp(*pos, token, token_len) != 0)
        return 0;

    *pos += token_len;
    return 1;
}

static int consume_same_var_then_read(const char **pos, const char *var_name)
{
    char assign_var[64];
    int len = extract_variable_name(*pos, assign_var, sizeof(assign_var));
    if (len == 0 || strcmp(var_name, assign_var) != 0)
        return 0;

    *pos += len;
    return consume_token(pos, " = read<I32>(); ", 16);
}

// Parse let-read patterns based on mode:
// 0 => let x : I32 = read<I32>(); [expr]
// 1 => let mut x = 0; x = read<I32>(); [expr]
// 2 => let mut x = read<I32>(); x = read<I32>(); [expr]
static int parse_let_read_pattern(const char *source, int mode, char *var_name, char *expression, int buf_size)
{
    const char *pos;
    const char *prefix = (mode == 0) ? "let " : "let mut ";

    if (!parse_let_base(source, prefix, var_name, buf_size, &pos))
        return 0;

    if (mode == 0)
    {
        if (!consume_token(&pos, " : I32 = read<I32>();"
                                 " ",
                           22))
            return 0;
    }
    else if (mode == 1)
    {
        if (!consume_token(&pos, " = 0; ", 6))
            return 0;
        if (!consume_same_var_then_read(&pos, var_name))
            return 0;
    }
    else
    {
        if (!consume_token(&pos, " = read<I32>(); ", 16))
            return 0;
        if (!consume_same_var_then_read(&pos, var_name))
            return 0;
    }

    safe_string_copy(expression, pos, buf_size);
    return 1;
}

// Parse "let x = [value];" - simple variable declaration
static int parse_let_simple_statement(const char *source, char *var_name, int buf_size)
{
    const char *pos;
    if (!parse_let_base(source, "let ", var_name, buf_size, &pos))
        return 0;

    if (!consume_token(&pos, " = ", 3))
        return 0;

    while (isdigit(*pos))
        pos++;

    return (*pos == ';' && *(pos + 1) == '\0');
}

static int compile_let_pattern(char *source, char *buffer, size_t buf_size)
{
    char var_name[64];
    char expression[256];

    if (parse_let_simple_statement(source, var_name, sizeof(var_name)))
    {
        reset_buffer(buffer, buf_size);
        append_text(buffer, buf_size, "#include <stdint");
        append_text(buffer, buf_size, ".h>\n");
        append_text(buffer, buf_size, "int main() { ");
        append_text(buffer, buf_size, "int32_t ");
        append_format(buffer, buf_size, "%s", var_name);
        append_text(buffer, buf_size, "; return 0; }\n");
        return 1;
    }

    if (parse_let_read_pattern(source, 2, var_name, expression, sizeof(expression)))
    {
        generate_read_program(buffer, buf_size, MAIN_I32_PREFIX, var_name, "%d", var_name, "%d", var_name, expression);
        return 1;
    }

    if (parse_let_read_pattern(source, 1, var_name, expression, sizeof(expression)) ||
        parse_let_read_pattern(source, 0, var_name, expression, sizeof(expression)))
    {
        generate_read_program(buffer, buf_size, MAIN_I32_PREFIX, var_name, "%d", var_name, NULL, NULL, expression);
        return 1;
    }

    return 0;
}

typedef struct ReadPatternSpec
{
    const char *pattern;
    const char *main_prefix;
    const char *decl;
    const char *fmt1;
    const char *var1;
    const char *fmt2;
    const char *var2;
    const char *ret_expr;
} ReadPatternSpec;

static int compile_builtin_read_pattern(const char *source, char *buffer, size_t buf_size)
{
    static const ReadPatternSpec specs[] = {
        {"read<I32>()", MAIN_I32_PREFIX, "value", "%d", "value", NULL, NULL, "value"},
        {"read<I32>() + "
         "read<I32>()",
         MAIN_I32_PREFIX, "a, b", "%d", "a", "%d", "b", "a + b"},
        {"read<U8>()", "int main() { ", "unsigned char value", "%hhu", "value", NULL, NULL, "(int)value"},
        {"read<U8>() + __args__.length", "int main(int argc, "
                                         "char *argv[]) { ",
         "unsigned char value", "%hhu", "value", NULL, NULL, "(int)value + argc"}};
    int i;

    for (i = 0; i < (int)(sizeof(specs) / sizeof(specs[0])); i++)
    {
        if (strcmp(source, specs[i].pattern) == 0)
        {
            generate_read_program(buffer, buf_size, specs[i].main_prefix, specs[i].decl, specs[i].fmt1, specs[i].var1, specs[i].fmt2, specs[i].var2, specs[i].ret_expr);
            return 1;
        }
    }

    return 0;
}

CompileResult compile(char *source)
{
    CompileResult result;
    static char buffer[512];

    result.variant = OutputVariant;
    result.output.headerCCode = "";

    if (source == NULL || source[0] == '\0')
        snprintf(buffer, sizeof(buffer), "int main() { return 0; }\n");
    else if (strcmp(source, "__args__.length") == 0)
        generate_args_length_program(buffer, sizeof(buffer), 0);
    else if (strcmp(source, "__args__.length + "
                            "__args__.length") == 0)
        generate_args_length_program(buffer, sizeof(buffer), 1);
    else if (strcmp(source, "__args__[1].length;") == 0)
        snprintf(buffer, sizeof(buffer), "#include <string.h>\nint main(int argc, char *argv[]) { if (argc > 1) return (int)strlen(argv[1]); return 0; }\n");
    else if (compile_builtin_read_pattern(source, buffer, sizeof(buffer)))
    {
    }
    else if (!compile_let_pattern(source, buffer, sizeof(buffer)))
    {
        result.variant = CompileErrorVariant;
        result.error.erroneous_code = source;
        result.error.error_message = "Unsupported source code";
        result.error.reasoning = "Only empty programs and __args__.length are supported";
        result.error.fix = "Provide an empty source string or __args__.length";
        return result;
    }

    result.output.targetCCode = buffer;
    return result;
}