// @ts-nocheck
import { compileSourceResult } from "../../main/js/compiler.ts";
import { toDiagnostic } from "../../main/js/errors.ts";

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
