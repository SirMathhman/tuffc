// @ts-nocheck
import { compileSourceResult } from "../../main/js/compiler.ts";
import { toDiagnostic } from "../../main/js/errors.ts";
import {
  expectDiagnosticCode,
  assertCompileSuccessGetOutput,
} from "./compile-test-utils.ts";

const strlenExternDecl = `extern fn strlen(src: *Str) : I32;

fn main() : I32 => strlen("hello")`;

const C_COMPILE_OPTS = {
  backend: "selfhost",
  target: "c",
  lint: { enabled: false },
  borrowcheck: { enabled: false },
  typecheck: { strictSafety: false },
};

const missingAttribution = `
${strlenExternDecl};
`;

const missingResult = compileSourceResult(
  missingAttribution,
  "<extern-missing-attribution>",
  C_COMPILE_OPTS,
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
${strlenExternDecl} - 3;
`;

const coveredResult = compileSourceResult(
  coveredAttribution,
  "<extern-covered-attribution>",
  C_COMPILE_OPTS,
);

assertCompileSuccessGetOutput(
  coveredResult,
  "covered extern source attribution",
);

console.log("Extern source attribution checks passed");
