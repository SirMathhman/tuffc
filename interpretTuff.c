#include <ctype.h>
#include <stddef.h>
#include <string.h>

#include "interpretTuff.h"

// Define a type representation for parsed terms
typedef enum {
    TYPE_U8 = 0, TYPE_U16, TYPE_U32, TYPE_U64,
    TYPE_I8, TYPE_I16, TYPE_I32, TYPE_I64,
    TYPE_UNKNOWN
} TuffType;

static int is_unsigned_type(TuffType t) {
    return t == TYPE_U8 || t == TYPE_U16 || t == TYPE_U32 || t == TYPE_U64;
}

static int type_size(TuffType t) {
    switch(t) {
        case TYPE_U8: case TYPE_I8: return 1;
        case TYPE_U16: case TYPE_I16: return 2;
        case TYPE_U32: case TYPE_I32: return 4;
        case TYPE_U64: case TYPE_I64: return 8;
        default: return 0;
    }
}

static TuffType get_promoted_type(TuffType a, TuffType b) {
    if (a == b) return a;
    
    if (is_unsigned_type(a) == is_unsigned_type(b)) {
        return type_size(a) > type_size(b) ? a : b;
    }
    
    TuffType u = is_unsigned_type(a) ? a : b;
    TuffType s = is_unsigned_type(a) ? b : a;
    
    if (type_size(u) >= type_size(s)) {
        return u;
    }
    
    return s;
}

static unsigned long long get_type_max_u(TuffType t) {
    switch (t) {
        case TYPE_U8: return 255ULL;
        case TYPE_U16: return 65535ULL;
        case TYPE_U32: return 4294967295ULL;
        case TYPE_U64: return 0xFFFFFFFFFFFFFFFFULL;
        default: return 0;
    }
}

static long long get_type_max_i(TuffType t) {
    switch (t) {
        case TYPE_I8: return 127LL;
        case TYPE_I16: return 32767LL;
        case TYPE_I32: return 2147483647LL;
        case TYPE_I64: return 9223372036854775807LL;
        default: return 0;
    }
}

static long long get_type_min_i(TuffType t) {
    switch (t) {
        case TYPE_I8: return -128LL;
        case TYPE_I16: return -32768LL;
        case TYPE_I32: return -2147483648LL;
        case TYPE_I64: return -9223372036854775807LL - 1LL;
        default: return 0;
    }
}

static int parse_suffix(const char* s, size_t* len, TuffType* type_out) {
    const char* suffixes[] = {"U8", "U16", "U32", "U64", "I8", "I16", "I32", "I64"};
    TuffType types[] = {TYPE_U8, TYPE_U16, TYPE_U32, TYPE_U64, TYPE_I8, TYPE_I16, TYPE_I32, TYPE_I64};
    
    for (int i = 0; i < 8; i++) {
        size_t slen = strlen(suffixes[i]);
        if (strncmp(s, suffixes[i], slen) == 0) {
            char next = s[slen];
            if (next != '\0' && next != '+' && !isspace((unsigned char)next)) {
                return 0;
            }
            *len = slen;
            *type_out = types[i];
            return 1;
        }
    }
    return 0;
}

