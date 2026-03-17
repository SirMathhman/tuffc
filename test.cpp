#include "compileTuffToC.h"
#include <assert.h>

int main(void)
{
    assert(execute("", NULL) == 0);
    assert(execute("100U8", NULL) == 100);
    assert(execute("read<U8>()", "100") == 100);
    return 0;
}
