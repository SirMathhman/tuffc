#include "common.h"
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
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

    /*
    TODO:
    write to temp file
    compile temp file using clang
    execute binary using argc, argv
    assert exit code equals expectedExitCode
    */

    int32_t actualExitCode = -1;
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

void assertError(char *testName, char *source)
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
    assertValid("Empty program", "", 0, 0, NULL);
}

int32_t main()
{
    testEmptyProgram();

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