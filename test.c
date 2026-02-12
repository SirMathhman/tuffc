#include "run.h"
#include <stddef.h>

int passingTests = 0;
int totalTests = 0;

// We do one assert per test anyways
void assertValid(char *testName, char *source, int expectedExitCode, int argc, char **argv)
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

    int actualExitCode = -1;
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

int main()
{
    return 0;
}