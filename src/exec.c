#include "common.h"
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>

// Helper function to write content to a file
static int32_t write_file(const char *filename, const char *content)
{
    FILE *file = safe_fopen(filename, "wb");
    if (!file)
    {
        fprintf(stderr, "Failed to open %s for writing\n", filename);
        return 1;
    }
    fwrite(content, 1, strlen(content), file);
    fclose(file);
    return 0;
}

// Helper function to handle file seek errors
static void handle_file_error(FILE *file, const char *message)
{
    fprintf(stderr, "%s\n", message);
    fclose(file);
}

int32_t main()
{
    FILE *source_file = safe_fopen("main.tuff", "rb");
    if (!source_file)
    {
        fprintf(stderr, "Failed to open main.tuff\n");
        return 1;
    }

    if (fseek(source_file, 0, SEEK_END) != 0)
    {
        handle_file_error(source_file, "Failed to seek main.tuff");
        return 1;
    }

    long source_size = ftell(source_file);
    if (source_size < 0)
    {
        handle_file_error(source_file, "Failed to get size of main.tuff");
        return 1;
    }

    if (fseek(source_file, 0, SEEK_SET) != 0)
    {
        handle_file_error(source_file, "Failed to rewind main.tuff");
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

    if (write_file("main.h", result.output.headerCCode) != 0)
    {
        return 1;
    }

    if (write_file("main.c", result.output.targetCCode) != 0)
    {
        return 1;
    }

    return 0;
}
