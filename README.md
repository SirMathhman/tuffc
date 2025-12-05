# tuffc — simple Maven Java project

This repository contains a tiny Maven-based Java project created for quick checks.

Quick checks:

- Show Java version:

  ```powershell
  java --version
  ```

- Show Maven version:

  ```powershell
  mvn -v
  ```

- Build and run tests:

  ```powershell
  mvn -B test
  ```

After building, run the app with:

```powershell
mvn -q exec:java -Dexec.mainClass=com.example.App
```
