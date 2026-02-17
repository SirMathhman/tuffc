// Tuff C Vec/Map/Set operations. Depends on substrate.c and string-builder.c (vec_join uses sb_*).
#include "collections.h"

int64_t __vec_new(void)
{
    TuffVec *v = (TuffVec *)calloc(1, sizeof(TuffVec));
    if (v == NULL)
        tuff_panic("Out of memory in __vec_new");
    return tuff_to_val(v);
}

static void vec_reserve(TuffVec *v, size_t need)
{
    if (v->length >= need)
        return;
    size_t next_len = v->length == 0 ? 4 : v->length;
    while (next_len < need)
        next_len *= 2;
    int64_t *next = (int64_t *)tuff_realloc_array(v->data, sizeof(int64_t), next_len);
    if (next == NULL)
        tuff_panic("Out of memory in vec_reserve");
    v->data = next;
    v->length = next_len;
}

int64_t __vec_push(int64_t thisVec, int64_t item)
{
    TuffVec *v = (TuffVec *)tuff_from_val(thisVec);
    if (v == NULL)
        return thisVec;
    vec_reserve(v, v->init + 1);
    v->data[v->init++] = item;
    return thisVec;
}

int64_t __vec_pop(int64_t thisVec)
{
    TuffVec *v = (TuffVec *)tuff_from_val(thisVec);
    if (v == NULL || v->init == 0)
        return 0;
    return v->data[--v->init];
}

int64_t __vec_get(int64_t thisVec, int64_t i)
{
    TuffVec *v = (TuffVec *)tuff_from_val(thisVec);
    if (v == NULL || i < 0 || (size_t)i >= v->init)
        return 0;
    return v->data[i];
}

int64_t __vec_set(int64_t thisVec, int64_t i, int64_t val)
{
    TuffVec *v = (TuffVec *)tuff_from_val(thisVec);
    if (v == NULL || i < 0)
        return thisVec;
    size_t idx = (size_t)i;
    if (idx > v->init)
    {
        tuff_panic("vec_set index exceeds initialized size");
    }
    vec_reserve(v, idx + 1);
    v->data[idx] = val;
    if (idx == v->init)
        v->init += 1;
    return thisVec;
}

int64_t __vec_length(int64_t thisVec)
{
    TuffVec *v = (TuffVec *)tuff_from_val(thisVec);
    return v == NULL ? 0 : (int64_t)v->init;
}

int64_t __vec_init(int64_t thisVec)
{
    TuffVec *v = (TuffVec *)tuff_from_val(thisVec);
    return v == NULL ? 0 : (int64_t)v->init;
}

int64_t __vec_capacity(int64_t thisVec)
{
    TuffVec *v = (TuffVec *)tuff_from_val(thisVec);
    return v == NULL ? 0 : (int64_t)v->length;
}

int64_t __vec_clear(int64_t thisVec)
{
    TuffVec *v = (TuffVec *)tuff_from_val(thisVec);
    if (v != NULL)
        v->init = 0;
    return thisVec;
}

int64_t __vec_join(int64_t thisVec, int64_t sep)
{
    TuffVec *v = (TuffVec *)tuff_from_val(thisVec);
    const char *ssep = tuff_str(sep);
    if (ssep == NULL)
        ssep = "";
    if (v == NULL || v->init == 0)
        return tuff_to_val(tuff_strdup(""));

    int64_t sb = sb_new();
    for (size_t i = 0; i < v->init; i++)
    {
        if (i > 0)
            sb_append(sb, sep);
        sb_append(sb, v->data[i]);
    }
    return sb_build(sb);
}

int64_t __vec_includes(int64_t thisVec, int64_t item)
{
    TuffVec *v = (TuffVec *)tuff_from_val(thisVec);
    if (v == NULL)
        return 0;
    for (size_t i = 0; i < v->init; i++)
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
