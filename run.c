#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "main.h"

typedef struct
{
    char *headerCCode;
    char *targetCCode;
} Output;

typedef struct
{
    char *erroneous_code;
    char *error_message;
    char *reasoning;
    char *fix;
} CompileError;

typedef struct
{
    enum
    {
        OutputVariant,
        CompileErrorVariant,
    } variant;
    union
    {
        Output output;
        CompileError error;
    };
} CompileResult;

CompileResult compile(char* source)
{
    // TODO:

    return (CompileResult){
        .variant = OutputVariant,
        .output = {
            .headerCCode = "/* header C code */",
            .targetCCode = "/* target C code */",
        },
    };
}

int main()
{
    FILE *source_file = fopen("main.tuff", "rb");
    if (!source_file)
    {
        fprintf(stderr, "Failed to open main.tuff\n");
        return 1;
    }

    if (fseek(source_file, 0, SEEK_END) != 0)
    {
        fprintf(stderr, "Failed to seek main.tuff\n");
        fclose(source_file);
        return 1;
    }

    long source_size = ftell(source_file);
    if (source_size < 0)
    {
        fprintf(stderr, "Failed to get size of main.tuff\n");
        fclose(source_file);
        return 1;
    }

    if (fseek(source_file, 0, SEEK_SET) != 0)
    {
        fprintf(stderr, "Failed to rewind main.tuff\n");
        fclose(source_file);
        return 1;
    }

    char *source = (char *)malloc((size_t)source_size + 1);
    if (!source)
    {
        fprintf(stderr, "Failed to allocate memory for main.tuff\n");
        fclose(source_file);
        return 1;
    }

    size_t read_count = fread(source, 1, (size_t)source_size, source_file);
    fclose(source_file);
    if (read_count != (size_t)source_size)
    {
        fprintf(stderr, "Failed to read main.tuff\n");
        free(source);
        return 1;
    }
    source[source_size] = '\0';

    CompileResult result = compile(source);
    free(source);

    if (result.variant == CompileErrorVariant)
    {
        fprintf(stderr, "%s\n%s\n", result.error.error_message, result.error.reasoning);
        return 1;
    }

    FILE *header_file = fopen("main.h", "wb");
    if (!header_file)
    {
        fprintf(stderr, "Failed to open main.h for writing\n");
        return 1;
    }
    fwrite(result.output.headerCCode, 1, strlen(result.output.headerCCode), header_file);
    fclose(header_file);

    FILE *target_file = fopen("main.c", "wb");
    if (!target_file)
    {
        fprintf(stderr, "Failed to open main.c for writing\n");
        return 1;
    }
    fwrite(result.output.targetCCode, 1, strlen(result.output.targetCCode), target_file);
    fclose(target_file);

    return 0;
}
