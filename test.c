#define _CRT_SECURE_NO_WARNINGS
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

extern int execute(const char *input);

#define MAX_TESTS 100
#define MAX_INPUT 64

typedef struct
{
    char input[MAX_INPUT];
    int expected;
} ValidTest;

typedef struct
{
    char input[MAX_INPUT];
} ErrorTest;

void run_tests(void)
{
    FILE *fp = fopen("test_cases.txt", "r");
    if (!fp)
    {
        perror("Failed to open test_cases.txt");
        exit(1);
    }

    char line[256];
    int mode = 0; // 0=none, 1=valid, 2=error
    int valid_count = 0, error_count = 0;
    ValidTest valid_tests[MAX_TESTS];
    ErrorTest error_tests[MAX_TESTS];

    while (fgets(line, sizeof(line), fp))
    {
        // Strip newline
        size_t len = strlen(line);
        if (len > 0 && line[len - 1] == '\n')
            line[--len] = '\0';

        if (len == 0)
            continue; // Skip blank lines

        if (strcmp(line, "valid:") == 0)
        {
            mode = 1;
            continue;
        }
        if (strcmp(line, "error:") == 0)
        {
            mode = 2;
            continue;
        }

        if (mode == 1)
        {
            // Parse "input:expected"
            char *colon = strchr(line, ':');
            if (colon)
            {
                *colon = '\0';
                strncpy(valid_tests[valid_count].input, line, MAX_INPUT - 1);
                valid_tests[valid_count].expected = atoi(colon + 1);
                valid_count++;
            }
        }
        else if (mode == 2)
        {
            // Parse error case (just input)
            strncpy(error_tests[error_count].input, line, MAX_INPUT - 1);
            error_count++;
        }
    }
    fclose(fp);

    // CPD-OFF
    for (int i = 0; i < valid_count; i++)
    {
        int result = execute(valid_tests[i].input);
        assert(result == valid_tests[i].expected);
        printf("✓ Test passed: execute(\"%s\") == %d\n",
               valid_tests[i].input, valid_tests[i].expected);
    }
    for (int i = 0; i < error_count; i++)
    {
        int result = execute(error_tests[i].input);
        assert(result != 0);
        printf("✓ Test passed: execute(\"%s\") produces compile error\n",
               error_tests[i].input);
    }
    // CPD-ON

    printf("\n✓✓✓ All %d tests passed! ✓✓✓\n", valid_count + error_count);
}

int main(void)
{
    run_tests();
    return 0;
}
