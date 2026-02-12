#include "run.h"
#include <stddef.h>

int32_t passingTests = 0;
int32_t totalTests = 0;

// We do one assert per test anyways
void assertValid(char *testName, char *source, int32_t expectedExitCode, int32_t argc, char **argv)
{
    CompileResult result = compile(source);
    if (result.variant == CompileErrorVariant)
    {
        printf("Test %s failed: compilation error\n", testName);
        printf("Erroneous code:\n%s\n", result.error.erroneous_code);
        printf("Error message:\n%s\n", result.error.error_message);
        printf("Reasoning:\n%s\n", result.error.reasoning);
        printf("Fix:\n%s\n", result.error.fix);
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
        printf("Test %s failed: expected exit code %d, got %d\n", testName, expectedExitCode, actualExitCode);
    }
    else
    {
        printf("Test %s passed\n", testName);
        passingTests++;
    }
    totalTests++;
}

void assertError(char *testName, char *source)
{
    CompileResult result = compile(source);
    if (result.variant == OutputVariant)
    {
        printf("Test %s failed: expected compilation error, got output\n", testName);
        printf("Header C code:\n%s\n", result.output.headerCCode);
        printf("Target C code:\n%s\n", result.output.targetCCode);
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

    printf("Passed %d/%d tests\n", passingTests, totalTests);

    if (passingTests == totalTests)
    {
        printf("All tests passed!\n");
        return 0;
    }
    else
    {
        printf("Some tests failed.\n");
        return 1;
    }
}