#pragma once
// Tuff C substrate: ABI types, tagged-value encoding, managed string registry.
// Included first in the concatenated C substrate assembly.

#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#ifdef _WIN32
#include <direct.h>
#include <windows.h>
#else
#include <sys/stat.h>
#include <sys/types.h>
#include <time.h>
#endif

typedef int64_t TuffValue;
typedef int64_t StringBuilder;
typedef int64_t Vec;
typedef int64_t Map;
typedef int64_t Set;

typedef struct
{
    char *buf;
    size_t len;
    size_t cap;
} TuffStringBuilder;

typedef struct
{
    int64_t *data;
    size_t init;
    size_t length;
} TuffVec;

typedef struct
{
    int64_t *keys;
    int64_t *vals;
    uint8_t *states; // 0=empty, 1=occupied, 2=tombstone
    size_t len;
    size_t cap;
    size_t tombstones;
} TuffMap;

typedef struct
{
    int64_t *items;
    uint8_t *states; // 0=empty, 1=occupied, 2=tombstone
    size_t len;
    size_t cap;
    size_t tombstones;
} TuffSet;

void tuff_panic(const char *message);
int64_t perf_now(void);
int64_t profile_mark(int64_t label, int64_t duration_ms);
int64_t profile_take_json(void);
