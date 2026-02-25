// Tuff C substrate: managed string registry, tagged-value helpers, and tuff_panic.
// Types declared in substrate.h (included before this file in the concatenated assembly).
// Concatenated before strings.c, string-builder.c, collections.c, io.c, panic.c.

static char **g_managed_strings = NULL;
static size_t g_managed_strings_len = 0;
static size_t g_managed_strings_cap = 0;
static const char **g_managed_ptr_index = NULL;
static size_t g_managed_ptr_index_cap = 0;

static size_t tuff_ptr_hash(const char *p)
{
    uintptr_t x = (uintptr_t)p;
    // Mix pointer bits; right-shift to reduce allocator alignment bias.
    x ^= (x >> 33);
    x *= (uintptr_t)0xff51afd7ed558ccdULL;
    x ^= (x >> 33);
    return (size_t)x;
}

static void tuff_managed_index_rebuild(size_t new_cap)
{
    if (new_cap < 64)
        new_cap = 64;
    size_t cap = 1;
    while (cap < new_cap)
        cap <<= 1;

    const char **next = (const char **)calloc(cap, sizeof(const char *));
    if (next == NULL)
        tuff_panic("Out of memory in managed string index");

    for (size_t i = 0; i < g_managed_strings_len; i++)
    {
        const char *p = g_managed_strings[i];
        if (p == NULL)
            continue;
        size_t mask = cap - 1;
        size_t idx = tuff_ptr_hash(p) & mask;
        while (next[idx] != NULL)
            idx = (idx + 1) & mask;
        next[idx] = p;
    }

    free((void *)g_managed_ptr_index);
    g_managed_ptr_index = next;
    g_managed_ptr_index_cap = cap;
}

static void tuff_managed_index_insert(const char *p)
{
    if (p == NULL)
        return;
    if (g_managed_ptr_index_cap == 0 || (g_managed_strings_len * 10) >= (g_managed_ptr_index_cap * 7))
    {
        size_t target = g_managed_ptr_index_cap == 0 ? 64 : g_managed_ptr_index_cap * 2;
        tuff_managed_index_rebuild(target);
    }
    size_t mask = g_managed_ptr_index_cap - 1;
    size_t idx = tuff_ptr_hash(p) & mask;
    while (g_managed_ptr_index[idx] != NULL)
    {
        if (g_managed_ptr_index[idx] == p)
            return;
        idx = (idx + 1) & mask;
    }
    g_managed_ptr_index[idx] = p;
}

static int tuff_is_small_int(int64_t v);
static int tuff_is_managed_string_ptr(const char *p);
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
    // Fast path: most real pointers are outside the small-int tagged range.
    if (!tuff_is_small_int(v))
        return (const char *)(intptr_t)v;

    // Slow-path guard: if a managed pointer ever lands in small-int range,
    // treat it as string; otherwise this is a numeric value, not a string.
    const char *p = (const char *)(intptr_t)v;
    if (tuff_is_managed_string_ptr(p))
        return p;
    return NULL;
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
    if (g_managed_ptr_index_cap > 0)
    {
        size_t mask = g_managed_ptr_index_cap - 1;
        size_t idx = tuff_ptr_hash(p) & mask;
        while (g_managed_ptr_index[idx] != NULL)
        {
            if (g_managed_ptr_index[idx] == p)
                return 1;
            idx = (idx + 1) & mask;
        }
        return 0;
    }
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
        tuff_managed_index_insert(owned);
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

// Native selfhost helpers: read file contents as a managed Tuff string.
// Returns a managed string with the file contents, or "" on failure.
static int64_t tuff_read_file_as_string(const char *path)
{
    if (path == NULL)
        return tuff_register_cstring_copy("");
    FILE *f = fopen(path, "rb");
    if (f == NULL)
        return tuff_register_cstring_copy("");
    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    rewind(f);
    if (sz <= 0)
    {
        fclose(f);
        return tuff_register_cstring_copy("");
    }
    char *buf = (char *)malloc((size_t)sz + 1);
    if (buf == NULL)
    {
        fclose(f);
        return tuff_register_cstring_copy("");
    }
    size_t nread = fread(buf, 1, (size_t)sz, f);
    fclose(f);
    buf[nread] = '\0';
    int64_t result = tuff_register_cstring_copy(buf);
    free(buf);
    return result;
}

// Host callbacks: in native binary, read content from env-var-specified paths.
// Set TUFFC_SUBSTRATE_PATH to the path of the substrate bundle text file.
// Set TUFFC_PRELUDE_PATH to the path of RuntimePrelude.tuff.
// If the env var is not set, returns "".
int64_t __host_get_c_substrate(void)
{
    return tuff_read_file_as_string(getenv("TUFFC_SUBSTRATE_PATH"));
}

int64_t __host_get_c_runtime_prelude_source(void)
{
    return tuff_read_file_as_string(getenv("TUFFC_PRELUDE_PATH"));
}

// Profiling clock: monotonic milliseconds.
int64_t perf_now(void)
{
#ifdef _WIN32
    static LARGE_INTEGER freq = {0};
    if (freq.QuadPart == 0)
    {
        QueryPerformanceFrequency(&freq);
        if (freq.QuadPart == 0)
            return 0;
    }
    LARGE_INTEGER now;
    QueryPerformanceCounter(&now);
    return (int64_t)((now.QuadPart * 1000LL) / freq.QuadPart);
#else
    struct timespec ts;
    if (clock_gettime(CLOCK_MONOTONIC, &ts) != 0)
        return 0;
    return (int64_t)ts.tv_sec * 1000LL + (int64_t)(ts.tv_nsec / 1000000LL);
#endif
}
int64_t profile_mark(int64_t label, int64_t duration_ms)
{
    (void)label;
    (void)duration_ms;
    return 0;
}
int64_t profile_take_json(void) { return tuff_to_val("{}"); }
