#include "tuff_runtime.h"

#include <stdio.h>
#include <stdlib.h>

void tuff_panic(const char *message)
{
    if (message != NULL)
    {
        fprintf(stderr, "tuff panic: %s\n", message);
    }
    else
    {
        fprintf(stderr, "tuff panic\n");
    }
    abort();
}
