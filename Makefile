# Select a compiler.
# On Windows prefer MSVC cl, then gcc/clang from MinGW/MSYS.
# On non-Windows prefer cc, then gcc/clang.

ifeq ($(OS),Windows_NT)
  EXE = interpretTuff_test.exe
  ifneq ($(shell where cl 2>nul),)
    CC = cl
    CFLAGS = /W3
  else ifneq ($(shell where gcc 2>nul),)
    CC = gcc
    CFLAGS = -std=c11 -Wall -Wextra -O2
  else ifneq ($(shell where clang 2>nul),)
    CC = clang
    CFLAGS = -std=c11 -Wall -Wextra -O2
  else
    $(error No C compiler found on PATH; install Visual Studio Build Tools or MinGW/MSYS and ensure cl/gcc/clang is available)
  endif
else
  EXE = interpretTuff_test
  ifneq ($(shell command -v cc 2>/dev/null),)
    CC = cc
    CFLAGS = -std=c11 -Wall -Wextra -O2
  else ifneq ($(shell command -v gcc 2>/dev/null),)
    CC = gcc
    CFLAGS = -std=c11 -Wall -Wextra -O2
  else ifneq ($(shell command -v clang 2>/dev/null),)
    CC = clang
    CFLAGS = -std=c11 -Wall -Wextra -O2
  else
    $(error No C compiler found on PATH; install gcc/clang and ensure cc is available)
  endif
endif

all: interpretTuff_test

interpretTuff_test: interpretTuff.c interpretTuff_test.c
ifeq ($(CC),cl)
	$(CC) $(CFLAGS) interpretTuff.c interpretTuff_test.c /Fe:$(EXE)
else
	$(CC) $(CFLAGS) interpretTuff.c interpretTuff_test.c -o $(EXE)
endif

run: interpretTuff_test
ifeq ($(OS),Windows_NT)
	./$(EXE)
else
	./$(EXE)
endif

clean:
ifeq ($(OS),Windows_NT)
	del /Q $(EXE) 2>nul || true
else
	rm -f $(EXE)
endif
