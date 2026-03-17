#define _CRT_SECURE_NO_WARNINGS
#include "compileTuffToC.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

/**
 * Expression parser and code generator for arithmetic expressions
 * Supports operators: +, -, *, / with standard precedence
 * Supports operands: read<U8>(), numeric literals (e.g. 100U8, 42)
 * Supports parentheses for grouping
 */

typedef struct
{
    const char *pos; // Current position in input
    int read_count;  // Number of read<U8>() calls encountered
} Parser;

// Forward declarations
static char *parse_expr(Parser *p);
static char *parse_primary(Parser *p);
static char *parse_multiplicative(Parser *p);
static char *alloc_string(const char *str);

/**
 * Skip whitespace at current position
 */
static void skip_whitespace(Parser *p)
{
    while (*p->pos && isspace((unsigned char)*p->pos))
    {
        p->pos++;
    }
}

/**
 * Skip whitespace by pointer (non-modifying)
 */
static void skip_whitespace_ptr(const char **ptr)
{
    while (*ptr && isspace((unsigned char)**ptr))
    {
        (*ptr)++;
    }
}

/**
 * Parse a primary expression: number, read<U8>(), or (expr)
 */
static char *parse_primary(Parser *p)
{
    skip_whitespace(p);

    // Check for read<U8>() with optional whitespace
    if (strncmp(p->pos, "read", 4) == 0)
    {
        const char *tmp = p->pos + 4;
        skip_whitespace_ptr(&tmp);
        if (strncmp(tmp, "<U8>", 4) == 0)
        {
            tmp += 4;
            skip_whitespace_ptr(&tmp);
            if (*tmp == '(')
            {
                tmp++;
                skip_whitespace_ptr(&tmp);
                if (*tmp == ')')
                {
                    p->pos = tmp + 1;
                    char buffer[32];
                    snprintf(buffer, sizeof(buffer), "v%d", p->read_count++);
                    char *result = (char *)malloc(strlen(buffer) + 1);
                    strcpy(result, buffer);
                    return result;
                }
            }
        }
    }

    // Check for parenthesized expression
    if (*p->pos == '(')
    {
        p->pos++;
        char *result = parse_expr(p);
        skip_whitespace(p);
        if (*p->pos == ')')
        {
            p->pos++;
            char buffer[512];
            snprintf(buffer, sizeof(buffer), "(%s)", result);
            free(result);
            result = (char *)malloc(strlen(buffer) + 1);
            strcpy(result, buffer);
            return result;
        }
        // Error: mismatched parenthesis, but undefined behavior per spec
        return result;
    }

    // Parse numeric literal (with optional U8 suffix)
    if (isdigit((unsigned char)*p->pos))
    {
        long num = 0;
        int consumed = 0;
        sscanf(p->pos, "%ld%n", &num, &consumed);
        p->pos += consumed;

        // Skip optional U8 suffix
        skip_whitespace(p);
        if (strncmp(p->pos, "U8", 2) == 0)
        {
            p->pos += 2;
        }

        char buffer[32];
        snprintf(buffer, sizeof(buffer), "%ld", num);
        return alloc_string(buffer);
    }

    // Default: return 0
    char *result = (char *)malloc(2);
    strcpy(result, "0");
    return result;
}

/**
 * Generic binary operator parser
 * Parses: left (op left)* where ops are single characters in ops_str
 */
static char *parse_binary_op(Parser *p, char *(*parse_operand)(Parser *), const char *ops_str)
{
    char *left = parse_operand(p);

    while (1)
    {
        skip_whitespace(p);
        char op = *p->pos;

        // Check if current char is one of our operators
        int is_op = 0;
        for (const char *s = ops_str; *s; s++)
        {
            if (*s == op)
            {
                is_op = 1;
                break;
            }
        }
        if (!is_op)
            break;

        p->pos++;
        char *right = parse_operand(p);

        char buffer[512];
        snprintf(buffer, sizeof(buffer), "(%s%c%s)", left, op, right);
        free(left);
        free(right);
        left = alloc_string(buffer);
    }

    return left;
}

/**
 * Parse multiplicative expression: primary (('*' | '/') primary)*
 */
static char *parse_multiplicative(Parser *p)
{
    return parse_binary_op(p, parse_primary, "*/");
}

/**
 * Parse additive expression: multiplicative (('+' | '-') multiplicative)*
 */
static char *parse_additive(Parser *p)
{
    return parse_binary_op(p, parse_multiplicative, "+-");
}

/**
 * Parse a full expression
 */
static char *parse_expr(Parser *p)
{
    return parse_additive(p);
}

/**
 * Allocate and copy a string (helper to avoid duplication)
 */
static char *alloc_string(const char *str)
{
    char *result = (char *)malloc(strlen(str) + 1);
    strcpy(result, str);
    return result;
}

/**
 * Helper: Generate a C main function that returns a value
 * @param value The return value (0-255 for valid exit codes)
 * @return Allocated string (caller must free)
 */
static char *emit_main_return(long value)
{
    char buffer[128];
    snprintf(buffer, sizeof(buffer), "int main(void){return %ld;}\n", value);
    return alloc_string(buffer);
}

/**
 * Helper: Generate a C main function that reads a U8 from stdin
 * @return Allocated string (caller must free)
 */
