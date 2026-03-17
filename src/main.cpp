#include <stdint.h>

// Error struct containing diagnostic information
struct InterpretError
{
    const char *invalidValue; // 1) The invalid value
    const char *errorMessage; // 2) The error message
    const char *reason;       // 3) The reason
    const char *fix;          // 4) The fix
};

// Result template that holds either a value or an error
template <typename T>
struct Result
{
    int isOk;             // 1 if successful, 0 if error
    T value;              // Valid if isOk == 1
    InterpretError error; // Valid if isOk == 0
};

Result<int> interpretTuff(const char *tuffCode)
{
    (void)tuffCode; // Unused parameter
    // TODO: Implement interpretation logic
    Result<int> res;
    res.isOk = 1;
    res.value = 0;
    return res;
}
