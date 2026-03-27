#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "interpretTuff.h"

static int assert_result(
    const char *name,
    Result got,
    int expected_ok,
    unsigned long long expected_uvalue,
    long long expected_svalue,
    int expected_is_unsigned,
    const char *expected_error)
{
    if (got.ok != expected_ok)
    {
        fprintf(stderr, "%s failed: ok=%d expected %d\n", name, got.ok, expected_ok);
        return 0;
    }

    if (got.uvalue != expected_uvalue)
    {
        fprintf(stderr, "%s failed: uvalue=%llu expected %llu\n", name, got.uvalue, expected_uvalue);
        return 0;
    }

    if (got.svalue != expected_svalue)
    {
        fprintf(stderr, "%s failed: svalue=%lld expected %lld\n", name, got.svalue, expected_svalue);
        return 0;
    }

    if (got.is_unsigned != expected_is_unsigned)
    {
        fprintf(stderr, "%s failed: is_unsigned=%d expected %d\n", name, got.is_unsigned, expected_is_unsigned);
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
        unsigned long long expected_uvalue;
        long long expected_svalue;
        int expected_is_unsigned;
        const char *expected_error;
    } TestCase;

    const TestCase cases[] = {
        {"valid U8", "100U8", 1, 100ULL, 100LL, 1, NULL},
        {"valid U16", "65535U16", 1, 65535ULL, 65535LL, 1, NULL},
        {"valid U32", "4294967295U32", 1, 4294967295ULL, 4294967295LL, 1, NULL},
        {"valid U64", "18446744073709551615U64", 1, 18446744073709551615ULL, -1LL, 1, NULL},
        {"valid I8", "-5I8", 1, 18446744073709551611ULL, -5LL, 0, NULL},
        {"valid I16", "32767I16", 1, 32767ULL, 32767LL, 0, NULL},
        {"valid I32", "-2147483648I32", 1, 18446744071562067968ULL, -2147483648LL, 0, NULL},
        {"valid I64", "9223372036854775807I64", 1, 9223372036854775807ULL, 9223372036854775807LL, 0, NULL},
        {"valid expression spaced", "100U8 + 50U8", 1, 150ULL, 150LL, 1, NULL},
        {"valid expression compact", "100U8+50U8", 1, 150ULL, 150LL, 1, NULL},
        {"valid expression chain", "1U8 + 2U8 + 3U8", 1, 6ULL, 6LL, 1, NULL},
        {"mixed promote signed", "100U8 + 10I16", 1, 110ULL, 110LL, 0, NULL},
        {"mixed promote unsigned", "1I32 + 1U32", 1, 2ULL, 2LL, 1, NULL},
        {"empty input", "", 0, 0ULL, 0LL, 0, "empty input"},
        {"missing suffix", "100", 0, 0ULL, 0LL, 0, "invalid suffix"},
        {"lowercase suffix", "100u8", 0, 0ULL, 0LL, 0, "invalid suffix"},
        {"non-digit", "10aU8", 0, 0ULL, 0LL, 0, "invalid digits"},
        {"unsigned negative", "-1U8", 0, 0ULL, 0LL, 0, "invalid digits"},
        {"u8 out of range", "256U8", 0, 0ULL, 0LL, 0, "value out of range"},
        {"i8 out of range", "128I8", 0, 0ULL, 0LL, 0, "value out of range"},
        {"sum out of range", "200U8 + 100U8", 0, 0ULL, 0LL, 0, "value out of range"},
        {"missing rhs term", "100U8 +", 0, 0ULL, 0LL, 0, "expected term"},
        {"invalid operator", "100U8 - 50U8", 0, 0ULL, 0LL, 0, "invalid operator"},        {"let assignment simple", "let x: U8 = 100U8; x", 1, 100ULL, 100LL, 1, NULL},
        {"let assignment spaced", "let x : I32 = -50I32 ; x", 1, 18446744073709551566ULL, -50LL, 0, NULL},
        {"let zero trailing expr", "let x: I8 = 10I8;", 1, 0ULL, 0LL, 1, NULL}, 
        {"let variable shadow", "let x: U8 = 10U8; let x: I16 = 20I16; x", 1, 20ULL, 20LL, 0, NULL},
        {"let var chain", "let x: U8 = 10U8; let y: U16 = 20U16; x + y", 1, 30ULL, 30LL, 1, NULL},
        {"let valid map size up", "let x: U16 = 200U8; x", 1, 200ULL, 200LL, 1, NULL},
        {"let valid map unsigned to signed", "let x: I16 = 200U8; x", 1, 200ULL, 200LL, 0, NULL},
        {"let type mismatch string", "let x: U8 = 256U16; x", 0, 0ULL, 0LL, 0, "type mismatch"},
        {"let type mismatch lossy sign", "let x: U16 = 5I8; x", 0, 0ULL, 0LL, 0, "type mismatch"},
        {"let type mismatch size to signed", "let x: I8 = 200U8; x", 0, 0ULL, 0LL, 0, "type mismatch"},
        {"let missing semicolon", "let x: U8 = 1U8 x", 0, 0ULL, 0LL, 0, "invalid operator"},
        {"let missing equals", "let x: U8 1U8;", 0, 0ULL, 0LL, 0, "invalid operator"},
        {"let missing colon", "let x U8 = 1U8;", 0, 0ULL, 0LL, 0, "invalid operator"},
        {"let undefined variable", "let x: U8 = 1U8; y", 0, 0ULL, 0LL, 0, "unresolved variable"},
        {"let self-referential failure", "let x: U8 = x;", 0, 0ULL, 0LL, 0, "unresolved variable"},    };
    size_t case_count = sizeof(cases) / sizeof(cases[0]);
    size_t i = 0;

    passed &= assert_result("null input", interpretTuff(NULL), 0, 0ULL, 0LL, 0, "null input");
    for (i = 0; i < case_count; i++)
    {
        passed &= assert_result(
            cases[i].name,
            interpretTuff(cases[i].input),
            cases[i].expected_ok,
            cases[i].expected_uvalue,
            cases[i].expected_svalue,
            cases[i].expected_is_unsigned,
            cases[i].expected_error);
    }

    if (!passed)
    {
        return EXIT_FAILURE;
    }

    printf("All interpretTuff tests passed.\n");
    return EXIT_SUCCESS;
}