/**
 * Compiles Tuff code to C code
 * @param tuffCode The Tuff source code to compile (null-terminated)
 * @return The compiled C code as a string (caller must free)
 */
char *compileTuffToC(const char *tuffCode)
{
    // Handle empty input
    if (!tuffCode || tuffCode[0] == '\0')
    {
        return emit_main_return(0);
    }

    // Check if input contains operators
    if (!strchr(tuffCode, '+') && !strchr(tuffCode, '-') &&
        !strchr(tuffCode, '*') && !strchr(tuffCode, '/') &&
        !strchr(tuffCode, '('))
    {

        // No operators or parentheses - handle simple cases

        // Numeric literal with optional type suffix (e.g. "100U8")
        long value = 0;
        int consumed = 0;
        if (sscanf(tuffCode, "%ld%n", &value, &consumed) == 1 && consumed > 0)
        {
            // Check if rest is just U8 suffix and whitespace
            const char *rest = tuffCode + consumed;
            while (*rest && isspace((unsigned char)*rest))
                rest++;
            if (strncmp(rest, "U8", 2) == 0 || rest[0] == '\0')
            {
                return emit_main_return(value);
            }
        }

        // Default: return 0
        return emit_main_return(0);
    }

    // Parse expression with operators
    Parser parser;
    parser.pos = tuffCode;
    parser.read_count = 0;

    char *expr = parse_expr(&parser);
    int num_reads = parser.read_count;

    if (num_reads == 0)
    {
        // Expression with no reads - generate C code to evaluate it
        char buffer[512];
        snprintf(buffer, sizeof(buffer),
                 "#define _CRT_SECURE_NO_WARNINGS\n"
                 "#include <stdio.h>\n"
                 "int main(void){return ((int)(%s));}\n",
                 expr);
        free(expr);
        return alloc_string(buffer);
    }

    // Generate C code with multiple reads and expression
    char buffer[2048];
    char *pos = buffer;

    // Header
    pos += snprintf(pos, sizeof(buffer) - (pos - buffer),
                    "#define _CRT_SECURE_NO_WARNINGS\n"
                    "#include <stdio.h>\n"
                    "int main(void){unsigned char ");

    // Declare variables
    for (int i = 0; i < num_reads; i++)
    {
        if (i > 0)
            pos += snprintf(pos, sizeof(buffer) - (pos - buffer), ",");
        pos += snprintf(pos, sizeof(buffer) - (pos - buffer), "v%d", i);
    }

    // Initialize and read
    pos += snprintf(pos, sizeof(buffer) - (pos - buffer), "=0;");
    for (int i = 0; i < num_reads; i++)
    {
        pos += snprintf(pos, sizeof(buffer) - (pos - buffer), "scanf(\"%%hhu\",&v%d);", i);
    }

    // Return expression
    pos += snprintf(pos, sizeof(buffer) - (pos - buffer), "return (%s);}\n", expr);

    free(expr);
    return alloc_string(buffer);
}

/**
 * Compiles Tuff code, writes to temp .c file, compiles with clang, and executes
 * @param tuffCode The Tuff source code to compile (null-terminated)
 * @param stdIn    String to feed as stdin to the process, or NULL for none
 * @return The exit code of the executed binary, or negative on error
 */
int execute(const char *tuffCode, const char *stdIn)
{
    // Compile Tuff to C
    char *cCode = compileTuffToC(tuffCode);
    if (cCode == NULL)
    {
        return -1;
    }

    // Generate temp file names
    char tmpBase[L_tmpnam];
    char srcFileName[L_tmpnam + 2]; // +2 for ".c"
    char exeFileName[L_tmpnam + 4]; // +4 for ".exe"

    if (tmpnam(tmpBase) == NULL)
    {
        free(cCode);
        return -1;
    }
    snprintf(srcFileName, sizeof(srcFileName), "%s.c", tmpBase);

    if (tmpnam(tmpBase) == NULL)
    {
        free(cCode);
        return -1;
    }
    snprintf(exeFileName, sizeof(exeFileName), "%s.exe", tmpBase);

    // Write C code to temp file
    FILE *srcFile = fopen(srcFileName, "w");
    if (srcFile == NULL)
    {
        free(cCode);
        return -1;
    }

    fprintf(srcFile, "%s", cCode);
    fclose(srcFile);
    free(cCode);

    // Compile with clang using pedantic flags
    char compileCmd[512];
    snprintf(compileCmd, sizeof(compileCmd), "clang -Wall -Wextra -Wpedantic -Werror \"%s\" -o \"%s\"", srcFileName, exeFileName);
    int compileResult = system(compileCmd);

    if (compileResult != 0)
    {
        remove(srcFileName);
        return -1; // Compilation failed
    }

    // Execute the compiled binary, optionally piping stdIn
    char execCmd[1024];
    if (stdIn != NULL)
    {
        snprintf(execCmd, sizeof(execCmd), "echo %s | %s", stdIn, exeFileName);
    }
    else
    {
        snprintf(execCmd, sizeof(execCmd), "%s", exeFileName);
    }
    int exitCode = system(execCmd);

    // Clean up temp files
    remove(srcFileName);
    remove(exeFileName);

    return exitCode;
}
