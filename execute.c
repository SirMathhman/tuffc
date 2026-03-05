#define _CRT_SECURE_NO_WARNINGS
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <errno.h>
#include <stdint.h>
#include <stdbool.h>

// External function declaration
extern char *compile(const char *input);

// Helper: Write content to a file. Returns 0 on success, -1 on failure.
static int write_file(const char *filename, const char *content)
{
    FILE *f;
    errno_t err = fopen_s(&f, filename, "w");
    if (err != 0 || !f)
        return -1;
    fprintf(f, "%s", content);
    fclose(f);
    return 0;
}

// Helper: Compile C code to executable. Returns compile exit code (0 = success).
// Caller is responsible for freeing temp_c_file and temp_exe.
static int compile_code(const char *temp_c_file, const char *temp_exe,
                        const char *compiled_code)
{
    // Write compiled C code to temp file
    if (write_file(temp_c_file, compiled_code) != 0)
        return -1;

    // Compile with clang (quote paths for spaces)
    char clang_cmd[1024];
    snprintf(clang_cmd, sizeof(clang_cmd), "clang -Werror \"%s\" -o \"%s\"", temp_c_file, temp_exe);
    int compile_exit = system(clang_cmd);

    return compile_exit;
}

// Internal implementation: compile, run, and return exit code.
// If stdin_data is non-NULL, pipe it to the executable.
static int execute_impl(const char *input, const char *stdin_data)
{
    char *compiled = compile(input);
    if (!compiled)
        return -1;

    char temp_c_file[512];
    char temp_exe[512];
    const char *tmpdir = getenv("TEMP");
    if (!tmpdir || tmpdir[0] == '\0')
        tmpdir = getenv("TMP");
    if (!tmpdir || tmpdir[0] == '\0')
        tmpdir = ".";
    int rnd = rand();
    snprintf(temp_c_file, sizeof(temp_c_file), "%s\\tuffc_temp_%d.c", tmpdir, rnd);
    snprintf(temp_exe, sizeof(temp_exe), "%s\\tuffc_temp_%d.exe", tmpdir, rnd);

    int compile_exit = compile_code(temp_c_file, temp_exe, compiled);
    if (compile_exit != 0)
    {
        remove(temp_c_file);
        free(compiled);
        return compile_exit;
    }

    int exec_exit;
    if (stdin_data != NULL)
    {
        char stdin_file[512];
        snprintf(stdin_file, sizeof(stdin_file), "%s\\tuffc_stdin_%d.txt", tmpdir, rand());
        if (write_file(stdin_file, stdin_data) != 0)
        {
            remove(temp_c_file);
            remove(temp_exe);
            free(compiled);
            return -1;
        }
        char exec_cmd[1024];
        // On Windows, cmd.exe /c strips the outermost quotes when the command
        // string starts and ends with ". Wrap in "cmd /c "..."" so the inner
        // cmd.exe correctly receives ""exe" < "stdin"" and strips only those.
        snprintf(exec_cmd, sizeof(exec_cmd), "cmd /c \"\"%s\" < \"%s\"\"", temp_exe, stdin_file);
        exec_exit = system(exec_cmd);
        remove(stdin_file);
    }
    else
    {
        char exec_cmd[1024];
        snprintf(exec_cmd, sizeof(exec_cmd), "\"%s\"", temp_exe);
        exec_exit = system(exec_cmd);
    }

    remove(temp_c_file);
    remove(temp_exe);
    free(compiled);
    return exec_exit;
}

// Returns a heap-allocated string of the generated C code for the given input.
// Caller must free the returned pointer. Returns NULL on failure.
char *get_generated_code(const char *input)
{
    if (!input)
        return NULL;
    return compile(input);
}

// Execute function: compiles input, writes to temp .c file, compiles with clang,
// and returns the exit code of the clang process.
int execute(const char *input)
{
    if (!input)
        return -1;
    return execute_impl(input, NULL);
}

// Execute with stdin: compiles input, writes to temp, compiles with clang,
// pipes stdin to executable, and returns the exit code
int execute_with_stdin(const char *input, const char *stdin_data)
{
    if (!input || !stdin_data)
        return -1;
    return execute_impl(input, stdin_data);
}