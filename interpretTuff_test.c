#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "interpretTuff.h"

static int assert_result(
    const char *name,
    Result got,
    int expected_ok,
    int expected_value,
    const char *expected_error)
{
    if (got.ok != expected_ok)
    {
        fprintf(stderr, "%s failed: ok=%d expected %d\n", name, got.ok, expected_ok);
        return 0;
    }

    if (got.value != expected_value)
    {
        fprintf(stderr, "%s failed: value=%d expected %d\n", name, got.value, expected_value);
        return 0;
    }

    if (expected_error == NULL)
    {
        if (got.error != NULL)
        {
            fprintf(stderr, "%s failed: error='%s' expected NULL\n", name, got.error);
            return 0;
        }
    }
    else
    {
        if (got.error == NULL || strcmp(got.error, expected_error) != 0)
        {
            fprintf(stderr, "%s failed: error='%s' expected '%s'\n", name, got.error ? got.error : "(null)", expected_error);
            return 0;
        }
    }

    return 1;
}

int main(void)
{
    int passed = 1;
    typedef struct TestCase
    {
        const char *name;
        const char *input;
        int expected_ok;
        int expected_value;
        const char *expected_error;
    } TestCase;

    const TestCase cases[] = {
        {"valid 100U8", "100U8", 1, 100, NULL},
        {"valid expression spaced", "100U8 + 50U8", 1, 150, NULL},
        {"valid expression compact", "100U8+50U8", 1, 150, NULL},
        {"valid expression chain", "1U8 + 2U8 + 3U8", 1, 6, NULL},
        {"empty input", "", 0, 0, "empty input"},
        {"missing suffix", "100", 0, 0, "missing U8 suffix"},
        {"lowercase suffix", "100u8", 0, 0, "missing U8 suffix"},
        {"non-digit", "10aU8", 0, 0, "invalid digits"},
        {"out of range", "256U8", 0, 0, "value out of range"},
        {"sum out of range", "200U8 + 100U8", 0, 0, "value out of range"},
        {"missing rhs term", "100U8 +", 0, 0, "expected term"},
        {"invalid operator", "100U8 - 50U8", 0, 0, "invalid operator"},
    };
    size_t case_count = sizeof(cases) / sizeof(cases[0]);
    size_t i = 0;

    passed &= assert_result("null input", interpretTuff(NULL), 0, 0, "null input");
    for (i = 0; i < case_count; i++)
    {
        passed &= assert_result(
            cases[i].name,
            interpretTuff(cases[i].input),
            cases[i].expected_ok,
            cases[i].expected_value,
            cases[i].expected_error);
    }

    if (!passed)
    {
        return EXIT_FAILURE;
    }

    printf("All interpretTuff tests passed.\n");
    return EXIT_SUCCESS;
}
