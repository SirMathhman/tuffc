#include "common.h"
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
int32_t passingTests = 0;
int32_t totalTests = 0;

// We do one assert per test anyways
void assertValid(char *testName, char *source, int32_t expectedExitCode, int32_t argc, char **argv)
{
    CompileResult result = compile(source);
    if (result.variant == CompileErrorVariant)
    {
        fprintf(stderr, "Test %s failed: compilation error\n", testName);
        fprintf(stderr, "Erroneous code:\n%s\n", result.error.erroneous_code);
        fprintf(stderr, "Error message:\n%s\n", result.error.error_message);
        fprintf(stderr, "Reasoning:\n%s\n", result.error.reasoning);
        fprintf(stderr, "Fix:\n%s\n", result.error.fix);
        return;
    }

    // Generate temp file names
    char temp_header[] = "temp_test_header_XXXXXX.h";
    char temp_source[] = "temp_test_source_XXXXXX.c";
    char temp_exe[] = "temp_test_exe_XXXXXX.exe";

    // Write header file
    FILE *hf = safe_fopen(temp_header, "w");
    if (!hf)
    {
        fprintf(stderr, "Test %s failed: could not create temp header file\n", testName);
        totalTests++;
        return;
    }
    fwrite(result.output.headerCCode, 1, strlen(result.output.headerCCode), hf);
    fclose(hf);

    // Write source file
    FILE *sf = safe_fopen(temp_source, "w");
    if (!sf)
    {
        fprintf(stderr, "Test %s failed: could not create temp source file\n", testName);
        remove(temp_header);
        totalTests++;
        return;
    }
    fwrite(result.output.targetCCode, 1, strlen(result.output.targetCCode), sf);
    fclose(sf);

    // Compile with clang
    char compile_cmd[512];
    snprintf(compile_cmd, sizeof(compile_cmd), "clang -o %s %s 2>nul", temp_exe, temp_source);
    int compile_status = system(compile_cmd);
    if (compile_status != 0)
    {
        fprintf(stderr, "Test %s failed: clang compilation failed\n", testName);
        remove(temp_header);
        remove(temp_source);
        totalTests++;
        return;
    }

    // Execute binary and capture exit code
    char exec_cmd[256];
    snprintf(exec_cmd, sizeof(exec_cmd), "%s", temp_exe);
    int32_t actualExitCode = system(exec_cmd);

    // Clean up temp files
    remove(temp_header);
    remove(temp_source);
    remove(temp_exe);

    if (actualExitCode != expectedExitCode)
    {
        fprintf(stderr, "Test %s failed: expected exit code %d, got %d\n", testName, expectedExitCode, actualExitCode);
    }
    else
    {
        passingTests++;
    }
    totalTests++;
}

void assertInvalid(char *testName, char *source)
{
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
    totalTests++;
}

void testEmptyProgram()
{
    assertValid("An empty program", "", 0, 0, NULL);
}

void testUndefinedValue()
{
    assertInvalid("An undefined value", "undefinedValue");
}

int32_t main()
{
    testEmptyProgram();
    testUndefinedValue();

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