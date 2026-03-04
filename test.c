#include <assert.h>
#include <stdio.h>

extern int execute(const char *input);

typedef struct
{
    const char *input;
    int expected;
} ValidCase;
typedef struct
{
    const char *input;
} ErrorCase;

int main(void)
{
    static const ValidCase valid[] = {
        {"", 0},
        {"0U8", 0},
        {"1U8", 1},
        {"100U8", 100},
        {"255U8", 255},
        {"-128I8", -128},
        {"-50I8", -50},
        {"0I8", 0},
        {"127I8", 127},
        {"256U16", 256},
        {"65535U16", 65535},
        {"-32768I16", -32768},
        {"32767I16", 32767},
    };
    static const ErrorCase errors[] = {
        {"256U8"},
        {"300U8"},
        {"-1U8"},
        {"128I8"},
        {"-129I8"},
        {"100X8"},
        {"50Y16"},
        {"U8"},
        {"100"},
    };

    for (int i = 0; i < (int)(sizeof valid / sizeof valid[0]); i++)
    {
        int result = execute(valid[i].input);
        assert(result == valid[i].expected);
        printf("✓ Test passed: execute(\"%s\") == %d\n", valid[i].input, valid[i].expected);
    }
    for (int i = 0; i < (int)(sizeof errors / sizeof errors[0]); i++)
    {
        int result = execute(errors[i].input);
        assert(result != 0);
        printf("✓ Test passed: execute(\"%s\") produces compile error\n", errors[i].input);
    }

    printf("\n✓✓✓ All tests passed! ✓✓✓\n");
    return 0;
}
