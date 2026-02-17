// Tuff C I/O operations. Depends on substrate.c.

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
