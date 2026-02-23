#pragma once
// Tuff C panic entry points. Implemented in panic.c.

#include <stdint.h>

int64_t panic(int64_t msg);
int64_t panic_with_code(int64_t code, int64_t msg, int64_t reason, int64_t fix);
int64_t panic_with_code_loc(int64_t code, int64_t msg, int64_t reason, int64_t fix, int64_t line, int64_t col);
