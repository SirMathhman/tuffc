#include <assert.h>

struct InterpretError
{
    const char *invalidValue;
    const char *errorMessage;
    const char *reason;
    const char *fix;
};

template <typename T>
struct Result
{
    int isOk;
    T value;
    InterpretError error;
};

Result<int> interpretTuff(const char *tuffCode);

int main(void)
{
    Result<int> res = interpretTuff("");
    assert(res.isOk == 1);
    assert(res.value == 0);
    return 0;
}
