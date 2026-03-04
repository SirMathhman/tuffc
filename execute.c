#include <stdlib.h>
#include <stdio.h>
#include <string.h>

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
    FILE *f = fopen(temp_c_file, "w");
    if (!f)
    {
        free(compiled);
        return -1;
    }

    fprintf(f, "%s", compiled);
    fclose(f);

    // Compile with clang
    char clang_cmd[512];
    char temp_obj[256];
    snprintf(temp_obj, sizeof(temp_obj), "tuffc_temp_%d.obj", rand());
    snprintf(clang_cmd, sizeof(clang_cmd), "clang -c %s -o %s", temp_c_file, temp_obj);

    int exit_code = system(clang_cmd);

    // Clean up temporary files
    remove(temp_c_file);
    remove(temp_obj);

    free(compiled);

    return exit_code;
}
