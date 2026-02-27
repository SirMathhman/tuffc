#pragma once
// Tuff C string operations. Implemented in strings.c.

#include <stdint.h>

int64_t str_length(int64_t s);
int64_t str_char_at(int64_t s, int64_t i);
int64_t str_slice(int64_t s, int64_t start, int64_t end);
int64_t str_slice_window(int64_t s, int64_t start, int64_t end);
int64_t str_copy(int64_t s);
int64_t str_concat(int64_t a, int64_t b);
int64_t str_eq(int64_t a, int64_t b);
int64_t str_from_char_code(int64_t code);
int64_t __str_index_of(int64_t s, int64_t needle);
int64_t str_trim(int64_t s);
int64_t str_replace_all(int64_t s, int64_t from, int64_t to);
int64_t char_code(int64_t ch);
int64_t __int_to_string(int64_t n);
int64_t parse_int(int64_t s);
