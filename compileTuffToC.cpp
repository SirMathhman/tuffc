#define _CRT_SECURE_NO_WARNINGS
#include "compileTuffToC.h"
#include <stdio.h>
#include <string.h>

/**
 * Compiles Tuff code to C code
 * @param tuffCode The Tuff source code to compile (null-terminated)
 * @return The compiled C code as a string (caller must free)
 */
char *compileTuffToC(const char *tuffCode)
{
    (void)tuffCode; // TODO: Implement Tuff to C compilation logic
    const char *stub = "int main(void) { return 0; }\n";
    char *result = (char *)malloc(strlen(stub) + 1);
    strcpy(result, stub);
    return result;
}

/**
 * Compiles Tuff code, writes to temp .c file, compiles with clang, and executes
 * @param tuffCode The Tuff source code to compile (null-terminated)
 * @return The exit code of the executed binary, or negative on error
 */
int execute(const char *tuffCode)
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

    // Execute the compiled binary
    char execCmd[512];
    snprintf(execCmd, sizeof(execCmd), "\"%s\"", exeFileName);
    int exitCode = system(execCmd);

    // Clean up temp files
    remove(srcFileName);
    remove(exeFileName);

    return exitCode;
}
