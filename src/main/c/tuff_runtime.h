#ifndef TUFF_RUNTIME_H
#define TUFF_RUNTIME_H

#include <stdint.h>

#ifdef __cplusplus
extern "C"
{
#endif

    typedef int64_t TuffValue;
    typedef int64_t StringBuilder;
    typedef int64_t Vec;
    typedef int64_t Map;
    typedef int64_t Set;

    /* Panic */
    void tuff_panic(const char *message);

    /* String operations (string values are passed as int64_t pointer handles) */
    int64_t str_length(int64_t s);
    int64_t str_char_at(int64_t s, int64_t i);
    int64_t str_slice(int64_t s, int64_t start, int64_t end);
    int64_t str_concat(int64_t a, int64_t b);
    int64_t str_eq(int64_t a, int64_t b);
    int64_t str_from_char_code(int64_t code);
    int64_t str_index_of(int64_t s, int64_t needle);
    int64_t str_includes(int64_t s, int64_t needle);
    int64_t str_starts_with(int64_t s, int64_t prefix);
    int64_t str_trim(int64_t s);
    int64_t str_replace_all(int64_t s, int64_t from, int64_t to);
    int64_t char_code(int64_t ch);
    int64_t int_to_string(int64_t n);
    int64_t parse_int(int64_t s);

    /* String builder */
    int64_t sb_new(void);
    int64_t sb_append(int64_t sb, int64_t s);
    int64_t sb_append_char(int64_t sb, int64_t code);
    int64_t sb_build(int64_t sb);

    /* Vec */
    int64_t vec_new(void);
    int64_t vec_push(int64_t thisVec, int64_t item);
    int64_t vec_pop(int64_t thisVec);
    int64_t vec_get(int64_t thisVec, int64_t i);
    int64_t vec_set(int64_t thisVec, int64_t i, int64_t v);
    int64_t vec_length(int64_t thisVec);
    int64_t vec_clear(int64_t thisVec);
    int64_t vec_join(int64_t thisVec, int64_t sep);
    int64_t vec_includes(int64_t thisVec, int64_t item);

    /* Map */
    int64_t map_new(void);
    int64_t map_set(int64_t thisMap, int64_t k, int64_t v);
    int64_t map_get(int64_t thisMap, int64_t k);
    int64_t map_has(int64_t thisMap, int64_t k);

    /* Set */
    int64_t set_new(void);
    int64_t set_add(int64_t thisSet, int64_t item);
    int64_t set_has(int64_t thisSet, int64_t item);
    int64_t set_delete(int64_t thisSet, int64_t item);

    /* File/path and output */
    int64_t read_file(int64_t filePath);
    int64_t write_file(int64_t filePath, int64_t contents);
    int64_t path_join(int64_t a, int64_t b);
    int64_t path_dirname(int64_t p);
    int64_t print(int64_t s);
    int64_t print_error(int64_t s);
    int64_t panic(int64_t msg);
    int64_t panic_with_code(int64_t code, int64_t msg, int64_t reason, int64_t fix);

#ifdef __cplusplus
}
#endif

#endif /* TUFF_RUNTIME_H */
