// Tuff C StringBuilder operations. Depends on substrate.c.

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
