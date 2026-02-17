#pragma once
// Tuff C StringBuilder operations. Implemented in string-builder.c.

#include <stdint.h>

int64_t sb_new(void);
int64_t sb_append(int64_t sb_val, int64_t s);
int64_t sb_append_char(int64_t sb_val, int64_t code);
int64_t sb_build(int64_t sb_val);
