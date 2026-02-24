// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { compileFileResult } from "../../main/js/compiler.ts";
import {
  expectCompileFailMessage as expectCompileFail,
  expectCompileOk,
} from "./compile-test-utils.ts";
import {
  getRepoRootFromImportMeta,
  getTestsOutDir,
} from "./path-test-utils.ts";
import { STRICT_DIV_BY_ZERO_SOURCE } from "./test-fixtures.ts";
import {
  NULLABLE_POINTER_GUARDED_REVERSED_SOURCE,
  NULLABLE_POINTER_GUARDED_SOURCE,
  NULLABLE_POINTER_UNGUARDED_SOURCE,
} from "./test-fixtures.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const outDir = getTestsOutDir(root, "stage2");
fs.mkdirSync(outDir, { recursive: true });

expectCompileOk(
  "refinement-divide-ok",
  `fn divide(n : I32, d : I32 != 0) : I32 => n / d;\nfn main() : I32 => divide(10, 2);`,
  { typecheck: { strictSafety: true } },
);

expectCompileFail(
  "division-proof-fail",
  STRICT_DIV_BY_ZERO_SOURCE,
  "Division by zero",
  { typecheck: { strictSafety: true } },
);

expectCompileOk(
  "flow-sensitive-nonzero",
  `fn safe(x : I32) : I32 => { if (x == 0) { 0 } else { 100 / x } }`,
  { typecheck: { strictSafety: true } },
);

expectCompileOk("overflow-safe-literals", `fn ok() : I32 => 100 + 20;`, {
  typecheck: { strictSafety: true },
});

expectCompileFail(
  "overflow-detected",
  `fn overflow() : I32 => 2147483647 + 1;`,
  "overflow",
  { typecheck: { strictSafety: true } },
);

expectCompileOk(
  "array-bounds-safe",
  `fn inBounds(arr : *[I32; 3; 3]) : I32 => { let i : USize < 3 = 2; arr[i] }`,
  { typecheck: { strictSafety: true } },
);

expectCompileFail(
  "array-bounds-unknown",
  `fn bad(arr : *[I32; 3; 3], i : USize) : I32 => arr[i];`,
  "Cannot prove array index bound safety",
  { typecheck: { strictSafety: true } },
);

expectCompileOk(
  "fat-array-pointer-length",
  `fn ok(arr : *[I32]) : USize => arr.length;`,
  { typecheck: { strictSafety: true } },
);

expectCompileOk(
  "thin-array-pointer-init-and-length",
  `fn ok(arr : *[I32; 3; 5]) : USize => arr.init + arr.length;`,
  { typecheck: { strictSafety: true } },
);

expectCompileFail(
  "thin-array-pointer-initialized-bounds",
  `fn bad(arr : *[I32; 3; 5]) : I32 => arr[4];`,
  "Array index may be out of bounds",
  { typecheck: { strictSafety: true } },
);

expectCompileOk(
  "non-array-pointer-init-member",
  `fn bad(p : *I32) : USize => p.init;`,
  { typecheck: { strictSafety: true } },
);

expectCompileFail(
  "extern-call-type-mismatch",
  `extern fn takesI32(x : I32) : I32;\nfn bad() : I32 => takesI32(true);`,
  "Type mismatch in call to takesI32 arg 1",
  { typecheck: { strictSafety: true } },
);

const pointerExternPrelude =
  "extern fn readPtr(p : *I32) : I32;\nextern fn writePtr(p : *mut I32, v : I32) : I32;\nextern let rp : *I32;\nextern let wp : *mut I32;\n";

expectCompileOk(
  "pointer-types-parse-and-call",
  `${pointerExternPrelude}fn ok() : I32 => { writePtr(wp, 1); readPtr(rp) }`,
  { typecheck: { strictSafety: true } },
);

expectCompileFail(
  "pointer-mutability-mismatch",
  `extern fn writePtr(p : *mut I32, v : I32) : I32;\nextern let rp : *I32;\nfn bad() : I32 => writePtr(rp, 1);`,
  "Type mismatch in call to writePtr arg 1",
  { typecheck: { strictSafety: true } },
);

expectCompileFail(
  "nullable-pointer-unguarded-call",
  NULLABLE_POINTER_UNGUARDED_SOURCE,
  "Nullable pointer",
  { typecheck: { strictSafety: true } },
);

