CXX     = clang++
CXXFLAGS = -Wall -Wextra -Wpedantic -Werror -std=c++11 -Isrc

SRCS    = src/compileTuffToC.cpp
TEST_SRCS = tests/test.cpp

all: test

test: $(SRCS) $(TEST_SRCS)
	$(CXX) $(CXXFLAGS) $(SRCS) $(TEST_SRCS) -o test.exe

run: test
	./test.exe

clean:
	del /f test.exe 2>nul || true
