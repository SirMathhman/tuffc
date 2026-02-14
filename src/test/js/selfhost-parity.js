import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { compileFile, compileSource } from "../../main/js/compiler.js";
import { toDiagnostic } from "../../main/js/errors.js";
import * as runtime from "../../main/js/runtime.js";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const outDir = path.join(root, "tests", "out", "selfhost", "parity");
const modulesBase = path.join(root, "src", "test", "tuff", "modules");
const moduleEntry = path.join(modulesBase, "app.tuff");
const selfhostPath = path.join(root, "src", "main", "tuff", "selfhost.tuff");

fs.mkdirSync(outDir, { recursive: true });

function loadSelfhost() {
  const selfhostSource = fs.readFileSync(selfhostPath, "utf8");
  const selfhostResult = compileSource(selfhostSource, selfhostPath, {
    resolve: {
      hostBuiltins: Object.keys(runtime),
      allowHostPrefix: "",
    },
  });

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    ...runtime,
  };

  vm.runInNewContext(
    `${selfhostResult.js}\nmodule.exports = { compile_source, compile_file, main };`,
    sandbox,
  );

  const selfhost = sandbox.module.exports;
  if (
    typeof selfhost.compile_source !== "function" ||
    typeof selfhost.compile_file !== "function"
  ) {
    throw new Error("selfhost compiler exports are incomplete");
  }
  return selfhost;
}

function runMainFromJs(js, label) {
  const sandbox = { module: { exports: {} }, exports: {}, console };
  vm.runInNewContext(`${js}\nmodule.exports = { main };`, sandbox);
  if (typeof sandbox.module.exports.main !== "function") {
    throw new Error(`${label}: generated JS does not export main()`);
  }
  return sandbox.module.exports.main();
}

function assertContract(diag, label) {
  for (const key of ["source", "cause", "reason", "fix"]) {
    if (!diag[key] || typeof diag[key] !== "string") {
      throw new Error(
        `${label}: diagnostic field '${key}' must be a non-empty string`,
      );
    }
  }
}

function expectBothFail(jsFn, selfhostFn, label, expectedCode = null) {
  let jsError = null;
  let selfhostError = null;

  try {
    jsFn();
  } catch (error) {
    jsError = error;
  }

  try {
    selfhostFn();
  } catch (error) {
    selfhostError = error;
  }

  if (!jsError || !selfhostError) {
    throw new Error(`${label}: expected both compilers to fail`);
  }

  const jsDiag = toDiagnostic(jsError);
  const selfhostDiag = toDiagnostic(selfhostError);
  assertContract(jsDiag, `${label} (js)`);
  assertContract(selfhostDiag, `${label} (selfhost)`);
  if (expectedCode) {
    if (jsDiag.code !== expectedCode) {
      throw new Error(
        `${label} (js): expected diagnostic code ${expectedCode}, got ${jsDiag.code}`,
      );
    }
    if (selfhostDiag.code !== expectedCode) {
      throw new Error(
        `${label} (selfhost): expected diagnostic code ${expectedCode}, got ${selfhostDiag.code}`,
      );
    }
  }
}

const selfhost = loadSelfhost();

// 1) Runtime parity on in-memory source.
const factorialSource = `
fn factorial(n: I32) : I32 => {
  if (n <= 1) { 1 } else { n * factorial(n - 1) }
}
fn main() : I32 => factorial(5);
`;

const jsFactorial = compileSource(factorialSource, "<parity-factorial-js>").js;
const selfhostFactorial = selfhost.compile_source(factorialSource);
const jsFactorialResult = runMainFromJs(jsFactorial, "js-factorial");
const selfhostFactorialResult = runMainFromJs(
  selfhostFactorial,
  "selfhost-factorial",
);
if (jsFactorialResult !== selfhostFactorialResult) {
  throw new Error(
    `factorial parity mismatch: js=${jsFactorialResult}, selfhost=${selfhostFactorialResult}`,
  );
}

const enumSource = `
enum Color { Red, Blue }
fn pick(c: Color) : I32 =>
  match (c) {
    case Red = 1;
    case Blue = 2;
  };
fn main() : I32 => pick(Color.Blue);
`;
const jsEnum = compileSource(enumSource, "<parity-enum-js>").js;
const selfhostEnum = selfhost.compile_source(enumSource);
const jsEnumResult = runMainFromJs(jsEnum, "js-enum");
const selfhostEnumResult = runMainFromJs(selfhostEnum, "selfhost-enum");
if (jsEnumResult !== selfhostEnumResult) {
  throw new Error(
    `enum parity mismatch: js=${jsEnumResult}, selfhost=${selfhostEnumResult}`,
  );
}

// 2) Module compile_file parity.
const jsModuleOut = path.join(outDir, "module-js.js");
const selfhostModuleOut = path.join(outDir, "module-selfhost.js");

