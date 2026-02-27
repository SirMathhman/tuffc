// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { runMainFromJs } from "./js-runtime-test-utils.ts";
import { assertDiagnosticContract } from "./diagnostic-contract-utils.ts";
import {
  buildStageChain,
  normalizeDiag,
  buildStageById,
} from "./stage-matrix-harness.ts";
import {
  COPY_ALIAS_INVALID_BOX_SOURCE,
  COPY_STRUCT_VEC2_PROGRAM,
  MOVE_AFTER_MOVE_BOX_SOURCE,
} from "./test-fixtures.ts";
import {
  getRepoRootFromImportMeta,
  getTestsOutDir,
} from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const outDir = getTestsOutDir(root, "stage-equivalence");
const casesDir = path.join(root, "src", "test", "tuff", "cases");
fs.mkdirSync(outDir, { recursive: true });

const stageEquivalenceCaseSkips = new Set([
  // Uses pipe-lambda syntax (`|x| ...`) that is not yet supported consistently
  // across Stage2-3 in the bootstrap chain.
  "iterSemantics.tuff",
]);

const chain = buildStageChain(root, path.join(outDir, "bootstrap"));

const stageById = buildStageById(chain);
const stages = [stageById.stage2, stageById.stage3];

import { assertEqual } from "./assert-utils.ts";

function runPositiveCase(label, source, expectedOutput = undefined) {
  const outputs = new Map();
  for (const stage of stages) {
    const result = stage.compileSource(source, `<${label}:${stage.id}>`);
    if (!result.ok) {
      const diag = normalizeDiag(result.error);
      console.error(
        `${label}: ${stage.id} failed unexpectedly (${diag.code}) ${diag.message}`,
      );
      process.exit(1);
    }
    outputs.set(stage.id, runMainFromJs(result.js, `${label}:${stage.id}`));
  }

  const baseline = outputs.get("stage3");
  for (const stage of stages) {
    const actual = outputs.get(stage.id);
    if (expectedOutput !== undefined) {
      assertEqual(actual, expectedOutput, `${label}:${stage.id}`);
    } else {
      assertEqual(actual, baseline, `${label}:${stage.id} parity`);
    }
  }
}

function runNegativeCase(label, source, expectedCodes, options = {}) {
  const requiredStages = stages;
  let stage2Code = undefined;

  for (const stage of requiredStages) {
    const result = stage.compileSource(
      source,
      `<${label}:${stage.id}>`,
      options,
    );
    if (result.ok) {
      console.error(`${label}: ${stage.id} unexpectedly compiled`);
      process.exit(1);
    }

    const diag = normalizeDiag(result.error);
    assertDiagnosticContract(diag, `${label}:${stage.id}`);
    if (!expectedCodes.includes(diag.code)) {
      console.error(
        `${label}: ${stage.id} expected one of ${expectedCodes.join(", ")}, got ${diag.code}`,
      );
      process.exit(1);
    }

    if (stage.id === "stage2") stage2Code = diag.code;
    if (stage.id === "stage3" && stage2Code && diag.code !== stage2Code) {
      console.error(
        `${label}: Stage2/Stage3 diagnostic mismatch (${stage2Code} vs ${diag.code})`,
      );
      process.exit(1);
    }
  }
}

for (const name of fs
  .readdirSync(casesDir)
  .filter((f) => f.endsWith(".tuff"))
  .filter((f) => !stageEquivalenceCaseSkips.has(f))) {
  const filePath = path.join(casesDir, name);
  const source = fs.readFileSync(filePath, "utf8");
  const expectedResultPath = filePath.replace(/\.tuff$/i, ".result.json");
  const expected = fs.existsSync(expectedResultPath)
    ? JSON.parse(fs.readFileSync(expectedResultPath, "utf8"))
    : undefined;
  runPositiveCase(`case:${name}`, source, expected);
}

runPositiveCase("positive:copy-struct", COPY_STRUCT_VEC2_PROGRAM.trim(), 0);
runPositiveCase(
  "positive:simple-arith",
  `fn sq(x : I32) : I32 => x * x;\nfn main() : I32 => sq(6);`,
  36,
);

runNegativeCase("neg:parse", "fn broken( : I32 => 0;", [
  "E_PARSE_EXPECTED_TOKEN",
  "E_SELFHOST_INTERNAL_ERROR",
]);
runNegativeCase("neg:unknown-id", "fn main() : I32 => missing_symbol;", [
  "E_RESOLVE_UNKNOWN_IDENTIFIER",
]);
runNegativeCase(
  "neg:shadowing",
  [
    "fn collide() : I32 => 1;",
    "fn collide() : I32 => 2;",
    "fn main() : I32 => collide();",
    "",
  ].join("\n"),
  ["E_RESOLVE_SHADOWING"],
);
runNegativeCase("neg:copy-alias-invalid", COPY_ALIAS_INVALID_BOX_SOURCE, [
  "E_BORROW_INVALID_COPY_ALIAS",
  "E_SELFHOST_INTERNAL_ERROR",
]);
runNegativeCase("neg:use-after-move", MOVE_AFTER_MOVE_BOX_SOURCE, [
  "E_BORROW_USE_AFTER_MOVE",
  "E_SELFHOST_INTERNAL_ERROR",
]);

console.log("Universal stage equivalence checks passed (Stage2-3)");
