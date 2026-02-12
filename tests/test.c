#include "../src/common.h"
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
int32_t passingTests = 0;
int32_t totalTests = 0;

static void print_compilation_error(const char *testName, CompileResult result)
{
    fprintf(stderr, "Test %s failed: compilation error\n", testName);
    fprintf(stderr, "Erroneous code:\n%s\n", result.error.erroneous_code);
    fprintf(stderr, "Error message:\n%s\n", result.error.error_message);
    fprintf(stderr, "Reasoning:\n%s\n", result.error.reasoning);
    fprintf(stderr, "Fix:\n%s\n", result.error.fix);
}

static int write_temp_files(const char *testName, char *header, char *source, char *temp_header, char *temp_source)
{
    FILE *hf = safe_fopen(temp_header, "w");
    if (!hf)
    {
        fprintf(stderr, "Test %s failed: could not create temp header file\n", testName);
        return 1;
    }
    fwrite(header, 1, strlen(header), hf);
    fclose(hf);

    FILE *sf = safe_fopen(temp_source, "w");
    if (!sf)
    {
        fprintf(stderr, "Test %s failed: could not create temp source file\n", testName);
        remove(temp_header);
        return 1;
    }
    fwrite(source, 1, strlen(source), sf);
    fclose(sf);
    return 0;
}

static void cleanup_files(char *h, char *s, char *e)
{
    remove(h);
    remove(s);
    remove(e);
}

static void cleanup_files_with_stdin(char *h, char *s, char *e, char *si)
{
    remove(h);
    remove(s);
    remove(e);
    remove(si);
}

static int assert_setup(const char *testName, const char *source, CompileResult *result)
{
    totalTests++;
    *result = compile((char *)source);
    if (result->variant == CompileErrorVariant)
    {
        print_compilation_error(testName, *result);
        return 1;
    }
    return 0;
}

static void setup_temp_files(char *temp_header, char *temp_source, char *temp_exe)
{
    snprintf(temp_header, 32, "temp_test_header_XXXXXX.h");
    snprintf(temp_source, 32, "temp_test_source_XXXXXX.c");
    snprintf(temp_exe, 32, "temp_test_exe_XXXXXX.exe");
}

static int compile_with_clang(const char *testName, char *temp_exe, char *temp_source, char *temp_header, char *generated_code)
{
    char compile_cmd[512];
    snprintf(compile_cmd, sizeof(compile_cmd), "clang -o %s %s 2>nul", temp_exe, temp_source);
    int compile_status = system(compile_cmd);
    if (compile_status != 0)
    {
        fprintf(stderr, "Test %s failed: clang compilation failed\n", testName);
        fprintf(stderr, "Generated C code:\n%s\n", generated_code);
        remove(temp_header);
        remove(temp_source);
        return 1;
    }
    return 0;
}

static void check_exit_code(const char *testName, int32_t expectedExitCode, int32_t actualExitCode, char *generated_code)
{
    if (actualExitCode != expectedExitCode)
    {
        fprintf(stderr, "Test %s failed: expected exit code %d, got %d\n", testName, expectedExitCode, actualExitCode);
        fprintf(stderr, "Generated C code:\n%s\n", generated_code);
    }
    else
    {
        passingTests++;
    }
}

