#include <stdio.h>
#include <stdlib.h>

int interpretTuff(const char *source);

int main(void)
{
    int result = interpretTuff("");
    if (result != 0)
    {
        fprintf(stderr, "Test failed: interpretTuff(\"\") returned %d, expected 0\n", result);
        return EXIT_FAILURE;
    }
    printf("Test passed: interpretTuff(\"\") returned 0\n");
    return EXIT_SUCCESS;
}
