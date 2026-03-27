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

    passed &= assert_result("valid 100U8", interpretTuff("100U8"), 1, 100, NULL);
    passed &= assert_result("valid expression spaced", interpretTuff("100U8 + 50U8"), 1, 150, NULL);
    passed &= assert_result("valid expression compact", interpretTuff("100U8+50U8"), 1, 150, NULL);
    passed &= assert_result("valid expression chain", interpretTuff("1U8 + 2U8 + 3U8"), 1, 6, NULL);
    passed &= assert_result("null input", interpretTuff(NULL), 0, 0, "null input");
    passed &= assert_result("empty input", interpretTuff(""), 0, 0, "empty input");
    passed &= assert_result("missing suffix", interpretTuff("100"), 0, 0, "missing U8 suffix");
    passed &= assert_result("lowercase suffix", interpretTuff("100u8"), 0, 0, "missing U8 suffix");
    passed &= assert_result("non-digit", interpretTuff("10aU8"), 0, 0, "invalid digits");
    passed &= assert_result("out of range", interpretTuff("256U8"), 0, 0, "value out of range");
    passed &= assert_result("sum out of range", interpretTuff("200U8 + 100U8"), 0, 0, "value out of range");
    passed &= assert_result("missing rhs term", interpretTuff("100U8 +"), 0, 0, "expected term");
    passed &= assert_result("invalid operator", interpretTuff("100U8 - 50U8"), 0, 0, "invalid operator");

    if (!passed)
    {
        return EXIT_FAILURE;
    }

    printf("All interpretTuff tests passed.\n");
    return EXIT_SUCCESS;
}
