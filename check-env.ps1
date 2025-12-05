Write-Output "Checking java and maven installations..."

try {
    $java = & java --version 2>&1
    Write-Output "java --version output:"
    Write-Output $java
} catch {
    Write-Output "java not found on PATH"
}

try {
    $mvn = & mvn -v 2>&1
    Write-Output "mvn -v output:"
    Write-Output $mvn
} catch {
    Write-Output "maven not found on PATH"
}

Write-Output "To build and run tests: mvn -B test"
