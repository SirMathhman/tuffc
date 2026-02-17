// Tuff C substrate: ABI types, tagged-value encoding, managed string registry, tuff_panic.
// This file is included first in generated C output.
// All other tuff-c/*.c files depend on types and helpers defined here.

typedef int64_t TuffValue;
typedef int64_t StringBuilder;
typedef int64_t Vec;
typedef int64_t Map;
typedef int64_t Set;

void tuff_panic(const char *message);

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
    size_t len;
    size_t cap;
} TuffMap;

typedef struct
{
    int64_t *items;
    size_t len;
    size_t cap;
} TuffSet;

static char **g_managed_strings = NULL;
static size_t g_managed_strings_len = 0;
static size_t g_managed_strings_cap = 0;

static int tuff_is_small_int(int64_t v);
static char *tuff_strdup(const char *s);

static inline int64_t tuff_to_val(const void *p)
{
    return (int64_t)(intptr_t)p;
}

static inline void *tuff_from_val(int64_t v)
{
    return (void *)(intptr_t)v;
}

static inline const char *tuff_str(int64_t v)
{
    if (v == 0)
        return NULL;
    if (tuff_is_small_int(v))
        return NULL;
    return (const char *)(intptr_t)v;
}

static inline const char *tuff_str_or_empty(int64_t v)
{
    const char *s = tuff_str(v);
    return s == NULL ? "" : s;
}

static int tuff_is_managed_string_ptr(const char *p)
{
    if (p == NULL)
        return 0;
    for (size_t i = 0; i < g_managed_strings_len; i++)
    {
        if (g_managed_strings[i] == p)
            return 1;
    }
    return 0;
}

static int64_t tuff_register_owned_string(char *owned)
{
    if (owned == NULL)
        return 0;
    if (!tuff_is_managed_string_ptr(owned))
    {
        if (g_managed_strings_len >= g_managed_strings_cap)
        {
            size_t next_cap = g_managed_strings_cap == 0 ? 32 : g_managed_strings_cap * 2;
            char **next = (char **)realloc(g_managed_strings, sizeof(char *) * next_cap);
            if (next == NULL)
                tuff_panic("Out of memory in managed string registry");
            g_managed_strings = next;
            g_managed_strings_cap = next_cap;
        }
        g_managed_strings[g_managed_strings_len++] = owned;
    }
    return tuff_to_val(owned);
}

static int64_t tuff_register_cstring_copy(const char *s)
{
    return tuff_register_owned_string(tuff_strdup(s));
}

static int64_t tuff_canonicalize_key(int64_t v)
{
    if (v == 0)
        return 0;
    if (tuff_is_small_int(v))
        return v;
    const char *p = (const char *)(intptr_t)v;
    if (tuff_is_managed_string_ptr(p))
        return v;
    return tuff_register_cstring_copy(p);
}

static char *tuff_strdup(const char *s)
{
    if (s == NULL)
    {
        char *empty = (char *)malloc(1);
        if (empty != NULL)
            empty[0] = '\0';
        return empty;
    }
    size_t n = strlen(s);
    char *out = (char *)malloc(n + 1);
    if (out == NULL)
        return NULL;
    memcpy(out, s, n + 1);
    return out;
}

static int tuff_is_small_int(int64_t v)
{
    return v > -2147483648LL && v < 2147483648LL;
}

static int tuff_value_equals(int64_t a, int64_t b)
{
    if (a == b)
        return 1;
    if (tuff_is_small_int(a) || tuff_is_small_int(b))
        return 0;
    const char *sa = tuff_str(a);
    const char *sb = tuff_str(b);
    if (sa == NULL || sb == NULL)
        return 0;
    if (!tuff_is_managed_string_ptr(sa) || !tuff_is_managed_string_ptr(sb))
        return 0;
    return strcmp(sa, sb) == 0;
}

static int64_t tuff_map_index_of(TuffMap *m, int64_t key)
{
    if (m == NULL)
        return -1;
    for (size_t i = 0; i < m->len; i++)
    {
        if (tuff_value_equals(m->keys[i], key))
            return (int64_t)i;
    }
    return -1;
}

static int64_t tuff_set_index_of(TuffSet *s, int64_t item)
{
    if (s == NULL)
        return -1;
    for (size_t i = 0; i < s->len; i++)
    {
        if (tuff_value_equals(s->items[i], item))
            return (int64_t)i;
    }
    return -1;
}

static void *tuff_realloc_array(void *ptr, size_t elem_size, size_t new_cap)
{
    if (new_cap == 0)
        new_cap = 4;
    return realloc(ptr, elem_size * new_cap);
}

static int tuff_ensure_parent_dir(const char *file_path)
{
    if (file_path == NULL)
        return 0;
    char *copy = tuff_strdup(file_path);
    if (copy == NULL)
        return 0;

    size_t n = strlen(copy);
    for (size_t i = 0; i < n; i++)
    {
        if (copy[i] == '/' || copy[i] == '\\')
        {
            char prev = copy[i];
            copy[i] = '\0';
            if (strlen(copy) > 0)
            {
#ifdef _WIN32
                if (_mkdir(copy) != 0 && errno != EEXIST)
#else
                if (mkdir(copy, 0755) != 0 && errno != EEXIST)
#endif
                {
                    copy[i] = prev;
                    free(copy);
                    return 0;
                }
            }
            copy[i] = prev;
        }
    }

    free(copy);
    return 1;
}

void tuff_panic(const char *message)
{
    if (message != NULL)
    {
        fprintf(stderr, "tuff panic: %s\n", message);
    }
    else
    {
        fprintf(stderr, "tuff panic\n");
    }
    abort();
}
