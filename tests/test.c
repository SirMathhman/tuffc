#include "../src/common.h"
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

// String constants to avoid duplication
static const char *const MSG_TEMP_FAIL = "Test %s failed: could not create temp %s\n";
static const char *const MSG_GENERATED_CODE = "Generated C code:\n%s\n";
static const char *const MSG_EXIT_CODE_MISMATCH = "Test %s failed: expected exit code %d, got %d\n";
static const char *const MSG_EXPECTED_COMPILE_ERROR = "Test %s failed: wanted compilation error, got output\n";

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
        fprintf(stderr, MSG_TEMP_FAIL, testName, "header file");
        return 1;
    }
    fwrite(header, 1, strlen(header), hf);
    fclose(hf);

    FILE *sf = safe_fopen(temp_source, "w");
    if (!sf)
    {
        fprintf(stderr, MSG_TEMP_FAIL, testName, "source file");
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
        fprintf(stderr, MSG_GENERATED_CODE, generated_code);
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
        fprintf(stderr, MSG_EXIT_CODE_MISMATCH, testName, expectedExitCode, actualExitCode);
        fprintf(stderr, MSG_GENERATED_CODE, generated_code);
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
        fprintf(stderr, MSG_TEMP_FAIL, testName, "stdin file");
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
        fprintf(stderr, MSG_EXPECTED_COMPILE_ERROR, testName);
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
    assertValid("empty", "", 0, "", 0, NULL);
}

void testNumericLiteral()
{
    assertValid("hundred", "100", 100, "", 0, NULL);
}

void testU8Literal()
{
    assertValid("u8_hundred", "100U8", 100, "", 0, NULL);
}

void testNegativeU8Literal()
{
    assertInvalid("negative_u8", "-100U8");
}

void testU8OutOfRange()
{
    assertInvalid("u8_out_of_range", "256U8");
}

void testReadU8()
{
    assertValid("read<U8>()", "read<U8>()", 100, "100", 0, NULL);
}

void testBinaryAddition()
{
    assertValid("read_add", "read<U8>() + read<U8>()", 100, "25 75", 0, NULL);
}

void testVarDeclaration()
{
    assertValid("var_decl", "let y : U8 = read<U8>(); y + y", 50, "25", 0, NULL);
}

void testVariableMutation()
{
    assertValid("var_mutation", "let mut x : U8 = read<U8>(); x = read<U8>(); x", 75, "25 75", 0, NULL);
}

int32_t main()
{
    testEmptyProgram();
    testNumericLiteral();
    testU8Literal();
    testNegativeU8Literal();
    testU8OutOfRange();
    testReadU8();
    testBinaryAddition();
    testVarDeclaration();
    testVariableMutation();

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