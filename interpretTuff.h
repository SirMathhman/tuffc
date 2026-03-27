#ifndef INTERPRET_TUFF_H
#define INTERPRET_TUFF_H

typedef struct Result
{
    int ok;
    int value;
    const char *error;
} Result;

Result interpretTuff(const char *source);

#endif