const jsModule = compileFile(moduleEntry, jsModuleOut, {
  enableModules: true,
  modules: { moduleBaseDir: modulesBase },
});
selfhost.compile_file(moduleEntry, selfhostModuleOut);

const jsModuleResult = runMainFromJs(jsModule.js, "js-module");
const selfhostModuleJs = fs.readFileSync(selfhostModuleOut, "utf8");
const selfhostModuleResult = runMainFromJs(selfhostModuleJs, "selfhost-module");
if (jsModuleResult !== selfhostModuleResult) {
  throw new Error(
    `module parity mismatch: js=${jsModuleResult}, selfhost=${selfhostModuleResult}`,
  );
}

// 3) Parse failure parity (both must fail with diagnostics contract).
expectBothFail(
  () => compileSource("fn broken( : I32 => 0;", "<parity-bad-js>"),
  () => selfhost.compile_source("fn broken( : I32 => 0;"),
  "parse-failure parity",
);

// 4) Missing module failure parity (both must fail with diagnostics contract).
const missingEntry = path.join(outDir, "missing-module-entry.tuff");
const missingJsOut = path.join(outDir, "missing-module-js.js");
const missingSelfhostOut = path.join(outDir, "missing-module-selfhost.js");
fs.writeFileSync(
  missingEntry,
  "let { x } = com::meti::DefinitelyMissing;\nfn main() : I32 => x();\n",
  "utf8",
);

expectBothFail(
  () =>
    compileFile(missingEntry, missingJsOut, {
      enableModules: true,
      modules: { moduleBaseDir: path.dirname(missingEntry) },
    }),
  () => selfhost.compile_file(missingEntry, missingSelfhostOut),
  "missing-module parity",
);

// 5) Module cycle failure parity (both must fail with diagnostics contract).
const cycleDir = path.join(outDir, "cycle");
const cycleA = path.join(cycleDir, "A.tuff");
const cycleB = path.join(cycleDir, "B.tuff");
const cycleJsOut = path.join(cycleDir, "cycle-js.js");
const cycleSelfhostOut = path.join(cycleDir, "cycle-selfhost.js");
fs.mkdirSync(cycleDir, { recursive: true });
fs.writeFileSync(cycleA, "let { b } = B;\nfn a() : I32 => b();\n", "utf8");
fs.writeFileSync(cycleB, "let { a } = A;\nfn b() : I32 => a();\n", "utf8");

expectBothFail(
  () =>
    compileFile(cycleA, cycleJsOut, {
      enableModules: true,
      modules: { moduleBaseDir: cycleDir },
    }),
  () => selfhost.compile_file(cycleA, cycleSelfhostOut),
  "module-cycle parity",
  "E_MODULE_CYCLE",
);

// 6) Unknown identifier failure parity.
expectBothFail(
  () => compileSource("fn main() : I32 => missing_symbol;", "<unknown-id-js>"),
  () => selfhost.compile_source("fn main() : I32 => missing_symbol;"),
  "unknown-identifier parity",
  "E_RESOLVE_UNKNOWN_IDENTIFIER",
);

// 7) Duplicate global declaration parity.
const dupSource = `
fn collide() : I32 => 1;
fn collide() : I32 => 2;
fn main() : I32 => collide();
`;

expectBothFail(
  () => compileSource(dupSource, "<dup-global-js>"),
  () => selfhost.compile_source(dupSource),
  "duplicate-global parity",
  "E_RESOLVE_SHADOWING",
);

// 8) Function call arity mismatch parity (first type-semantics gate).
const aritySource = `
fn add(a: I32, b: I32) : I32 => a + b;
fn main() : I32 => add(1);
`;

expectBothFail(
  () => compileSource(aritySource, "<arity-js>"),
  () => selfhost.compile_source(aritySource),
  "arity-mismatch parity",
);

// 9) Non-exported module import parity.
const privateDir = path.join(outDir, "private-import");
const privateLib = path.join(privateDir, "Lib.tuff");
const privateEntry = path.join(privateDir, "Main.tuff");
const privateJsOut = path.join(privateDir, "main-js.js");
const privateSelfhostOut = path.join(privateDir, "main-selfhost.js");
fs.mkdirSync(privateDir, { recursive: true });
fs.writeFileSync(
  privateLib,
  "fn hidden() : I32 => 1;\nout fn shown() : I32 => 2;\n",
  "utf8",
);
fs.writeFileSync(
  privateEntry,
  "let { hidden } = Lib;\nfn main() : I32 => hidden();\n",
  "utf8",
);

expectBothFail(
  () =>
    compileFile(privateEntry, privateJsOut, {
      enableModules: true,
      modules: { moduleBaseDir: privateDir },
    }),
  () => selfhost.compile_file(privateEntry, privateSelfhostOut),
  "private-import parity",
  "E_MODULE_PRIVATE_IMPORT",
);

console.log("Selfhost differential parity checks passed");
