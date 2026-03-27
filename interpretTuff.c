#include <ctype.h>
#include <stddef.h>

#include "interpretTuff.h"

Result interpretTuff(const char *source)
{
    Result error = {0, 0, NULL};
    int value = 0;
    size_t i = 0;

    if (source == NULL)
    {
        error.error = "null input";
        return error;
    }

    if (source[0] == '\0')
    {
        error.error = "empty input";
        return error;
    }

    while (source[i] != '\0')
    {
        i++;
    }

    if (i < 3 || source[i - 2] != 'U' || source[i - 1] != '8')
    {
        error.error = "missing U8 suffix";
        return error;
    }

    for (size_t j = 0; j < i - 2; j++)
    {
        if (!isdigit((unsigned char)source[j]))
        {
            error.error = "invalid digits";
            return error;
        }

        value = (value * 10) + (source[j] - '0');
        if (value > 255)
        {
            error.error = "value out of range";
            return error;
        }
    }

    return (Result){1, value, NULL};
}