expectCompileOk(
  "nullable-pointer-guarded-call",
  NULLABLE_POINTER_GUARDED_SOURCE,
  {
    typecheck: { strictSafety: true },
  },
);

expectCompileOk(
  "nullable-pointer-guarded-call-reversed",
  NULLABLE_POINTER_GUARDED_REVERSED_SOURCE,
  { typecheck: { strictSafety: true } },
);

expectCompileOk(
  "nullable-pointer-legacy-zero-rejected",
  `fn bad(p : *I32 | 0) : I32 => 0;`,
  { typecheck: { strictSafety: true } },
);

const optionPrelude =
  "struct Some<T> { value : I32 }\nstruct None<T> {}\ntype Option<T> = Some<T> | None<T>;\n";
const optionMatchPrefix = `${optionPrelude}fn f(o : Option<I32>) : I32 => match (o) { `;

expectCompileOk(
  "match-exhaustive",
  `${optionMatchPrefix}case Some { value } = value; case None = 0; };`,
  { typecheck: { strictSafety: true } },
);

expectCompileFail(
  "match-non-exhaustive",
  `${optionMatchPrefix}case Some { value } = value; };`,
  "Non-exhaustive match",
  { typecheck: { strictSafety: true } },
);

const moduleEntry = path.join(
  root,
  "src",
  "test",
  "tuff",
  "modules",
  "app.tuff",
);
const moduleOut = path.join(outDir, "module-app.js");
const moduleResult = compileFileResult(moduleEntry, moduleOut, {
  modules: { moduleBaseDir: path.join(root, "src", "test", "tuff", "modules") },
  typecheck: { strictSafety: false },
});
if (!moduleResult.ok) throw moduleResult.error;

const sandbox = { module: { exports: {} }, exports: {}, console };
vm.runInNewContext(
  `${moduleResult.value.js}\nmodule.exports = { main };`,
  sandbox,
);
const got = sandbox.module.exports.main();
if (got !== 42) {
  console.error(`Module system test failed: expected 42, got ${got}`);
  process.exit(1);
}

const rootResolutionEntry = path.join(
  root,
  "src",
  "test",
  "tuff",
  "modules",
  "app_root_resolution.tuff",
);
const rootResolutionOut = path.join(outDir, "module-app-root-resolution.js");
const rootResolutionResult = compileFileResult(
  rootResolutionEntry,
  rootResolutionOut,
  {
    modules: {
      moduleBaseDir: path.join(root, "src", "test", "tuff", "modules"),
    },
    typecheck: { strictSafety: false },
  },
);
if (!rootResolutionResult.ok) throw rootResolutionResult.error;

const rootResolutionSandbox = { module: { exports: {} }, exports: {}, console };
vm.runInNewContext(
  `${rootResolutionResult.value.js}\nmodule.exports = { main };`,
  rootResolutionSandbox,
);
const rootResolutionGot = rootResolutionSandbox.module.exports.main();
if (rootResolutionGot !== 42) {
  console.error(
    `Root module-base resolution test failed: expected 42, got ${rootResolutionGot}`,
  );
  process.exit(1);
}

const privateModuleDir = path.join(outDir, "private-module");
fs.mkdirSync(privateModuleDir, { recursive: true });
const privateMain = path.join(privateModuleDir, "Main.tuff");
const privateLib = path.join(privateModuleDir, "Lib.tuff");
const privateOut = path.join(privateModuleDir, "Main.js");
fs.writeFileSync(
  privateLib,
  "fn hidden() : I32 => 1;\nout fn shown() : I32 => 2;\n",
  "utf8",
);
fs.writeFileSync(
  privateMain,
  "let { hidden } = Lib;\nfn main() : I32 => hidden();\n",
  "utf8",
);

const privateImportResult = compileFileResult(privateMain, privateOut, {
  modules: { moduleBaseDir: privateModuleDir },
  typecheck: { strictSafety: false },
});
if (privateImportResult.ok) {
  console.error("Expected non-exported import to fail, but it compiled");
  process.exit(1);
}
if (
  !String(privateImportResult.error?.message ?? "").includes(
    "not exported with 'out'",
  )
) {
  console.error(
    `Expected non-exported import failure message, got: ${privateImportResult.error?.message}`,
  );
  process.exit(1);
}

console.log("Phase 3 Stage 2 checks passed");
