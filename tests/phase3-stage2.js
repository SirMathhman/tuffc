import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { compileFile, compileSource } from "../stage0/compiler.js";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..");
const outDir = path.join(root, "tests", "out", "stage2");
fs.mkdirSync(outDir, { recursive: true });

function expectCompileOk(label, source) {
  try {
    compileSource(source, `<${label}>`, { typecheck: { strictSafety: true } });
  } catch (error) {
    console.error(
      `Expected compile success for ${label}, but failed: ${error.message}`,
    );
    process.exit(1);
  }
}

function expectCompileFail(label, source, expectedMessagePart) {
  try {
    compileSource(source, `<${label}>`, { typecheck: { strictSafety: true } });
    console.error(`Expected compile failure for ${label}, but it compiled`);
    process.exit(1);
  } catch (error) {
    if (!String(error.message).includes(expectedMessagePart)) {
      console.error(
        `Compile failure for ${label} did not include '${expectedMessagePart}'. Actual: ${error.message}`,
      );
      process.exit(1);
    }
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

expectCompileOk(
  "match-exhaustive",
  `struct Some<T> { value : I32 }\nstruct None<T> {}\ntype Option<T> = Some<T> | None<T>;\nfn f(o : Option<I32>) : I32 => match (o) { case Some { value } = value; case None = 0; };`,
);

expectCompileFail(
  "match-non-exhaustive",
  `struct Some<T> { value : I32 }\nstruct None<T> {}\ntype Option<T> = Some<T> | None<T>;\nfn f(o : Option<I32>) : I32 => match (o) { case Some { value } = value; };`,
  "Non-exhaustive match",
);

const moduleEntry = path.join(root, "tests", "modules", "app.tuff");
const moduleOut = path.join(outDir, "module-app.js");
const moduleResult = compileFile(moduleEntry, moduleOut, {
  enableModules: true,
  modules: { moduleBaseDir: path.join(root, "tests", "modules") },
  typecheck: { strictSafety: false },
});

const sandbox = { module: { exports: {} }, exports: {}, console };
vm.runInNewContext(`${moduleResult.js}\nmodule.exports = { main };`, sandbox);
const got = sandbox.module.exports.main();
if (got !== 42) {
  console.error(`Module system test failed: expected 42, got ${got}`);
  process.exit(1);
}

console.log("Phase 3 Stage 2 checks passed");
