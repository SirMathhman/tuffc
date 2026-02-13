clang ./src/main.c ./src/common.c ./tests/test.c -Werror -o ./dist/test.exe;
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

./dist/test.exe;
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }