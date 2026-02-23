// Tuff C panic entry points. Depends on substrate.c (tuff_panic).

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
    fprintf(stderr, "panic_with_code: [%s] %s\nreason: %s\nfix: %s\n",
            c == NULL ? "E_SELFHOST_INTERNAL_ERROR" : c,
            m == NULL ? "<no message>" : m,
            r == NULL ? "<no reason>" : r,
            f == NULL ? "<no fix>" : f);
    abort();
    return 0;
}

int64_t panic_with_code_loc(int64_t code, int64_t msg, int64_t reason, int64_t fix, int64_t line, int64_t col)
{
    const char *c = tuff_str(code);
    const char *m = tuff_str(msg);
    const char *r = tuff_str(reason);
    const char *f = tuff_str(fix);
    fprintf(stderr, "error[%s] %s @ %lld:%lld\nreason: %s\nfix: %s\n",
            c == NULL ? "E_SELFHOST_INTERNAL_ERROR" : c,
            m == NULL ? "<no message>" : m,
            (long long)line, (long long)col,
            r == NULL ? "<no reason>" : r,
            f == NULL ? "<no fix>" : f);
    abort();
    return 0;
}
