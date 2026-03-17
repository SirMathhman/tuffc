#include <assert.h>

int interpretTuff(const char *tuffCode);

int main(void)
{
    assert(interpretTuff("") == 0);
    assert(interpretTuff("100") == 100);
    return 0;
}
