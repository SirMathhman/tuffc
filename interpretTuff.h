#ifndef INTERPRET_TUFF_H
#define INTERPRET_TUFF_H

typedef struct Result
{
    int ok;
    unsigned long long uvalue;
    long long svalue;
    int is_unsigned;
    const char *error;
} Result;

Result interpretTuff(const char *source);

#endif
