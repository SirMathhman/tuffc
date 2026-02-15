#ifndef TUFF_RUNTIME_H
#define TUFF_RUNTIME_H

#include <stdint.h>

#ifdef __cplusplus
extern "C"
{
#endif

    void tuff_panic(const char *message);

#ifdef __cplusplus
}
#endif

#endif /* TUFF_RUNTIME_H */
