// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { compileFileResult } from "../../main/js/compiler.ts";
import { runMainFromJs } from "./js-runtime-test-utils.ts";
import { getRepoRootFromImportMeta } from "./path-test-utils.ts";
import { assertCOutput } from "./compile-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const outDir = path.join(root, "tests", "out", "module-package-aliases");

const appDir = path.join(outDir, "app");
const coreDir = path.join(outDir, "libs", "tuff-core");
const jsDir = path.join(outDir, "libs", "tuff-js");
const cDir = path.join(outDir, "libs", "tuff-c");

const entry = path.join(appDir, "Main.tuff");
const outJsDefault = path.join(outDir, "default.js");
const outJsTargeted = path.join(outDir, "targeted.js");
const outC = path.join(outDir, "targeted.c");

fs.mkdirSync(appDir, { recursive: true });
fs.mkdirSync(coreDir, { recursive: true });
fs.mkdirSync(jsDir, { recursive: true });
fs.mkdirSync(cDir, { recursive: true });

fs.writeFileSync(
  entry,
  [
    "let { value } = tuff_core::Math;",
    "fn main() : I32 => value() + 1;",
    "",
  ].join("\n"),
  "utf8",
);

fs.writeFileSync(
  path.join(coreDir, "Math.tuff"),
  "out fn value() : I32 => 40;\n",
  "utf8",
);
fs.writeFileSync(
  path.join(jsDir, "Math.tuff"),
  "out fn value() : I32 => 42;\n",
  "utf8",
);
fs.writeFileSync(
  path.join(cDir, "Math.tuff"),
  "out fn value() : I32 => 41;\n",
  "utf8",
);

const fallback = compileFileResult(entry, outJsDefault, {
  backend: "selfhost",
  target: "js",
  enableModules: true,
  modules: {
    moduleBaseDir: appDir,
    packageAliases: {
      tuff_core: coreDir,
    },
  },
});
if (!fallback.ok) {
  console.error(
    `Expected fallback alias compile success, got: ${fallback.error.message}`,
  );
  process.exit(1);
}

const fallbackValue = runMainFromJs(fallback.value.js, "module-alias-fallback");
if (fallbackValue !== 41) {
  console.error(
    `Expected fallback alias runtime value 41, got ${JSON.stringify(fallbackValue)}`,
  );
  process.exit(1);
}

const allTargetsModuleConfig = {
  moduleBaseDir: appDir,
  packageAliases: {
    tuff_core: coreDir,
  },
  packageAliasesByTarget: {
    js: {
      tuff_core: jsDir,
    },
    c: {
      tuff_core: cDir,
    },
  },
};

const targetedJs = compileFileResult(entry, outJsTargeted, {
  backend: "selfhost",
  target: "js",
  enableModules: true,
  modules: allTargetsModuleConfig,
});
if (!targetedJs.ok) {
  console.error(
    `Expected targeted alias compile success, got: ${targetedJs.error.message}`,
  );
  process.exit(1);
}

const targetedJsValue = runMainFromJs(
  targetedJs.value.js,
  "module-alias-targeted-js",
);
if (targetedJsValue !== 43) {
  console.error(
    `Expected targeted JS alias runtime value 43, got ${JSON.stringify(targetedJsValue)}`,
  );
  process.exit(1);
}

const targetedC = compileFileResult(entry, outC, {
  backend: "selfhost",
  target: "c",
  enableModules: true,
  modules: allTargetsModuleConfig,
});
assertCOutput(targetedC, "module package alias");

console.log("Module package-alias resolution checks passed");
