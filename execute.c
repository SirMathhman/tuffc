#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <errno.h>
#include <stdint.h>
#include <stdbool.h>

// External function declaration
extern char *compile(const char *input);

// Execute function: compiles input, writes to temp .c file, compiles with clang,
// and returns the exit code of the clang process.
int execute(const char *input)
{
    if (!input)
    {
        return -1;
    }

    // Call compile to get the compiled output
    char *compiled = compile(input);
    if (!compiled)
    {
        return -1;
    }

    // Create a temporary .c file in the current directory
    char temp_c_file[256];
    snprintf(temp_c_file, sizeof(temp_c_file), "tuffc_temp_%d.c", rand());

    // Write compiled output to the temp file
    FILE *f;
    errno_t err = fopen_s(&f, temp_c_file, "w");
    if (err != 0 || !f)
    {
        free(compiled);
        return -1;
    }

    fprintf(f, "%s", compiled);
    fclose(f);

    // Compile with clang
    char clang_cmd[512];
    char temp_exe[256];
    snprintf(temp_exe, sizeof(temp_exe), "tuffc_temp_%d.exe", rand());
    snprintf(clang_cmd, sizeof(clang_cmd), "clang %s -o %s", temp_c_file, temp_exe);

    int compile_exit = system(clang_cmd);

    // If compilation failed, clean up and return error
    if (compile_exit != 0)
    {
        remove(temp_c_file);
        free(compiled);
        return compile_exit;
    }

    // Run the compiled executable and capture its exit code
    int exec_exit = system(temp_exe);

    // Clean up temporary files
    remove(temp_c_file);
    remove(temp_exe);

    free(compiled);

    return exec_exit;
}