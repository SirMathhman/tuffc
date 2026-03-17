# Tuffc Coding Instructions

## C Standard Library Only

**Never use C++ standard library headers or features.** This codebase is C with templates, not C++.

### Rules

- **Prohibited**: `#include <string>`, `#include <vector>`, `#include <iostream>`, `std::string`, `std::vector`, etc.
- **Allowed**: `#include <stdio.h>`, `#include <stdlib.h>`, `#include <string.h>`, `#include <stdint.h>`, etc.

### Rationale

The Tuffc project deliberately uses C with template-based abstractions rather than C++. This keeps the codebase lightweight, avoids C++ runtime overhead, and maintains explicit control over memory and resources.

### Examples

#### ❌ Incorrect (C++ std library)

```c
#include <string>
std::string compileTuffToC(const std::string& tuffCode) {
    return std::string();
}
```

#### ✅ Correct (C standard library)

```c
#include <stdlib.h>
#include <string.h>

char* compileTuffToC(const char* tuffCode) {
    // Use malloc/free and char arrays instead
    char* result = malloc(1);
    result[0] = '\0';
    return result;
}
```

## Apply this instruction to all C and C++ files in the project