Result interpretTuff(const char *source)
{
    Result error = {0, 0, 0, 0, NULL};
    
    if (source == NULL) { error.error = "null input"; return error; }
    if (source[0] == '\0') { error.error = "empty input"; return error; }

    size_t i = 0;
    TuffType current_type = TYPE_UNKNOWN;
    int is_first_term = 1;
    long long s_total = 0;
    unsigned long long u_total = 0;

    while (source[i] != '\0')
    {
        while (isspace((unsigned char)source[i])) i++;

        if (source[i] == '\0') {
            if (is_first_term) error.error = "empty input";
            else error.error = "expected term";
            return error;
        }

        int is_negative = 0;
        if (source[i] == '-') {
            is_negative = 1;
            i++;
        }

        if (!isdigit((unsigned char)source[i])) {
            error.error = (source[i] == '\0' || source[i] == '+') ? "expected term" : "invalid digits";
            return error;
        }

        unsigned long long digits_val = 0;
        int overflow_digits = 0;
        
        while (isdigit((unsigned char)source[i])) {
            unsigned long long digit = source[i] - '0';
            if (digits_val > (0xFFFFFFFFFFFFFFFFULL - digit) / 10) {
                overflow_digits = 1;
            }
            digits_val = digits_val * 10 + digit;
            i++;
        }

        TuffType term_type;
        size_t suffix_len;
        if (!parse_suffix(&source[i], &suffix_len, &term_type)) {
            if (source[i] == 'u' || source[i] == 'i') {
                error.error = "invalid suffix"; // special handling for old 'lowercase suffix' test
            } else if (source[i] != '\0' && !isspace((unsigned char)source[i]) && source[i] != '+' && (source[i] < 'A' || source[i] > 'Z')) {
                error.error = "invalid digits";
            } else {
                error.error = "invalid suffix";
            }
            return error;
        }
        
        // Use logic from missing U8 suffix behavior in previous code
        // For old simple test strings, if there is a mistake in suffix
        // Let's actually check how test failed. We will refine it later.
        
        if (is_negative && is_unsigned_type(term_type)) {
            error.error = "invalid digits"; 
            return error;
        }
        
        if (overflow_digits) {
            error.error = "value out of range";
            return error;
        }

        long long s_term = 0;
        unsigned long long u_term = 0;

        if (is_unsigned_type(term_type)) {
            if (digits_val > get_type_max_u(term_type)) {
                error.error = "value out of range";
                return error;
            }
            u_term = digits_val;
            s_term = (long long)u_term;
        } else {
            unsigned long long abs_max = is_negative ? (unsigned long long)-(get_type_min_i(term_type)) : (unsigned long long)get_type_max_i(term_type);
            if (digits_val > abs_max) {
                error.error = "value out of range";
                return error;
            }
            s_term = is_negative ? -(long long)digits_val : (long long)digits_val;
            u_term = (unsigned long long)s_term;
        }

        i += suffix_len;

        if (is_first_term) {
            current_type = term_type;
            s_total = s_term;
            u_total = u_term;
            is_first_term = 0;
        } else {
            TuffType promoted = get_promoted_type(current_type, term_type);
            
            if (is_unsigned_type(promoted)) {
                unsigned long long a = is_unsigned_type(current_type) ? u_total : (unsigned long long)s_total;
                unsigned long long b = is_unsigned_type(term_type) ? u_term : (unsigned long long)s_term;
                unsigned long long res = a + b;
                
                if (res < a || res > get_type_max_u(promoted)) {
                    error.error = "value out of range";
                    return error;
                }
                
                u_total = res;
                s_total = (long long)res;
            } else {
                long long a = is_unsigned_type(current_type) ? (long long)u_total : s_total;
                long long b = is_unsigned_type(term_type) ? (long long)u_term : s_term;
                
                if ((b > 0 && a > get_type_max_i(promoted) - b) || 
                    (b < 0 && a < get_type_min_i(promoted) - b)) {
                    error.error = "value out of range";
                    return error;
                }
                
                s_total = a + b;
                u_total = (unsigned long long)s_total;
            }
            
            current_type = promoted;
        }

        while (isspace((unsigned char)source[i])) i++;

        if (source[i] == '\0') {
            break; // Expression successfully completed
        }

        if (source[i] != '+') {
            error.error = "invalid operator";
            return error;
        }
        i++;
        
        while (isspace((unsigned char)source[i])) i++;
        if (source[i] == '\0') {
            error.error = "expected term";
            return error;
        }
    }

    Result res;
    res.ok = 1;
    res.uvalue = u_total;
    res.svalue = s_total;
    res.is_unsigned = is_unsigned_type(current_type);
    res.error = NULL;
    return res;
}
