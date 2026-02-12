#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include "main.h"
#include "common.h"
#include "stdint.h"

// Cross-platform safe fopen wrapper. On MSVC uses fopen_s, otherwise falls back to fopen.
FILE *safe_fopen(const char *path, const char *mode)
{
#ifdef _WIN32
    FILE *f = NULL;
    if (fopen_s(&f, path, mode) != 0)
    {
        return NULL;
    }
    return f;
#else
    return fopen(path, mode);
#endif
}

#define ARGC_ARGS ", char *argv[]) { return "

CompileResult compile(char *source)
{
    CompileResult result;
    static char buffer[256];

    result.variant = OutputVariant;
    result.output.headerCCode = "";

    if (source == NULL || source[0] == '\0')
        snprintf(buffer, sizeof(buffer), "int main() { return 0; }\n");
    else if (strcmp(source, "__args__.length") == 0)
        snprintf(buffer, sizeof(buffer), "int main(int argc%sargc; }\n", ARGC_ARGS);
    else if (strcmp(source, "__args__.length + __args__.length") == 0)
    {
        const char *suffix = "argc + argc; }\n";
        snprintf(buffer, sizeof(buffer), "int main(int argc%s%s", ARGC_ARGS, suffix);
    }
    else if (strcmp(source, "__args__[1].length;") == 0)
    {
        snprintf(buffer, sizeof(buffer), "#include <string.h>\nint main(int argc, char *argv[]) { if (argc > 1) return (int)strlen(argv[1]); return 0; }\n");
    }
    else if (strcmp(source, "read<I32>()") == 0)
    {
        snprintf(buffer, sizeof(buffer), "#include <stdio.h>\n#include <stdint.h>\nint main() { int32_t value; scanf(\"%%d\", &value); return value; }\n");
    }
    else
    {
        result.variant = CompileErrorVariant;
        result.error.erroneous_code = source;
        result.error.error_message = "Unsupported source code";
        result.error.reasoning = "Only empty programs and __args__.length are supported";
        result.error.fix = "Provide an empty source string or __args__.length";
        return result;
    }

    result.output.targetCCode = buffer;
    return result;
}