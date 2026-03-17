CC      = clang
CFLAGS  = -Wall -Wextra -Wpedantic -Werror -std=c99 -Isrc

SRCS    = src/main.c
TEST_SRCS = tests/main.test.c

all: test

test: $(SRCS) $(TEST_SRCS)
	$(CC) $(CFLAGS) $(SRCS) $(TEST_SRCS) -o test.exe

run: test
	./test.exe

clean:
	del /f test.exe 2>nul || true
