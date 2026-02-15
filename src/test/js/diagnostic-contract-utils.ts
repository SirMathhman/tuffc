// @ts-nocheck

export function assertDiagnosticContract(diag, label = "diagnostic") {
  for (const key of ["source", "cause", "reason", "fix"]) {
    if (!diag[key] || typeof diag[key] !== "string") {
      console.error(
        `Expected ${label} field '${key}' to be a non-empty string`,
      );
      process.exit(1);
    }
  }
}
