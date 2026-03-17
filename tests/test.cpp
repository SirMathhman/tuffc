#include "compileTuffToC.h"
#include <assert.h>

int main(void)
{
    // === EXISTING TESTS ===
    assert(execute("", NULL) == 0);
    assert(execute("100U8", NULL) == 100);
    assert(execute("read<U8>()", "100") == 100);

    // === ADDITION TESTS ===
    // Spec requirement: read<U8>() + read<U8>() with "100 50" => 150
    assert(execute("read<U8>() + read<U8>()", "100 50") == 150);

    // Literal addition
    assert(execute("100U8 + 50U8", NULL) == 150);

    // Mixed literal and read
    assert(execute("read<U8>() + 50U8", "100") == 150);
    assert(execute("100U8 + read<U8>()", "50") == 150);

    // Multiple additions (left-to-right)
    assert(execute("read<U8>() + read<U8>() + read<U8>()", "10 20 30") == 60);

    // === SUBTRACTION TESTS ===
    assert(execute("read<U8>() - read<U8>()", "100 50") == 50);
    assert(execute("200U8 - 100U8", NULL) == 100);
    assert(execute("read<U8>() - 50U8", "150") == 100);

    // === MULTIPLICATION TESTS ===
    assert(execute("read<U8>() * read<U8>()", "10 5") == 50);
    assert(execute("10U8 * 5U8", NULL) == 50);
    assert(execute("read<U8>() * 5U8", "10") == 50);

    // === DIVISION TESTS ===
    assert(execute("read<U8>() / read<U8>()", "100 2") == 50);
    assert(execute("100U8 / 2U8", NULL) == 50);
    assert(execute("read<U8>() / 2U8", "100") == 50);

    // === OPERATOR PRECEDENCE TESTS (standard math precedence) ===
    // * and / bind tighter than + and -
    assert(execute("2U8 + 3U8 * 4U8", NULL) == 14); // 2 + 12 = 14, not 20
    assert(execute("10U8 - 2U8 * 3U8", NULL) == 4); // 10 - 6 = 4, not 24
    assert(execute("12U8 / 2U8 + 1U8", NULL) == 7); // 6 + 1 = 7, not 4
    assert(execute("read<U8>() + read<U8>() * read<U8>()", "2 3 4") == 14);

    // === PARENTHESES/GROUPING TESTS ===
    // (2 + 3) * 4 = 20, compare with 2 + 3 * 4 = 14
    assert(execute("(2U8 + 3U8) * 4U8", NULL) == 20);
    assert(execute("(10U8 - 2U8) * 3U8", NULL) == 24);
    assert(execute("(read<U8>() + read<U8>()) * read<U8>()", "2 3 4") == 20);

    // === NESTED/COMPLEX EXPRESSIONS ===
    assert(execute("((2U8 + 3U8) * 4U8)", NULL) == 20);
    assert(execute("(2U8 + (3U8 * 4U8))", NULL) == 14);
    assert(execute("((read<U8>() + read<U8>()) * (read<U8>() + read<U8>()))", "2 3 4 5") == 45); // (2+3)*(4+5) = 5*9 = 45

    // === WHITESPACE HANDLING ===
    // Parser should handle various spacing
    assert(execute("read<U8>( ) + read<U8>( )", "100 50") == 150);
    assert(execute("100U8+50U8", NULL) == 150);
    assert(execute("100U8 + 50U8", NULL) == 150);

    return 0;
}
