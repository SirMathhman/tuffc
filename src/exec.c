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

// Error reporting helper
static void report_error(const char *msg)
{
    fprintf(stderr, "%s\n", msg);
}

int32_t main()
{
    char *source = NULL;
    long source_size = 0;
    FILE *source_file = safe_fopen("main.tuff", "rb");

    do
    {
        if (source_file == NULL)
        {
            report_error("Failed to open");
            break;
        }
        if (fseek(source_file, 0, SEEK_END) != 0)
        {
            report_error("Failed to seek");
            break;
        }
        source_size = ftell(source_file);
        if (source_size < 0)
        {
            report_error("Failed to get size");
            break;
        }
        if (fseek(source_file, 0, SEEK_SET) != 0)
        {
            report_error("Failed to rewind");
            break;
        }
        source = (char *)malloc((size_t)source_size + 1);
        if (source == NULL)
        {
            report_error("Failed to allocate");
            break;
        }
        size_t read_count = fread(source, 1, (size_t)source_size, source_file);
        fclose(source_file);
        source_file = NULL;
        if (read_count != (size_t)source_size)
        {
            report_error("Failed to read");
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
        if (write_file("main.h", result.output.headerCCode) != 0 || write_file("main.c", result.output.targetCCode) != 0)
            return 1;
        return 0;
    } while (0);

    if (source_file)
        fclose(source_file);
    return 1;
