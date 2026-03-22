#include "app.h"

#include <stdio.h>
#include <string.h>

static void print_usage(const char *program_name)
{
    fprintf(stderr, "Usage: %s greet <name>\n", program_name);
}

int main(int argc, char **argv)
{
    char output[128];

    if (argc != 3 || strcmp(argv[1], "greet") != 0)
    {
        print_usage(argv[0]);
        return 1;
    }

    if (tuffc_format_greeting(argv[2], output, sizeof(output)) < 0)
    {
        fprintf(stderr, "Unable to format greeting.\n");
        return 2;
    }

    puts(output);
    return 0;
}
