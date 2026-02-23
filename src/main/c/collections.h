#pragma once
// Tuff C Vec/Map/Set operations. Implemented in collections.c.

#include <stdint.h>

int64_t __vec_new(void);
int64_t __vec_push(int64_t thisVec, int64_t item);
int64_t __vec_pop(int64_t thisVec);
int64_t __vec_get(int64_t thisVec, int64_t i);
int64_t __vec_set(int64_t thisVec, int64_t i, int64_t val);
int64_t __vec_length(int64_t thisVec);
int64_t __vec_init(int64_t thisVec);
int64_t __vec_capacity(int64_t thisVec);
int64_t __vec_clear(int64_t thisVec);
int64_t __vec_join(int64_t thisVec, int64_t sep);
int64_t __vec_includes(int64_t thisVec, int64_t item);

int64_t __map_new(void);
int64_t map_set(int64_t thisMap, int64_t k, int64_t v);
int64_t map_get(int64_t thisMap, int64_t k);
int64_t map_has(int64_t thisMap, int64_t k);
int64_t map_delete(int64_t thisMap, int64_t k);

int64_t __set_new(void);
int64_t set_add(int64_t thisSet, int64_t item);
int64_t set_has(int64_t thisSet, int64_t item);
int64_t set_delete(int64_t thisSet, int64_t item);
