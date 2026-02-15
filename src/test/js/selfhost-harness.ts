// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { compileFileThrow } from "../../main/js/compiler.ts";
import * as runtime from "../../main/js/runtime.ts";

export function compileAndLoadSelfhost(root: string, outDir: string) {
  const selfhostPath = path.join(root, "src", "main", "tuff", "selfhost.tuff");
  fs.mkdirSync(outDir, { recursive: true });

  const selfhostResult = compileFileThrow(
    selfhostPath,
    path.join(outDir, "selfhost.js"),
    {
      enableModules: true,
      modules: { moduleBaseDir: path.dirname(selfhostPath) },
      resolve: {
        hostBuiltins: Object.keys(runtime),
        allowHostPrefix: "",
      },
    },
  );

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    ...runtime,
  };

  const exportedNames = [
    "compile_source",
    "compile_file",
    "compile_source_with_options",
    "compile_file_with_options",
    "take_lint_issues",
    "main",
  ].join(", ");

  vm.runInNewContext(
    `${selfhostResult.js}\nmodule.exports = { ${exportedNames} };`,
    sandbox,
  );

  return {
    selfhostPath,
    selfhostJs: selfhostResult.js,
    selfhost: sandbox.module.exports,
  };
}
