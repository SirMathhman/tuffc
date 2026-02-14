// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import {
  compileFileResult,
  compileSourceResult,
} from "../../main/js/compiler.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const outDir = path.join(root, "tests", "out", "stage2");
fs.mkdirSync(outDir, { recursive: true });

function expectCompileOk(label, source) {
  const result = compileSourceResult(source, `<${label}>`, {
    typecheck: { strictSafety: true },
  });
  if (!result.ok) {
    console.error(
      `Expected compile success for ${label}, but failed: ${result.error.message}`,
    );
    process.exit(1);
  }
}

function expectCompileFail(label, source, expectedMessagePart) {
  const result = compileSourceResult(source, `<${label}>`, {
    typecheck: { strictSafety: true },
  });
  if (result.ok) {
    console.error(`Expected compile failure for ${label}, but it compiled`);
    process.exit(1);
  }
  if (!String(result.error.message).includes(expectedMessagePart)) {
    console.error(
      `Compile failure for ${label} did not include '${expectedMessagePart}'. Actual: ${result.error.message}`,
    );
    process.exit(1);
  }
}

expectCompileOk(
  "refinement-divide-ok",
  `fn divide(n : I32, d : I32 != 0) : I32 => n / d;\nfn main() : I32 => divide(10, 2);`,
);

expectCompileFail(
  "division-proof-fail",
  `fn bad(x : I32) : I32 => 100 / x;`,
  "Division by zero",
);

expectCompileOk(
  "flow-sensitive-nonzero",
  `fn safe(x : I32) : I32 => { if (x == 0) { 0 } else { 100 / x } }`,
);

expectCompileOk("overflow-safe-literals", `fn ok() : I32 => 100 + 20;`);

expectCompileFail(
  "overflow-detected",
  `fn overflow() : I32 => 2147483647 + 1;`,
  "overflow",
);

expectCompileOk(
  "array-bounds-safe",
  `fn inBounds(arr : *[I32; 3; 3]) : I32 => { let i : USize < 3 = 2; arr[i] }`,
);

expectCompileFail(
  "array-bounds-unknown",
  `fn bad(arr : *[I32; 3; 3], i : USize) : I32 => arr[i];`,
  "Cannot prove array index bound safety",
);

expectCompileFail(
  "extern-call-type-mismatch",
  `extern fn takesI32(x : I32) : I32;\nfn bad() : I32 => takesI32(true);`,
  "Type mismatch in call to takesI32 arg 1",
);

expectCompileOk(
  "pointer-types-parse-and-call",
  `extern fn readPtr(p : *I32) : I32;\nextern fn writePtr(p : *mut I32, v : I32) : I32;\nextern let rp : *I32;\nextern let wp : *mut I32;\nfn ok() : I32 => { writePtr(wp, 1); readPtr(rp) }`,
);

expectCompileFail(
  "pointer-mutability-mismatch",
  `extern fn writePtr(p : *mut I32, v : I32) : I32;\nextern let rp : *I32;\nfn bad() : I32 => writePtr(rp, 1);`,
  "Type mismatch in call to writePtr arg 1",
);

expectCompileOk(
  "match-exhaustive",
  `struct Some<T> { value : I32 }\nstruct None<T> {}\ntype Option<T> = Some<T> | None<T>;\nfn f(o : Option<I32>) : I32 => match (o) { case Some { value } = value; case None = 0; };`,
);

expectCompileFail(
  "match-non-exhaustive",
  `struct Some<T> { value : I32 }\nstruct None<T> {}\ntype Option<T> = Some<T> | None<T>;\nfn f(o : Option<I32>) : I32 => match (o) { case Some { value } = value; };`,
  "Non-exhaustive match",
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
  enableModules: true,
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
    enableModules: true,
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
  enableModules: true,
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
