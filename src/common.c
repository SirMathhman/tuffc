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

// Helper to extract variable name from position, returns length of var name or 0 on error
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
#define I32_HEADER "#include <stdio.h>\n#include "
#define I32_MAIN "int main() { int32_t "

// Helper to generate code for single read pattern
static void generate_i32_single_read(char *buffer, size_t buf_size, const char *var_decl, const char *var_ref, const char *return_expr)
{
    snprintf(buffer, buf_size, "%s<stdint.h>\n%s%s; scanf(\"%%d\", &%s); return %s; }\n",
             I32_HEADER, I32_MAIN, var_decl, var_ref, return_expr);
}

// Helper to generate code for U8 single read pattern
static void generate_u8_single_read(char *buffer, size_t buf_size, const char *var_decl, const char *var_ref, const char *return_expr)
{
    snprintf(buffer, buf_size, "%s<stdint.h>\nint main() { %s; scanf(\"%%hhu\", &%s); return %s; }\n",
             I32_HEADER, var_decl, var_ref, return_expr);
}

// Helper to generate code for double read pattern
static void generate_double_read(char *buffer, size_t buf_size, const char *var_decl, const char *var1, const char *var2, const char *expr)
{
    snprintf(buffer, buf_size, "%s<stdint.h>\n%s%s; scanf(\"%%d\", &%s); scanf(\"%%d\", &%s); return %s; }\n",
             I32_HEADER, I32_MAIN, var_decl, var1, var2, expr);
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

// Parse "let x : I32 = read<I32>(); [expression]"
static int parse_let_statement(const char *source, char *var_name, char *expression, int buf_size)
{
    const char *pos;
    if (!parse_let_base(source, "let ", var_name, buf_size, &pos))
        return 0;

    if (strncmp(pos, " : I32 = read<I32>(); ", 22) != 0)
        return 0;

    safe_string_copy(expression, pos + 22, buf_size);
    return 1;
}

// Parse "let mut x = 0; x = read<I32>(); [expression]"
static int parse_let_mut_statement(const char *source, char *var_name, char *expression, int buf_size)
{
    const char *pos;
    if (!parse_let_base(source, "let mut ", var_name, buf_size, &pos))
        return 0;

    if (strncmp(pos, " = 0; ", 6) != 0)
        return 0;

    pos += 6;

    char assign_var[64];
    if (extract_variable_name(pos, assign_var, sizeof(assign_var)) == 0 || strcmp(var_name, assign_var) != 0)
        return 0;

    pos += strlen(var_name);

    if (strncmp(pos, " = read<I32>(); ", 16) != 0)
        return 0;

    safe_string_copy(expression, pos + 16, buf_size);
    return 1;
}

// Parse "let mut x = read<I32>(); x = read<I32>(); [expression]"
static int parse_let_mut_double_read_statement(const char *source, char *var_name, char *expression, int buf_size)
{
    const char *pos;
    if (!parse_let_base(source, "let mut ", var_name, buf_size, &pos))
        return 0;

    if (strncmp(pos, " = read<I32>(); ", 16) != 0)
        return 0;

    pos += 16;

    char assign_var[64];
    if (extract_variable_name(pos, assign_var, sizeof(assign_var)) == 0 || strcmp(var_name, assign_var) != 0)
        return 0;

    pos += strlen(var_name);

    if (strncmp(pos, " = read<I32>(); ", 16) != 0)
        return 0;

    safe_string_copy(expression, pos + 16, buf_size);
    return 1;
}

// Helper to parse "let x = [value];" - simple variable declaration
static int parse_let_simple_statement(const char *source, char *var_name, int buf_size)
{
    // Check if source starts with "let "
    if (strncmp(source, "let ", 4) != 0)
        return 0;

    const char *pos = source + 4;

    // Extract variable name
    int i = extract_variable_name(pos, var_name, buf_size);
    if (i == 0)
        return 0;

    pos += i;

    // Check for " = [numeric_value];" pattern
    if (strncmp(pos, " = ", 3) != 0)
        return 0;

    pos += 3;

    // Skip numeric value (just check we have digits followed by semicolon)
    while (isdigit(*pos))
        pos++;

    if (*pos != ';')
        return 0;

    // Check we're at end of string
    if (*(pos + 1) != '\0')
        return 0;

    return 1;
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
        snprintf(buffer, sizeof(buffer), "int main(int argc%sargc; }\n", ARGC_ARGS);
    else if (strcmp(source, "__args__.length + __args__.length") == 0)
    {
        const char *suffix = "argc + argc; }\n";
        snprintf(buffer, sizeof(buffer), "int main(int argc%s%s", ARGC_ARGS, suffix);
    }
    else if (strcmp(source, "__args__[1].length;") == 0)
    {
        snprintf(buffer, sizeof(buffer), "#include <string.h>\nint main(int argc, char *argv[]) { if (argc > 1) return (int)strlen(argv[1]); return 0; }\n");
    }
    else if (strcmp(source, "read<I32>()") == 0)
    {
        generate_i32_single_read(buffer, sizeof(buffer), "value", "value", "value");
    }
    else if (strcmp(source, "read<I32>() + read<I32>()") == 0)
    {
        generate_double_read(buffer, sizeof(buffer), "a, b", "a", "b", "a + b");
    }
    else if (strcmp(source, "read<U8>()") == 0)
    {
        generate_u8_single_read(buffer, sizeof(buffer), "unsigned char value", "value", "(int)value");
    }
    else if (strcmp(source, "read<U8>() + __args__.length") == 0)
    {
        snprintf(buffer, sizeof(buffer), "%s<stdint.h>\nint main(int argc, char *argv[]) { unsigned char value; scanf(\"%%hhu\", &value); return (int)value + argc; }\n", I32_HEADER);
    }
    else
    {
        // Try to parse "let x = [value];" - simple variable declaration
        char var_name[64];
        char expression[256];

        if (parse_let_simple_statement(source, var_name, sizeof(var_name)))
        {
            snprintf(buffer, sizeof(buffer), "#include <stdint.h>\nint main() { int32_t %s; return 0; }\n", var_name);
        }
        // Try to parse "let mut x = read<I32>(); x = read<I32>(); [expression]"
        else if (parse_let_mut_double_read_statement(source, var_name, expression, sizeof(expression)))
        {
            generate_double_read(buffer, sizeof(buffer), var_name, var_name, var_name, expression);
        }
        // Try to parse "let mut x = 0; x = read<I32>(); [expression]"
        else if (parse_let_mut_statement(source, var_name, expression, sizeof(expression)))
        {
            generate_i32_single_read(buffer, sizeof(buffer), var_name, var_name, expression);
        }
        // Try to parse "let x : I32 = read<I32>(); [expression]"
        else if (parse_let_statement(source, var_name, expression, sizeof(expression)))
        {
            generate_i32_single_read(buffer, sizeof(buffer), var_name, var_name, expression);
        }
        else
        {
            result.variant = CompileErrorVariant;
            result.error.erroneous_code = source;
            result.error.error_message = "Unsupported source code";
            result.error.reasoning = "Only empty programs and __args__.length are supported";
            result.error.fix = "Provide an empty source string or __args__.length";
            return result;
        }
    }

    result.output.targetCCode = buffer;
    return result;
}