#include "app.h"

#include <stdio.h>

int tuffc_format_greeting(const char *name, char *buffer, size_t buffer_size)
{
    if (name == NULL || buffer == NULL || buffer_size == 0U)
    {
        return -1;
    }

    return snprintf(buffer, buffer_size, "Hello, %s!", name);
}
