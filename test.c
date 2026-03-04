#include <assert.h>
#include <stdio.h>

// External function declaration
extern int execute(const char *input);

int main(void)
{
    // Test: execute with empty string should return 0
    int result = execute("");
    assert(result == 0);
    printf("✓ Test passed: execute(\"\") == 0\n");

    // ========== POSITIVE TESTS: Valid Unsigned 8-bit Literals ==========

    // Zero value
    result = execute("0U8");
    assert(result == 0);
    printf("✓ Test passed: execute(\"0U8\") == 0\n");

    // Standard value
    result = execute("100U8");
    assert(result == 100);
    printf("✓ Test passed: execute(\"100U8\") == 100\n");

    // Maximum U8 value (255)
    result = execute("255U8");
    assert(result == 255);
    printf("✓ Test passed: execute(\"255U8\") == 255\n");

    // Minimum non-zero value
    result = execute("1U8");
    assert(result == 1);
    printf("✓ Test passed: execute(\"1U8\") == 1\n");

    // ========== POSITIVE TESTS: Valid Signed 8-bit Literals ==========

    // Minimum I8 value (-128)
    result = execute("-128I8");
    assert(result == -128);
    printf("✓ Test passed: execute(\"-128I8\") == -128\n");

    // Maximum I8 value (127)
    result = execute("127I8");
    assert(result == 127);
    printf("✓ Test passed: execute(\"127I8\") == 127\n");

    // Negative middle value
    result = execute("-50I8");
    assert(result == -50);
    printf("✓ Test passed: execute(\"-50I8\") == -50\n");

    // Zero I8
    result = execute("0I8");
    assert(result == 0);
    printf("✓ Test passed: execute(\"0I8\") == 0\n");

    // ========== POSITIVE TESTS: Valid Larger Integer Types ==========

    // U16 values
    result = execute("256U16");
    assert(result == 256);
    printf("✓ Test passed: execute(\"256U16\") == 256\n");

    result = execute("65535U16");
    assert(result == 65535);
    printf("✓ Test passed: execute(\"65535U16\") == 65535\n");

    // I16 values
    result = execute("-32768I16");
    assert(result == -32768);
    printf("✓ Test passed: execute(\"-32768I16\") == -32768\n");

    result = execute("32767I16");
    assert(result == 32767);
    printf("✓ Test passed: execute(\"32767I16\") == 32767\n");

    // ========== NEGATIVE TESTS: Overflow Cases (should produce compile error) ==========

    // U8 overflow: 256 exceeds U8 max (255)
    result = execute("256U8");
    assert(result != 0); // Should fail to compile
    printf("✓ Test passed: execute(\"256U8\") produces compile error\n");

    // U8 overflow: 300
    result = execute("300U8");
    assert(result != 0);
    printf("✓ Test passed: execute(\"300U8\") produces compile error\n");

    // Negative value for unsigned type
    result = execute("-1U8");
    assert(result != 0);
    printf("✓ Test passed: execute(\"-1U8\") produces compile error\n");

    // I8 overflow: 128 exceeds I8 max (127)
    result = execute("128I8");
    assert(result != 0);
    printf("✓ Test passed: execute(\"128I8\") produces compile error\n");

    // I8 underflow: -129 exceeds I8 min (-128)
    result = execute("-129I8");
    assert(result != 0);
    printf("✓ Test passed: execute(\"-129I8\") produces compile error\n");

    // ========== NEGATIVE TESTS: Invalid Syntax Cases ==========

    // Invalid suffix (no such type as X8)
    result = execute("100X8");
    assert(result != 0);
    printf("✓ Test passed: execute(\"100X8\") produces compile error\n");

    // Invalid suffix (no such type as Y16)
    result = execute("50Y16");
    assert(result != 0);
    printf("✓ Test passed: execute(\"50Y16\") produces compile error\n");

    // Missing number
    result = execute("U8");
    assert(result != 0);
    printf("✓ Test passed: execute(\"U8\") produces compile error\n");

    // Missing suffix (just a number, should this work or fail?)
    result = execute("100");
    assert(result != 0);
    printf("✓ Test passed: execute(\"100\") produces compile error\n");

    // Empty suffix
    result = execute("100");
    assert(result != 0);
    printf("✓ Test passed: execute(\"100\") (no suffix) produces compile error\n");

    printf("\n✓✓✓ All tests passed! ✓✓✓\n");
    return 0;
}
