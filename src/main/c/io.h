#pragma once
// Tuff C I/O operations. Implemented in io.c.

#include <stdint.h>

int64_t read_file(int64_t filePath);
int64_t write_file(int64_t filePath, int64_t contents);
int64_t path_join(int64_t a, int64_t b);
int64_t path_dirname(int64_t p);
int64_t print(int64_t s);
int64_t print_error(int64_t s);
