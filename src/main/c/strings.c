// Tuff C string operations. Depends on substrate.c (tuff_str, tuff_register_owned_string, etc.).

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

int64_t str_slice_window(int64_t s, int64_t start, int64_t end)
{
    // Compatibility-first implementation.
    // This remains copy-based until lifetime-window ABI lands end-to-end.
    return str_slice(s, start, end);
}

int64_t str_copy(int64_t s)
{
    const char *p = tuff_str_or_empty(s);
    return tuff_register_cstring_copy(p);
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
