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

void drop_vec(int64_t thisVec)
{
    (void)__vec_clear(thisVec);
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

static size_t tuff_hash_mix64(uint64_t x)
{
    x ^= x >> 33;
    x *= UINT64_C(0xff51afd7ed558ccd);
    x ^= x >> 33;
    x *= UINT64_C(0xc4ceb9fe1a85ec53);
    x ^= x >> 33;
    return (size_t)x;
}

static size_t tuff_hash_value(int64_t key)
{
    if (key > -2147483648LL && key < 2147483648LL)
    {
        return tuff_hash_mix64((uint64_t)(uint32_t)key);
    }
    return tuff_hash_mix64((uint64_t)(uintptr_t)tuff_from_val(key));
}

static void map_allocate(TuffMap *m, size_t cap)
{
    int64_t *keys = (int64_t *)calloc(cap, sizeof(int64_t));
    int64_t *vals = (int64_t *)calloc(cap, sizeof(int64_t));
    uint8_t *states = (uint8_t *)calloc(cap, sizeof(uint8_t));
    if (keys == NULL || vals == NULL || states == NULL)
        tuff_panic("Out of memory in map_allocate");
    m->keys = keys;
    m->vals = vals;
    m->states = states;
    m->cap = cap;
    m->len = 0;
    m->tombstones = 0;
}

static size_t map_find_slot(TuffMap *m, int64_t key, int *found)
{
    size_t mask = m->cap - 1;
    size_t idx = tuff_hash_value(key) & mask;
    size_t first_tomb = (size_t)-1;
    for (;;)
    {
        uint8_t state = m->states[idx];
        if (state == 0)
        {
            if (found != NULL)
                *found = 0;
            return first_tomb != (size_t)-1 ? first_tomb : idx;
        }
        if (state == 2)
        {
            if (first_tomb == (size_t)-1)
                first_tomb = idx;
        }
        else if (tuff_value_equals(m->keys[idx], key))
        {
            if (found != NULL)
                *found = 1;
            return idx;
        }
        idx = (idx + 1) & mask;
    }
}

static void map_rehash(TuffMap *m, size_t new_cap)
{
    if (new_cap < 16)
        new_cap = 16;
    size_t cap = 1;
    while (cap < new_cap)
        cap <<= 1;

    TuffMap next = {0};
    map_allocate(&next, cap);

    for (size_t i = 0; i < m->cap; i++)
    {
        if (m->states[i] != 1)
            continue;
        int found = 0;
        size_t slot = map_find_slot(&next, m->keys[i], &found);
        next.states[slot] = 1;
        next.keys[slot] = m->keys[i];
        next.vals[slot] = m->vals[i];
        next.len += 1;
    }

    free(m->keys);
    free(m->vals);
    free(m->states);
    *m = next;
}

static void map_ensure_capacity(TuffMap *m)
{
    if (m->cap == 0)
    {
        map_allocate(m, 16);
        return;
    }
    size_t used = m->len + m->tombstones;
    if ((used + 1) * 10 >= m->cap * 7)
    {
        map_rehash(m, m->cap * 2);
    }
    else if (m->tombstones > m->len && m->cap > 16)
    {
        map_rehash(m, m->cap);
    }
}

int64_t map_set(int64_t thisMap, int64_t k, int64_t v)
{
    TuffMap *m = (TuffMap *)tuff_from_val(thisMap);
    k = tuff_canonicalize_key(k);
    if (m == NULL)
        return thisMap;
    map_ensure_capacity(m);

    int found = 0;
    size_t slot = map_find_slot(m, k, &found);
    if (found)
    {
        m->vals[slot] = v;
        return thisMap;
    }
    if (m->states[slot] == 2 && m->tombstones > 0)
        m->tombstones -= 1;
    m->states[slot] = 1;
    m->keys[slot] = k;
    m->vals[slot] = v;
    m->len += 1;
    return thisMap;
}

int64_t map_get(int64_t thisMap, int64_t k)
{
    TuffMap *m = (TuffMap *)tuff_from_val(thisMap);
    if (m == NULL || m->cap == 0)
        return 0;
    k = tuff_canonicalize_key(k);
    int found = 0;
    size_t slot = map_find_slot(m, k, &found);
    return found ? m->vals[slot] : 0;
}

int64_t map_has(int64_t thisMap, int64_t k)
{
    TuffMap *m = (TuffMap *)tuff_from_val(thisMap);
    if (m == NULL || m->cap == 0)
        return 0;
    k = tuff_canonicalize_key(k);
    int found = 0;
    (void)map_find_slot(m, k, &found);
    return found;
}

int64_t map_delete(int64_t thisMap, int64_t k)
{
    TuffMap *m = (TuffMap *)tuff_from_val(thisMap);
    if (m == NULL || m->cap == 0)
        return 0;
    k = tuff_canonicalize_key(k);
    int found = 0;
    size_t slot = map_find_slot(m, k, &found);
    if (!found)
        return 0;
    m->states[slot] = 2;
    m->len -= 1;
    m->tombstones += 1;
    if (m->tombstones > m->len && m->cap > 16)
    {
        map_rehash(m, m->cap);
    }
    return 1;
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
    int64_t *next_items = (int64_t *)tuff_realloc_array(s->items, sizeof(int64_t), cap);
    uint8_t *next_states = (uint8_t *)realloc(s->states, sizeof(uint8_t) * cap);
    if (next_items == NULL || next_states == NULL)
        tuff_panic("Out of memory in set_reserve");
    memset(next_states + s->cap, 0, cap - s->cap);
    s->items = next_items;
    s->states = next_states;
    s->cap = cap;
}

static void set_allocate(TuffSet *s, size_t cap)
{
    s->items = (int64_t *)calloc(cap, sizeof(int64_t));
    s->states = (uint8_t *)calloc(cap, sizeof(uint8_t));
    if (s->items == NULL || s->states == NULL)
        tuff_panic("Out of memory in set_allocate");
    s->cap = cap;
    s->len = 0;
    s->tombstones = 0;
}

static size_t set_find_slot(TuffSet *s, int64_t item, int *found)
{
    size_t mask = s->cap - 1;
    size_t idx = tuff_hash_value(item) & mask;
    size_t first_tomb = (size_t)-1;
    for (;;)
    {
        uint8_t state = s->states[idx];
        if (state == 0)
        {
            if (found != NULL)
                *found = 0;
            return first_tomb != (size_t)-1 ? first_tomb : idx;
        }
        if (state == 2)
        {
            if (first_tomb == (size_t)-1)
                first_tomb = idx;
        }
        else if (tuff_value_equals(s->items[idx], item))
        {
            if (found != NULL)
                *found = 1;
            return idx;
        }
        idx = (idx + 1) & mask;
    }
}

static void set_rehash(TuffSet *s, size_t new_cap)
{
    if (new_cap < 16)
        new_cap = 16;
    size_t cap = 1;
    while (cap < new_cap)
        cap <<= 1;

    TuffSet next = {0};
    set_allocate(&next, cap);
    for (size_t i = 0; i < s->cap; i++)
    {
        if (s->states[i] != 1)
            continue;
        int found = 0;
        size_t slot = set_find_slot(&next, s->items[i], &found);
        next.states[slot] = 1;
        next.items[slot] = s->items[i];
        next.len += 1;
    }

    free(s->items);
    free(s->states);
    *s = next;
}

static void set_ensure_capacity(TuffSet *s)
{
    if (s->cap == 0)
    {
        set_allocate(s, 16);
        return;
    }
    size_t used = s->len + s->tombstones;
    if ((used + 1) * 10 >= s->cap * 7)
    {
        set_rehash(s, s->cap * 2);
    }
    else if (s->tombstones > s->len && s->cap > 16)
    {
        set_rehash(s, s->cap);
    }
}

int64_t set_add(int64_t thisSet, int64_t item)
{
    TuffSet *s = (TuffSet *)tuff_from_val(thisSet);
    item = tuff_canonicalize_key(item);
    if (s == NULL)
        return thisSet;
    set_ensure_capacity(s);
    int found = 0;
    size_t slot = set_find_slot(s, item, &found);
    if (found)
        return thisSet;
    if (s->states[slot] == 2 && s->tombstones > 0)
        s->tombstones -= 1;
    s->states[slot] = 1;
    s->items[slot] = item;
    s->len += 1;
    return thisSet;
}

int64_t set_has(int64_t thisSet, int64_t item)
{
    TuffSet *s = (TuffSet *)tuff_from_val(thisSet);
    if (s == NULL || s->cap == 0)
        return 0;
    item = tuff_canonicalize_key(item);
    int found = 0;
    (void)set_find_slot(s, item, &found);
    return found;
}

int64_t set_delete(int64_t thisSet, int64_t item)
{
    TuffSet *s = (TuffSet *)tuff_from_val(thisSet);
    if (s == NULL || s->cap == 0)
        return 0;
    item = tuff_canonicalize_key(item);
    int found = 0;
    size_t slot = set_find_slot(s, item, &found);
    if (!found)
        return 0;
    s->states[slot] = 2;
    s->len -= 1;
    s->tombstones += 1;
    if (s->tombstones > s->len && s->cap > 16)
    {
        set_rehash(s, s->cap);
    }
    return 1;
}
