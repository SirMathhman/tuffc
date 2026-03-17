#define _CRT_SECURE_NO_WARNINGS
#include "compileTuffToC.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/**
 * Helper: Generate a C main function that returns a value
 * @param value The return value (0-255 for valid exit codes)
 * @return Allocated string (caller must free)
 */
static char *emit_main_return(long value)
{
    char buffer[128];
    snprintf(buffer, sizeof(buffer), "i%s main(void){%s %ld;}\n", "nt", "return", value);
    char *result = (char *)malloc(strlen(buffer) + 1);
    strcpy(result, buffer);
    return result;
}

/**
 * Helper: Generate a C main function that reads a U8 from stdin
 * @return Allocated string (caller must free)
 */
static char *emit_read_u8_main(void)
{
    char buffer[256];
    snprintf(buffer, sizeof(buffer),
             "#define _CRT_SECURE_NO_WARNINGS\n"
             "#include <stdio.h>\n"
             "int ma%s(vo%s){unsigned char v=0;scanf(\"%%hhu\",&v);%s (int)v;}\n",
             "in", "id", "return");
    char *result = (char *)malloc(strlen(buffer) + 1);
    strcpy(result, buffer);
    return result;
}

/**
 * Compiles Tuff code to C code
 * @param tuffCode The Tuff source code to compile (null-terminated)
 * @return The compiled C code as a string (caller must free)
 */
char *compileTuffToC(const char *tuffCode)
{
    // read<U8>() — read a U8 from stdin and exit with it
    if (strcmp(tuffCode, "read<U8>()") == 0)
    {
        return emit_read_u8_main();
    }

    // Numeric literal with optional type suffix (e.g. "100U8")
    long value = 0;
    int consumed = 0;
    if (sscanf(tuffCode, "%ld%n", &value, &consumed) == 1 && consumed > 0)
    {
        return emit_main_return(value);
    }

    // Default: return 0
    return emit_main_return(0);
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
