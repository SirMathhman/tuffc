#include <stdio.h>
#include <stdint.h>
#include <string.h>

int main()
{
    uint8_t x = 10;
    unsigned long long __read0_temp;
    scanf("%llu", &__read0_temp);
    uint8_t __read0 = (uint8_t)__read0_temp;
    printf("x before: %d\n", x);
    printf("__read0: %d\n", __read0);
    x = x + __read0;
    printf("x after: %d\n", x);
    return (int)x;
}
