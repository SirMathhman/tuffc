#include <ctype.h>
#include <stddef.h>

#include "interpretTuff.h"

Result interpretTuff(const char *source)
{
    Result error = {0, 0, NULL};
    int total = 0;
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
        int term = 0;
        int has_digit = 0;

        while (isspace((unsigned char)source[i]))
        {
            i++;
        }

        if (source[i] == '\0')
        {
            if (total == 0)
            {
                error.error = "empty input";
            }
            else
            {
                error.error = "expected term";
            }
            return error;
        }

        while (isdigit((unsigned char)source[i]))
        {
            has_digit = 1;
            term = (term * 10) + (source[i] - '0');
            if (term > 255)
            {
                error.error = "value out of range";
                return error;
            }
            i++;
        }

        if (!has_digit)
        {
            error.error = "expected term";
            return error;
        }

        if (source[i] != 'U' || source[i + 1] != '8')
        {
            if (source[i] == 'u' && source[i + 1] == '8')
            {
                error.error = "missing U8 suffix";
            }
            else if (source[i] == '\0' || source[i] == '+' || isspace((unsigned char)source[i]))
            {
                error.error = "missing U8 suffix";
            }
            else
            {
                error.error = "invalid digits";
            }
            return error;
        }

        i += 2;

        total += term;
        if (total > 255)
        {
            error.error = "value out of range";
            return error;
        }

        while (isspace((unsigned char)source[i]))
        {
            i++;
        }

        if (source[i] == '\0')
        {
            return (Result){1, total, NULL};
        }

        if (source[i] != '+')
        {
            error.error = "invalid operator";
            return error;
        }

        i++;

        while (isspace((unsigned char)source[i]))
        {
            i++;
        }

        if (source[i] == '\0')
        {
            error.error = "expected term";
            return error;
        }
    }

    return (Result){1, total, NULL};
}
