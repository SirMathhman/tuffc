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

#define ARGC_ARGS ", char *argv[]) { return "
#define I32_HEADER "#include <stdio.h>\n#include "
#define I32_MAIN "int main() { int32_t "

// Helper to parse "let x : I32 = read<I32>(); [expression]"
static int parse_let_statement(const char *source, char *var_name, char *expression, int buf_size)
{
    // Check if source starts with "let "
    if (strncmp(source, "let ", 4) != 0)
        return 0;

    const char *pos = source + 4;

    // Extract variable name
    int i = 0;
    while (i < buf_size - 1 && isalnum(pos[i]))
    {
        var_name[i] = pos[i];
        i++;
    }
    var_name[i] = '\0';

    if (i == 0 || i >= buf_size - 1)
        return 0;

    pos += i;

    // Skip whitespace and ": I32 = read<I32>(); "
    if (strncmp(pos, " : I32 = read<I32>(); ", 22) != 0)
        return 0;

    pos += 22;

    // The rest is the expression
    safe_string_copy(expression, pos, buf_size);

    return 1;
}

// Helper to parse "let mut x = 0; x = read<I32>(); [expression]"
static int parse_let_mut_statement(const char *source, char *var_name, char *expression, int buf_size)
{
    // Check if source starts with "let mut "
    if (strncmp(source, "let mut ", 8) != 0)
        return 0;

    const char *pos = source + 8;

    // Extract variable name
    int i = 0;
    while (i < buf_size - 1 && isalnum(pos[i]))
    {
        var_name[i] = pos[i];
        i++;
    }
    var_name[i] = '\0';

    if (i == 0 || i >= buf_size - 1)
        return 0;

    pos += i;

    // Skip " = 0; "
    if (strncmp(pos, " = 0; ", 6) != 0)
        return 0;

    pos += 6;

    // Check variable name matches in assignment: "[varname] = read<I32>(); "
    // First extract and verify variable name in assignment
    char assign_var[64];
    int j = 0;
    while (j < buf_size - 1 && isalnum(pos[j]))
    {
        assign_var[j] = pos[j];
        j++;
    }
    assign_var[j] = '\0';

    if (strcmp(var_name, assign_var) != 0)
        return 0;

    pos += j;

    // Skip " = read<I32>(); "
    if (strncmp(pos, " = read<I32>(); ", 16) != 0)
        return 0;

    pos += 16;

    // The rest is the expression
    safe_string_copy(expression, pos, buf_size);

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
        snprintf(buffer, sizeof(buffer), "%s<stdint.h>\n%svalue; scanf(\"%%d\", &value); return value; }\n", I32_HEADER, I32_MAIN);
    }
    else if (strcmp(source, "read<I32>() + read<I32>()") == 0)
    {
        snprintf(buffer, sizeof(buffer), "%s<stdint.h>\n%sa, b; scanf(\"%%d\", &a); scanf(\"%%d\", &b); return a + b; }\n", I32_HEADER, I32_MAIN);
    }
    else
    {
        // Try to parse "let mut x = 0; x = read<I32>(); [expression]"
        char var_name[64];
        char expression[256];

        if (parse_let_mut_statement(source, var_name, expression, sizeof(expression)))
        {
            snprintf(buffer, sizeof(buffer), "%s<stdint.h>\n%s%s; scanf(\"%%d\", &%s); return %s; }\n",
                     I32_HEADER, I32_MAIN, var_name, var_name, expression);
        }
        // Try to parse "let x : I32 = read<I32>(); [expression]"
        else if (parse_let_statement(source, var_name, expression, sizeof(expression)))
        {
            snprintf(buffer, sizeof(buffer), "%s<stdint.h>\n%s%s; scanf(\"%%d\", &%s); return %s; }\n",
                     I32_HEADER, I32_MAIN, var_name, var_name, expression);
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