# Test runner script for tuffc
# Compiles and runs the test executable

Write-Host "Building test executable..." -ForegroundColor Cyan
clang -Werror test.c execute.c compile.c -o test.exe 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Running tests..." -ForegroundColor Cyan
.\test.exe

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nAll tests passed!" -ForegroundColor Green
}
else {
    Write-Host "`nTests failed!" -ForegroundColor Red
    exit 1
}
