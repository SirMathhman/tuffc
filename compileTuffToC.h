#ifndef COMPILE_TUFF_TO_C_H
#define COMPILE_TUFF_TO_C_H

#include <stdlib.h>

/**
 * Compiles Tuff code to C code
 * @param tuffCode The Tuff source code to compile (null-terminated)
 * @return The compiled C code as a string (caller must free)
 */
char *compileTuffToC(const char *tuffCode);

/**
 * Compiles Tuff code, writes to temp .c file, compiles with clang, and executes
 * @param tuffCode The Tuff source code to compile (null-terminated)
 * @param stdIn    String to feed as stdin to the process, or NULL for none
 * @return The exit code of the executed binary, or negative on error
 */
int execute(const char *tuffCode, const char *stdIn);

#endif // COMPILE_TUFF_TO_C_H