// Consolidated assertion function that handles both stdin and args
void assertValid(char *testName, char *source, int32_t expectedExitCode, char *stdin_input, int32_t argc, char **argv)
{
    CompileResult result;
    if (assert_setup(testName, source, &result) != 0)
        return;

    char temp_header[32], temp_source[32], temp_exe[32];
    setup_temp_files(temp_header, temp_source, temp_exe);
    char temp_stdin[] = "temp_test_stdin_XXXXXX.txt";

    if (write_temp_files(testName, result.output.headerCCode, result.output.targetCCode, temp_header, temp_source) != 0)
        return;

    FILE *stdinf = safe_fopen(temp_stdin, "w");
    if (!stdinf)
    {
        fprintf(stderr, "Test %s failed: could not create temp stdin file\n", testName);
        cleanup_files(temp_header, temp_source, temp_exe);
        return;
    }
    if (stdin_input)
        fwrite(stdin_input, 1, strlen(stdin_input), stdinf);
    fclose(stdinf);

    if (compile_with_clang(testName, temp_exe, temp_source, temp_header, result.output.targetCCode) != 0)
    {
        remove(temp_stdin);
        return;
    }

    char exec_cmd[512];
    snprintf(exec_cmd, sizeof(exec_cmd), "%s", temp_exe);
    for (int32_t i = 0; i < argc; i++)
    {
        size_t current_len = strlen(exec_cmd);
        snprintf(exec_cmd + current_len, sizeof(exec_cmd) - current_len, " %s", argv[i]);
    }
    size_t current_len = strlen(exec_cmd);
    snprintf(exec_cmd + current_len, sizeof(exec_cmd) - current_len, " < %s", temp_stdin);
    int32_t actualExitCode = system(exec_cmd);

    cleanup_files_with_stdin(temp_header, temp_source, temp_exe, temp_stdin);
    check_exit_code(testName, expectedExitCode, actualExitCode, result.output.targetCCode);
}

void assertInvalid(char *testName, char *source)
{
    totalTests++;
    CompileResult result = compile(source);
    if (result.variant == OutputVariant)
    {
        fprintf(stderr, "Test %s failed: expected compilation error, got output\n", testName);
        fprintf(stderr, "Header C code:\n%s\n", result.output.headerCCode);
        fprintf(stderr, "Target C code:\n%s\n", result.output.targetCCode);
        return;
    }
    else
    {
        passingTests++;
    }
}

void testEmptyProgram()
{
    assertValid("An empty program", "", 0, NULL, 0, NULL);
}

void testArgsLength()
{
    assertValid("Get args length", "__args__.length", 1, NULL, 0, NULL);
}

void testArgsLengthWithArg()
{
    char *argv[] = {"foo"};
    assertValid("Get args length with one argument", "__args__.length", 2, NULL, 1, argv);
}

void testArgsLengthAddition()
{
    char *argv[] = {"foo"};
    assertValid("Add args length to itself", "__args__.length + __args__.length", 4, NULL, 1, argv);
}

void testArgsSecondArgLength()
{
    char *argv[] = {"foo"};
    assertValid("Get length of second argument", "__args__[1].length;", 3, NULL, 1, argv);
}

void testReadI32()
{
    assertValid("Read I32 from stdin", "read<I32>()", 100, "100", 0, NULL);
}

void testReadI32Addition()
{
    assertValid("Read and add two I32 values", "read<I32>() + read<I32>()", 100, "25 75", 0, NULL);
}

void testVariableAndDoubling()
{
    assertValid("Variable assignment and doubling", "let x : I32 = read<I32>(); x + x", 50, "25 75", 0, NULL);
}

void testMutableVariableAssignment()
{
    assertValid("Mutable variable assignment", "let mut x = 0; x = read<I32>(); x", 42, "42", 0, NULL);
}

void testMutableVariableDoubleRead()
{
    assertValid("Mutable variable with double read", "let mut x = read<I32>(); x = read<I32>(); x", 99, "55 99", 0, NULL);
}

void testSimpleVariableReturn()
{
    assertValid("Simple variable return", "let x : I32 = read<I32>(); x", 75, "75", 0, NULL);
}

void testReadU8PlusArgsLength()
{
    char *argv[] = {"arg1"};
    assertValid("Read U8 and add args length", "read<U8>() + __args__.length", 7, "5", 1, argv);
}

int32_t main()
{
    testEmptyProgram();
    testArgsLength();
    testArgsLengthWithArg();
    testArgsLengthAddition();
    testArgsSecondArgLength();
    testReadI32();
    testReadI32Addition();
    testVariableAndDoubling();
    testMutableVariableAssignment();
    testMutableVariableDoubleRead();
    testSimpleVariableReturn();
    testReadU8PlusArgsLength();

    fprintf(stderr, "Passed %d/%d tests\n", passingTests, totalTests);

    if (passingTests == totalTests)
    {
        fprintf(stderr, "All tests passed!\n");
        return 0;
    }
    else
    {
        fprintf(stderr, "Some tests failed.\n");
        return 1;
    }
}