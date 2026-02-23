// @ts-nocheck
import { compileSourceResult } from "../../main/js/compiler.ts";
import { toDiagnostic } from "../../main/js/errors.ts";

export function formatCompileError(error: any): string {
  const code = error?.code ?? "E_UNKNOWN";
  const message = error?.message ?? String(error);
  const loc = error?.loc
    ? `${error.loc.file ?? "<memory>"}:${error.loc.line ?? "?"}:${error.loc.column ?? "?"}`
    : "<no-loc>";
  const reason = error?.reason ? `\nreason: ${error.reason}` : "";
  const fix = error?.fix ? `\nfix: ${error.fix}` : "";
  return `[${code}] ${message}\nloc: ${loc}${reason}${fix}`;
}

export function expectCompileOk(label, source, options = {}) {
  const result = compileSourceResult(source, `<${label}>`, options);
  if (!result.ok) {
    console.error(
      `Expected compile success for ${label}, but failed: ${result.error.message}`,
    );
    process.exit(1);
  }
}

export function expectCompileFailMessage(
  label,
  source,
  expectedMessagePart,
  options = {},
) {
  const result = compileMustFail(label, source, options);
  if (!String(result.error.message).includes(expectedMessagePart)) {
    console.error(
      `Compile failure for ${label} did not include '${expectedMessagePart}'. Actual: ${result.error.message}`,
    );
    process.exit(1);
  }
}

function compileMustFail(label, source, options = {}) {
  const result = compileSourceResult(source, `<${label}>`, options);
  if (result.ok) {
    console.error(`Expected compile failure for ${label}, but it compiled`);
    process.exit(1);
  }
  return result;
}

export function expectCompileFailCode(
  label,
  source,
  expectedCode,
  options = {},
) {
  const result = compileMustFail(label, source, options);
  const diag = toDiagnostic(result.error);
  expectDiagnosticCode(diag, expectedCode, label);
}

export function expectDiagnosticCode(diag, expectedCode, label) {
  if (diag.code !== expectedCode) {
    console.error(
      `Expected ${expectedCode} for ${label}, got ${diag.code} (${diag.message})`,
    );
    process.exit(1);
  }
}

export function assertStdlibModuleOutput(result, moduleName, expectedSymbol) {
  if (!result.ok) {
    console.error(
      `Expected ${moduleName}.tuff to compile via selfhost backend, got:\n${formatCompileError(result.error)}`,
    );
    process.exit(1);
  }
  const output = result.value.output;
  if (!output.includes(expectedSymbol)) {
    console.error(
      `Expected generated output to include ${expectedSymbol} implementation from ${moduleName}.tuff`,
    );
    process.exit(1);
  }
}

export function assertCOutput(result, label) {
  if (!result.ok) {
    console.error(
      `Expected C compile success for ${label}, got: ${result.error.message}`,
    );
    process.exit(1);
  }
  if (
    typeof result.value.c !== "string" ||
    !result.value.c.includes("int main(void)")
  ) {
    console.error(`Expected C output for ${label}`);
    process.exit(1);
  }
}

export function assertCompileSuccessGetOutput(result, label: string): string {
  return assertCompileOk(result, label).output;
}

export function assertCompileOk(result, label: string) {
  if (!result.ok) {
    console.error(`Expected ${label} to compile, got: ${result.error.message}`);
    process.exit(1);
  }
  return result.value;
}

export function compileToCEmpty(
  compileSourceResult,
  source: string,
  label: string,
): string {
  const result = compileSourceResult(source, label, {
    backend: "selfhost",
    target: "c",
    cSubstrate: "",
    lint: { enabled: false },
    borrowcheck: { enabled: false },
    typecheck: { strictSafety: false },
  });
  return assertCompileSuccessGetOutput(result, label);
}
