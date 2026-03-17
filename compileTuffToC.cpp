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
    // TODO: Implement Tuff to C compilation logic
    char *result = (char *)malloc(1);
    result[0] = '\0';
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
    char srcFileName[L_tmpnam];
    char exeFileName[L_tmpnam];

    if (tmpnam(srcFileName) == NULL || tmpnam(exeFileName) == NULL)
    {
        free(cCode);
        return -1;
    }

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

    // Compile with clang
    char compileCmd[512];
    snprintf(compileCmd, sizeof(compileCmd), "clang \"%s\" -o \"%s.exe\"", srcFileName, exeFileName);
    int compileResult = system(compileCmd);

    if (compileResult != 0)
    {
        remove(srcFileName);
        return -1; // Compilation failed
    }

    // Execute the compiled binary
    char execCmd[512];
    snprintf(execCmd, sizeof(execCmd), "\"%s.exe\"", exeFileName);
    int exitCode = system(execCmd);

    // Clean up temp files
    remove(srcFileName);
    char exeToRemove[L_tmpnam + 5];
    snprintf(exeToRemove, sizeof(exeToRemove), "%s.exe", exeFileName);
    remove(exeToRemove);

    return exitCode;
}
