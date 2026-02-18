// @ts-nocheck
import { compileSourceResult } from "../../main/js/compiler.ts";
import { toDiagnostic } from "../../main/js/errors.ts";
import { expectDiagnosticCode } from "./compile-test-utils.ts";

const missingAttribution = `
extern fn strlen(s: *Str) : I32;

fn main() : I32 => strlen("abc");
`;

const missingResult = compileSourceResult(
  missingAttribution,
  "<extern-missing-attribution>",
  {
    backend: "selfhost",
    target: "c",
    lint: { enabled: false },
    borrowcheck: { enabled: false },
    typecheck: { strictSafety: false },
  },
);

if (missingResult.ok) {
  console.error(
    "Expected compile failure for missing extern source attribution in selfhost C backend",
  );
  process.exit(1);
}

expectDiagnosticCode(
  toDiagnostic(missingResult.error),
  "E_EXTERN_NO_SOURCE",
  "selfhost extern attribution missing",
);

const coveredAttribution = `
extern let { strlen } = string;
extern fn strlen(s: *Str) : I32;

fn main() : I32 => strlen("abc") - 3;
`;

const coveredResult = compileSourceResult(
  coveredAttribution,
  "<extern-covered-attribution>",
  {
    backend: "selfhost",
    target: "c",
    lint: { enabled: false },
    borrowcheck: { enabled: false },
    typecheck: { strictSafety: false },
  },
);

if (!coveredResult.ok) {
  console.error(
    `Expected compile success for covered extern source attribution, got: ${coveredResult.error.message}`,
  );
  process.exit(1);
}

console.log("Extern source attribution checks passed");
