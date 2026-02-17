// @ts-nocheck

export function getEmbeddedCRuntimeSupport() {
  return String.raw`typedef int64_t TuffValue;
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
    size_t len;
    size_t cap;
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
        fprintf(stderr, "tuff panic: %s\\n", message);
    }
    else
    {
        fprintf(stderr, "tuff panic\\n");
    }
    abort();
}

int64_t str_length(int64_t s)
{
    const char *p = tuff_str(s);
    if (p == NULL)
        return 0;
    return (int64_t)strlen(p);
}

int64_t str_char_at(int64_t s, int64_t i)
{
    const char *p = tuff_str(s);
    if (p == NULL)
        return 0;
    size_t n = strlen(p);
    if (i < 0 || (size_t)i >= n)
        return 0;
    return (unsigned char)p[i];
}

int64_t str_slice(int64_t s, int64_t start, int64_t end)
{
    const char *p = tuff_str(s);
    if (p == NULL)
        return tuff_register_cstring_copy("");
    size_t n = strlen(p);
    if (start < 0)
        start = 0;
    if (end < 0)
        end = 0;
    if ((size_t)start > n)
        start = (int64_t)n;
    if ((size_t)end > n)
        end = (int64_t)n;
    if (end < start)
        end = start;

    size_t out_n = (size_t)(end - start);
    char *out = (char *)malloc(out_n + 1);
    if (out == NULL)
        tuff_panic("Out of memory in str_slice");
    memcpy(out, p + start, out_n);
    out[out_n] = '\0';
    return tuff_register_owned_string(out);
}

int64_t str_concat(int64_t a, int64_t b)
{
    const char *sa = tuff_str_or_empty(a);
    const char *sb = tuff_str_or_empty(b);
    size_t na = strlen(sa);
    size_t nb = strlen(sb);
    char *out = (char *)malloc(na + nb + 1);
    if (out == NULL)
        tuff_panic("Out of memory in str_concat");
    memcpy(out, sa, na);
    memcpy(out + na, sb, nb + 1);
    return tuff_register_owned_string(out);
}

int64_t str_eq(int64_t a, int64_t b)
{
    const char *sa = tuff_str(a);
    const char *sb = tuff_str(b);
    if (sa == NULL || sb == NULL)
        return sa == sb;
    return strcmp(sa, sb) == 0;
}

int64_t str_from_char_code(int64_t code)
{
    char *out = (char *)malloc(2);
    if (out == NULL)
        tuff_panic("Out of memory in str_from_char_code");
    out[0] = (char)code;
    out[1] = '\0';
    return tuff_register_owned_string(out);
}

int64_t str_index_of(int64_t s, int64_t needle)
{
    const char *hay = tuff_str(s);
    const char *nd = tuff_str(needle);
    if (hay == NULL || nd == NULL)
        return -1;
    const char *pos = strstr(hay, nd);
    if (pos == NULL)
        return -1;
    return (int64_t)(pos - hay);
}

int64_t str_trim(int64_t s)
{
    const char *p = tuff_str(s);
    if (p == NULL)
        return tuff_register_cstring_copy("");
    size_t n = strlen(p);
    size_t a = 0;
    while (a < n && (p[a] == ' ' || p[a] == '\n' || p[a] == '\r' || p[a] == '\t'))
        a++;
    size_t b = n;
    while (b > a && (p[b - 1] == ' ' || p[b - 1] == '\n' || p[b - 1] == '\r' || p[b - 1] == '\t'))
        b--;
    return str_slice(s, (int64_t)a, (int64_t)b);
}

int64_t str_replace_all(int64_t s, int64_t from, int64_t to)
{
    const char *src = tuff_str(s);
    const char *needle = tuff_str(from);
    const char *repl = tuff_str(to);
    if (src == NULL)
        return tuff_to_val(tuff_strdup(""));
    if (needle == NULL || needle[0] == '\0')
        return tuff_register_cstring_copy(src);
    if (repl == NULL)
        repl = "";

    size_t src_len = strlen(src);
    size_t nd_len = strlen(needle);
    size_t rp_len = strlen(repl);

    size_t count = 0;
    const char *scan = src;
    while ((scan = strstr(scan, needle)) != NULL)
    {
        count++;
        scan += nd_len;
    }

    size_t out_len = src_len + count * (rp_len - nd_len);
    char *out = (char *)malloc(out_len + 1);
    if (out == NULL)
        tuff_panic("Out of memory in str_replace_all");

    const char *cur = src;
    char *dst = out;
    while (1)
    {
        const char *hit = strstr(cur, needle);
        if (hit == NULL)
        {
            strcpy(dst, cur);
            break;
        }
        size_t part = (size_t)(hit - cur);
        memcpy(dst, cur, part);
        dst += part;
        memcpy(dst, repl, rp_len);
        dst += rp_len;
        cur = hit + nd_len;
    }
    return tuff_register_owned_string(out);
}

int64_t char_code(int64_t ch)
{
    return str_char_at(ch, 0);
}

int64_t int_to_string(int64_t n)
{
    char buf[64];
    snprintf(buf, sizeof(buf), "%lld", (long long)n);
    return tuff_register_cstring_copy(buf);
}

int64_t parse_int(int64_t s)
{
    const char *p = tuff_str(s);
    if (p == NULL)
        return 0;
    return (int64_t)strtoll(p, NULL, 10);
}

int64_t sb_new(void)
{
    TuffStringBuilder *sb = (TuffStringBuilder *)calloc(1, sizeof(TuffStringBuilder));
    if (sb == NULL)
        tuff_panic("Out of memory in sb_new");
    sb->cap = 32;
    sb->buf = (char *)calloc(sb->cap, 1);
    if (sb->buf == NULL)
        tuff_panic("Out of memory in sb_new buffer");
    return tuff_to_val(sb);
}

static void sb_reserve(TuffStringBuilder *sb, size_t need)
{
    if (sb->cap >= need)
        return;
    size_t cap = sb->cap;
    while (cap < need)
        cap *= 2;
    char *next = (char *)realloc(sb->buf, cap);
    if (next == NULL)
        tuff_panic("Out of memory in sb_reserve");
    sb->buf = next;
    sb->cap = cap;
}

int64_t sb_append(int64_t sb_val, int64_t s)
{
    TuffStringBuilder *sb = (TuffStringBuilder *)tuff_from_val(sb_val);
    const char *p = tuff_str(s);
    if (sb == NULL || p == NULL)
        return sb_val;
    size_t n = strlen(p);
    sb_reserve(sb, sb->len + n + 1);
    memcpy(sb->buf + sb->len, p, n + 1);
    sb->len += n;
    return sb_val;
}

int64_t sb_append_char(int64_t sb_val, int64_t code)
{
    TuffStringBuilder *sb = (TuffStringBuilder *)tuff_from_val(sb_val);
    if (sb == NULL)
        return sb_val;
    sb_reserve(sb, sb->len + 2);
    sb->buf[sb->len++] = (char)code;
    sb->buf[sb->len] = '\0';
    return sb_val;
}

int64_t sb_build(int64_t sb_val)
{
    TuffStringBuilder *sb = (TuffStringBuilder *)tuff_from_val(sb_val);
    if (sb == NULL)
        return tuff_register_cstring_copy("");
    return tuff_register_cstring_copy(sb->buf);
}

int64_t __vec_new(void)
{
    TuffVec *v = (TuffVec *)calloc(1, sizeof(TuffVec));
    if (v == NULL)
        tuff_panic("Out of memory in __vec_new");
    return tuff_to_val(v);
}

static void vec_reserve(TuffVec *v, size_t need)
{
    if (v->cap >= need)
        return;
    size_t cap = v->cap == 0 ? 4 : v->cap;
    while (cap < need)
        cap *= 2;
    int64_t *next = (int64_t *)tuff_realloc_array(v->data, sizeof(int64_t), cap);
    if (next == NULL)
        tuff_panic("Out of memory in vec_reserve");
    v->data = next;
    v->cap = cap;
}

int64_t vec_push(int64_t thisVec, int64_t item)
{
    TuffVec *v = (TuffVec *)tuff_from_val(thisVec);
    if (v == NULL)
        return thisVec;
    vec_reserve(v, v->len + 1);
    v->data[v->len++] = item;
    return thisVec;
}

int64_t vec_pop(int64_t thisVec)
{
    TuffVec *v = (TuffVec *)tuff_from_val(thisVec);
    if (v == NULL || v->len == 0)
        return 0;
    return v->data[--v->len];
}

int64_t vec_get(int64_t thisVec, int64_t i)
{
    TuffVec *v = (TuffVec *)tuff_from_val(thisVec);
    if (v == NULL || i < 0 || (size_t)i >= v->len)
        return 0;
    return v->data[i];
}

int64_t vec_set(int64_t thisVec, int64_t i, int64_t val)
{
    TuffVec *v = (TuffVec *)tuff_from_val(thisVec);
    if (v == NULL || i < 0)
        return thisVec;
    size_t idx = (size_t)i;
    if (idx >= v->len)
    {
        vec_reserve(v, idx + 1);
        for (size_t j = v->len; j <= idx; j++)
            v->data[j] = 0;
        v->len = idx + 1;
    }
    v->data[idx] = val;
    return thisVec;
}

int64_t vec_length(int64_t thisVec)
{
    TuffVec *v = (TuffVec *)tuff_from_val(thisVec);
    return v == NULL ? 0 : (int64_t)v->len;
}

int64_t vec_clear(int64_t thisVec)
{
    TuffVec *v = (TuffVec *)tuff_from_val(thisVec);
    if (v != NULL)
        v->len = 0;
    return thisVec;
}

int64_t vec_join(int64_t thisVec, int64_t sep)
{
    TuffVec *v = (TuffVec *)tuff_from_val(thisVec);
    const char *ssep = tuff_str(sep);
    if (ssep == NULL)
        ssep = "";
    if (v == NULL || v->len == 0)
        return tuff_to_val(tuff_strdup(""));

    int64_t sb = sb_new();
    for (size_t i = 0; i < v->len; i++)
    {
        if (i > 0)
            sb_append(sb, sep);
        sb_append(sb, v->data[i]);
    }
    return sb_build(sb);
}

int64_t vec_includes(int64_t thisVec, int64_t item)
{
    TuffVec *v = (TuffVec *)tuff_from_val(thisVec);
    if (v == NULL)
        return 0;
    for (size_t i = 0; i < v->len; i++)
    {
        if (tuff_value_equals(v->data[i], item))
            return 1;
    }
    return 0;
}

int64_t __map_new(void)
{
    TuffMap *m = (TuffMap *)calloc(1, sizeof(TuffMap));
    if (m == NULL)
        tuff_panic("Out of memory in __map_new");
    return tuff_to_val(m);
}

static void map_reserve(TuffMap *m, size_t need)
{
    if (m->cap >= need)
        return;
    size_t cap = m->cap == 0 ? 4 : m->cap;
    while (cap < need)
        cap *= 2;
    int64_t *next_keys = (int64_t *)tuff_realloc_array(m->keys, sizeof(int64_t), cap);
    int64_t *next_vals = (int64_t *)tuff_realloc_array(m->vals, sizeof(int64_t), cap);
    if (next_keys == NULL || next_vals == NULL)
        tuff_panic("Out of memory in map_reserve");
    m->keys = next_keys;
    m->vals = next_vals;
    m->cap = cap;
}

int64_t map_set(int64_t thisMap, int64_t k, int64_t v)
{
    TuffMap *m = (TuffMap *)tuff_from_val(thisMap);
    k = tuff_canonicalize_key(k);
    if (m == NULL)
        return thisMap;
    int64_t found = tuff_map_index_of(m, k);
    if (found >= 0)
    {
        m->vals[(size_t)found] = v;
        return thisMap;
    }
    map_reserve(m, m->len + 1);
    m->keys[m->len] = k;
    m->vals[m->len] = v;
    m->len += 1;
    return thisMap;
}

int64_t map_get(int64_t thisMap, int64_t k)
{
    TuffMap *m = (TuffMap *)tuff_from_val(thisMap);
    k = tuff_canonicalize_key(k);
    int64_t idx = tuff_map_index_of(m, k);
    return idx >= 0 ? m->vals[(size_t)idx] : 0;
}

int64_t map_has(int64_t thisMap, int64_t k)
{
    TuffMap *m = (TuffMap *)tuff_from_val(thisMap);
    k = tuff_canonicalize_key(k);
    return tuff_map_index_of(m, k) >= 0;
}

int64_t __set_new(void)
{
    TuffSet *s = (TuffSet *)calloc(1, sizeof(TuffSet));
    if (s == NULL)
        tuff_panic("Out of memory in __set_new");
    return tuff_to_val(s);
}

static void set_reserve(TuffSet *s, size_t need)
{
    if (s->cap >= need)
        return;
    size_t cap = s->cap == 0 ? 4 : s->cap;
    while (cap < need)
        cap *= 2;
    int64_t *next = (int64_t *)tuff_realloc_array(s->items, sizeof(int64_t), cap);
    if (next == NULL)
        tuff_panic("Out of memory in set_reserve");
    s->items = next;
    s->cap = cap;
}

int64_t set_add(int64_t thisSet, int64_t item)
{
    TuffSet *s = (TuffSet *)tuff_from_val(thisSet);
    item = tuff_canonicalize_key(item);
    if (s == NULL)
        return thisSet;
    if (tuff_set_index_of(s, item) >= 0)
        return thisSet;
    set_reserve(s, s->len + 1);
    s->items[s->len++] = item;
    return thisSet;
}

int64_t set_has(int64_t thisSet, int64_t item)
{
    TuffSet *s = (TuffSet *)tuff_from_val(thisSet);
    item = tuff_canonicalize_key(item);
    return tuff_set_index_of(s, item) >= 0;
}

int64_t set_delete(int64_t thisSet, int64_t item)
{
    TuffSet *s = (TuffSet *)tuff_from_val(thisSet);
    item = tuff_canonicalize_key(item);
    int64_t idx = tuff_set_index_of(s, item);
    if (idx < 0)
        return 0;
    for (size_t j = (size_t)idx + 1; j < s->len; j++)
        s->items[j - 1] = s->items[j];
    s->len--;
    return 1;
}

int64_t read_file(int64_t filePath)
{
    const char *p = tuff_str(filePath);
    if (p == NULL)
        return 0;
    FILE *f = fopen(p, "rb");
    if (f == NULL)
        tuff_panic("Failed to read file");
    fseek(f, 0, SEEK_END);
    long n = ftell(f);
    fseek(f, 0, SEEK_SET);
    if (n < 0)
        n = 0;
    char *buf = (char *)malloc((size_t)n + 1);
    if (buf == NULL)
        tuff_panic("Out of memory in read_file");
    size_t r = fread(buf, 1, (size_t)n, f);
    buf[r] = '\0';
    fclose(f);
    return tuff_register_owned_string(buf);
}

int64_t write_file(int64_t filePath, int64_t contents)
{
    const char *p = tuff_str(filePath);
    const char *c = tuff_str(contents);
    if (p == NULL)
        return -1;
    if (c == NULL)
        c = "";

    tuff_ensure_parent_dir(p);
    FILE *f = fopen(p, "wb");
    if (f == NULL)
        return -1;
    fwrite(c, 1, strlen(c), f);
    fclose(f);
    return 0;
}

int64_t path_join(int64_t a, int64_t b)
{
    const char *sa = tuff_str_or_empty(a);
    const char *sb = tuff_str_or_empty(b);
    if (sb[0] == '/' || sb[0] == '\\' || (strlen(sb) > 1 && sb[1] == ':'))
        return tuff_register_cstring_copy(sb);
    size_t na = strlen(sa);
    size_t nb = strlen(sb);
    int needs_sep = na > 0 && sa[na - 1] != '/' && sa[na - 1] != '\\';
    char *out = (char *)malloc(na + nb + (needs_sep ? 2 : 1));
    if (out == NULL)
        tuff_panic("Out of memory in path_join");
    strcpy(out, sa);
    if (needs_sep)
        strcat(out, "/");
    strcat(out, sb);
    return tuff_register_owned_string(out);
}

int64_t path_dirname(int64_t p)
{
    const char *s = tuff_str(p);
    if (s == NULL)
        return tuff_register_cstring_copy(".");
    size_t n = strlen(s);
    if (n == 0)
        return tuff_register_cstring_copy(".");
    const char *last_slash = strrchr(s, '/');
    const char *last_back = strrchr(s, '\\');
    const char *last = last_slash;
    if (last_back != NULL && (last == NULL || last_back > last))
        last = last_back;
    if (last == NULL)
        return tuff_register_cstring_copy(".");
    size_t out_n = (size_t)(last - s);
    if (out_n == 0)
        out_n = 1;
    char *out = (char *)malloc(out_n + 1);
    if (out == NULL)
        tuff_panic("Out of memory in path_dirname");
    memcpy(out, s, out_n);
    out[out_n] = '\0';
    return tuff_register_owned_string(out);
}

int64_t print(int64_t s)
{
    const char *p = tuff_str(s);
    if (p == NULL)
        p = "";
    fputs(p, stdout);
    fputc('\n', stdout);
    return 0;
}

int64_t print_error(int64_t s)
{
    const char *p = tuff_str(s);
    if (p == NULL)
        p = "";
    fputs(p, stderr);
    fputc('\n', stderr);
    return 0;
}

int64_t panic(int64_t msg)
{
    tuff_panic(tuff_str(msg));
    return 0;
}

int64_t panic_with_code(int64_t code, int64_t msg, int64_t reason, int64_t fix)
{
    const char *c = tuff_str(code);
    const char *m = tuff_str(msg);
    const char *r = tuff_str(reason);
    const char *f = tuff_str(fix);
    fprintf(stderr, "panic_with_code: [%s] %s\\nreason: %s\\nfix: %s\\n",
            c == NULL ? "E_SELFHOST_PANIC" : c,
            m == NULL ? "<no message>" : m,
            r == NULL ? "<no reason>" : r,
            f == NULL ? "<no fix>" : f);
    abort();
    return 0;
}`;
}
