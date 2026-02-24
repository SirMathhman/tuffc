// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
  compileFileResult,
  compileSourceResult,
} from "../../main/js/compiler.ts";
import { toDiagnostic } from "../../main/js/errors.ts";
import { runMainFromJs } from "./js-runtime-test-utils.ts";
import {
  getRepoRootFromImportMeta,
  getTestsOutDir,
} from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const outDir = getTestsOutDir(root, "selfhost", "stress");
const modulesDir = path.join(outDir, "modules");
fs.mkdirSync(outDir, { recursive: true });

function normalizeError(error) {
  const diag = toDiagnostic(error);
  return {
    code: diag.code,
    message: diag.message,
    reason: diag.reason,
    fix: diag.fix,
  };
}

function timed(label, fn) {
  const start = performance.now();
  try {
    const value = fn();
    return {
      ok: true,
      label,
      ms: performance.now() - start,
      value,
    };
  } catch (error) {
    return {
      ok: false,
      label,
      ms: performance.now() - start,
      error,
    };
  }
}

function unwrapTimedResult(result) {
  if (!result.ok) {
    return { ok: false, ms: result.ms, crash: normalizeError(result.error) };
  }
  if (!result.value.ok) {
    return { ok: false, ms: result.ms, error: normalizeError(result.value.error) };
  }
  return { ok: true, ms: result.ms, js: result.value.value.js };
}

function compileSourceWithBackend(source, filePath, backend, options = {}) {
  return unwrapTimedResult(
    timed(`${backend}:${filePath}`, () =>
      compileSourceResult(source, filePath, {
        backend,
        ...options,
      }),
    ),
  );
}

function compileFileWithBackend(inputPath, outputPath, backend, options = {}) {
  return unwrapTimedResult(
    timed(`${backend}:${inputPath}`, () =>
      compileFileResult(inputPath, outputPath, {
        backend,
        ...options,
      }),
    ),
  );
}

function runtimeExecGap(who, error) {
  return `${who} runtime execution failed: ${normalizeError(error).code} (${normalizeError(error).message})`;
}

function diagnosticSpecificityGap(stage0Code, selfhostCode) {
  return `Diagnostic specificity gap: stage0=${stage0Code}, selfhost=${selfhostCode}`;
}

function makeWideAddProgram(width) {
  const terms = Array.from({ length: width }, (_, i) => String(i));
  return `fn main() : I32 => ${terms.join(" + ")};\n`;
}

function makeDeepIfProgram(depth) {
  let body = `${depth}`;
  for (let i = depth - 1; i >= 0; i--) {
    body = `if (true) { ${body} } else { ${i} }`;
  }
  return `fn main() : I32 => { ${body} }\n`;
}

function makeLargeFunctionSet(count) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    lines.push(`fn f${i}(x: I32) : I32 => x + ${i};`);
  }
  lines.push("fn main() : I32 => {");
  lines.push("  let acc : I32 = 0;");
  for (let i = 0; i < count; i++) {
    lines.push(`  acc = f${i}(acc);`);
  }
  lines.push("  acc");
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

function makeNestedParenProgram(depth) {
  return `fn main() : I32 => ${"(".repeat(depth)}1${")".repeat(depth)};\n`;
}

function writeModuleFanout(dir, count) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  for (let i = 0; i < count; i++) {
    const modName = `M${i}`;
    const next = i < count - 1 ? `M${i + 1}` : "";
    const importLine =
      next.length > 0 ? `let { value_${i + 1} } = ${next};\n` : "";
    const valueExpr = next.length > 0 ? `value_${i + 1}() + 1` : "1";
    const source = `${importLine}out fn value_${i}() : I32 => ${valueExpr};\n`;
    fs.writeFileSync(path.join(dir, `${modName}.tuff`), source, "utf8");
  }

  const appSource = `
let { value_0 } = M0;
fn main() : I32 => value_0();
`;
  const entry = path.join(dir, "app.tuff");
  fs.writeFileSync(entry, appSource.trimStart(), "utf8");
  return entry;
}

function compareProgramCase(name, source, expectedMain) {
  const stage0 = compileSourceWithBackend(source, `<${name}>`, "selfhost");
  const selfhost = compileSourceWithBackend(source, `<${name}>`, "selfhost");
  const gaps = [];

  if (stage0.ok && selfhost.ok) {
    let stage0Result;
    let selfhostResult;
    try {
      stage0Result = runMainFromJs(stage0.js, `${name}:stage0`);
    } catch (error) {
      gaps.push(runtimeExecGap("Stage0", error));
      return { name, stage0, selfhost, gaps };
    }
    try {
      selfhostResult = runMainFromJs(selfhost.js, `${name}:selfhost`);
    } catch (error) {
      gaps.push(runtimeExecGap("Selfhost", error));
      return { name, stage0, selfhost, gaps };
    }
    if (stage0Result !== selfhostResult) {
      gaps.push(
        `Runtime divergence: stage0=${stage0Result}, selfhost=${selfhostResult}`,
      );
    }
    if (expectedMain !== undefined && selfhostResult !== expectedMain) {
      gaps.push(
        `Unexpected runtime result: got ${selfhostResult}, expected ${expectedMain}`,
      );
    }
  }
  pushParityGaps(gaps, stage0, selfhost);

  if (
    selfhost.ok &&
    stage0.ok &&
    selfhost.ms > stage0.ms * 4 &&
    selfhost.ms > 200
  ) {
    gaps.push(
      `Performance cliff: selfhost ${selfhost.ms.toFixed(1)}ms vs stage0 ${stage0.ms.toFixed(1)}ms`,
    );
  }

  if (!selfhost.ok) {
    const selfhostCode = selfhost.error?.code ?? selfhost.crash?.code;
    const stage0Code = stage0.error?.code ?? stage0.crash?.code;
    if (selfhostCode === "E_UNKNOWN" || selfhostCode === "E_GENERIC") {
      gaps.push(
        "Crash quality gap: selfhost threw non-specific/internal error code",
      );
    }
    if (
      stage0Code &&
      selfhostCode &&
      stage0Code !== selfhostCode &&
      (selfhostCode === "E_GENERIC" ||
        selfhostCode === "E_SELFHOST_INTERNAL_ERROR")
    ) {
      gaps.push(diagnosticSpecificityGap(stage0Code, selfhostCode));
    }
}

function compareCompileOnlyCase(name, source) {
  const stage0 = compileSourceWithBackend(
    source,
    `<${name}:compile-only>`,
    "selfhost",
  );
  const selfhost = compileSourceWithBackend(
    source,
    `<${name}:compile-only>`,
    "selfhost",
  );
  const gaps = [];
  pushParityGaps(gaps, stage0, selfhost, "compile-only case");
  pushCompileOnlyQualityGap(gaps, stage0, "Stage0");
  pushCompileOnlyQualityGap(gaps, selfhost, "Selfhost");

  return { name, stage0, selfhost, gaps };
}

function pushParityGaps(gaps, stage0, selfhost, label = "") {
  const suffix = label ? ` ${label}` : "";
  if (stage0.ok && !selfhost.ok) {
    gaps.push(
      `Selfhost failed${suffix} while stage0 succeeded (${selfhost.error?.code ?? selfhost.crash?.code ?? "unknown"})`,
    );
  } else if (!stage0.ok && selfhost.ok) {
    gaps.push(
      `Selfhost accepted${suffix} input that stage0 rejected (${stage0.error?.code ?? stage0.crash?.code ?? "unknown"})`,
    );
  }
}

function pushCompileOnlyQualityGap(gaps, result, who) {
  if (!result.ok) {
    const code = result.error?.code ?? result.crash?.code;
    if (code === "E_UNKNOWN" || code === "E_GENERIC") {
      gaps.push(`${who} diagnostic quality gap in compile-only case (${code})`);
    }
  }
}

function checkHazardResult(result, stageName, gaps, genericCodes, expectedCodes) {
  if (result.ok) {
    gaps.push(`Critical safety gap: ${stageName} accepted hazard under strict safety`);
    return;
  }
  const code = result.error?.code ?? result.crash?.code;
  if (genericCodes.has(code)) {
    gaps.push(`Critical diagnostic gap (${stageName}): strict-safety hazard produced generic code ${code}`);
  }
  if (expectedCodes.length > 0 && !expectedCodes.includes(code)) {
    gaps.push(`Diagnostic specificity gap (${stageName}): expected one of [${expectedCodes.join(", ")}], got ${code ?? "unknown"}`);
  }
}

function checkCRuntimeHazardRejection(name, source, expectedCodes = []) {
  // Stage0 can target C today; selfhost cannot, so we still enforce strict-safety on selfhost JS.
  const stage0 = compileSourceWithBackend(
    source,
    `<${name}:stage0-c>`,
    "selfhost",
    {
      target: "c",
      typecheck: { strictSafety: true },
    },
  );
  const selfhost = compileSourceWithBackend(
    source,
    `<${name}:selfhost-strict>`,
    "selfhost",
    {
      typecheck: { strictSafety: true },
    },
  );

  const gaps = [];
  const genericCodes = new Set(["E_UNKNOWN", "E_GENERIC"]);

  if (stage0.ok) {
    gaps.push(
      "Critical safety gap: stage0 accepted hazard under strict safety for C target",
    );
  } else {
    checkHazardResult(stage0, "stage0", gaps, genericCodes, expectedCodes);
  }

  checkHazardResult(selfhost, "selfhost", gaps, genericCodes, expectedCodes);

  return { name, stage0, selfhost, gaps };
}

function makeAbsurdIdentifierProgram(length) {
  const absurd = `id_${"x".repeat(length)}`;
  return `fn ${absurd}(x : I32) : I32 => x;\nfn main() : I32 => ${absurd}(42);\n`;
}

function makeDeepBinaryTreeAdd(leafCount) {
  let nodes = Array.from({ length: leafCount }, (_, i) => `${i % 10}`);
  while (nodes.length > 1) {
    const next = [];
    for (let i = 0; i < nodes.length; i += 2) {
      if (i + 1 < nodes.length) {
        next.push(`(${nodes[i]} + ${nodes[i + 1]})`);
      } else {
        next.push(nodes[i]);
      }
    }
    nodes = next;
  }
  return `fn main() : I32 => ${nodes[0]};\n`;
}

const cases = [
  {
    name: "wide-add-2000",
    source: makeWideAddProgram(2000),
    expectedMain: (1999 * 2000) / 2,
  },
  {
    name: "deep-if-350",
    source: makeDeepIfProgram(350),
    expectedMain: 350,
  },
  {
    name: "many-functions-1800",
    source: makeLargeFunctionSet(1800),
    expectedMain: (1799 * 1800) / 2,
  },
  {
    name: "nested-parens-2500",
    source: makeNestedParenProgram(2500),
    expectedMain: 1,
  },
];

const results = [];
for (const c of cases) {
  results.push(compareProgramCase(c.name, c.source, c.expectedMain));
}

const cHazardCases = [
  {
    name: "hazard-div-by-zero-strict",
    source: "fn bad(x : I32) : I32 => 100 / x;\n",
    expectedCodes: ["E_SAFETY_DIV_BY_ZERO", "E_SELFHOST_INTERNAL_ERROR"],
  },
  {
    name: "hazard-mod-by-zero-strict",
    source: "fn bad(x : I32) : I32 => 10 % x;\n",
    expectedCodes: ["E_SAFETY_MOD_BY_ZERO", "E_SELFHOST_INTERNAL_ERROR"],
  },
  {
    name: "hazard-overflow-strict",
    source: "fn bad() : I32 => 2147483647 + 1;\n",
    expectedCodes: ["E_SAFETY_OVERFLOW", "E_SELFHOST_INTERNAL_ERROR"],
  },
  {
    name: "hazard-nullable-pointer-unguarded",
    source: "fn bad(p : *I32 | 0USize) : I32 => p[0];\n",
    expectedCodes: [
      "E_SAFETY_NULLABLE_POINTER_GUARD",
      "E_SELFHOST_INTERNAL_ERROR",
    ],
  },
  {
    name: "hazard-array-oob-literal",
    source: "fn bad(arr : *[I32; 3; 3]) : I32 => arr[4];\n",
    expectedCodes: ["E_SAFETY_ARRAY_BOUNDS", "E_SELFHOST_INTERNAL_ERROR"],
  },
  {
    name: "hazard-array-bounds-unproven",
    source: "fn bad(arr : *[I32; 3; 3], i : USize) : I32 => arr[i];\n",
    expectedCodes: [
      "E_SAFETY_ARRAY_BOUNDS_UNPROVEN",
      "E_SELFHOST_INTERNAL_ERROR",
    ],
  },
  {
    name: "hazard-div-by-zero-self-cancel",
    source: "fn bad(x : I32) : I32 => 100 / (x - x);\n",
    expectedCodes: ["E_SAFETY_INTEGER_OVERFLOW", "E_SELFHOST_INTERNAL_ERROR"],
  },
  {
    name: "hazard-mod-by-zero-self-cancel",
    source: "fn bad(x : I32) : I32 => 10 % (x - x);\n",
    expectedCodes: ["E_SAFETY_MOD_BY_ZERO", "E_SELFHOST_INTERNAL_ERROR"],
  },
  {
    name: "hazard-overflow-multiply-strict",
    source: "fn bad() : I32 => 50000 * 50000;\n",
    expectedCodes: ["E_SAFETY_INTEGER_OVERFLOW", "E_SELFHOST_INTERNAL_ERROR"],
  },
  {
    name: "hazard-nullable-pointer-guard-alias-bypass",
    source: [
      "fn bad(p : *I32 | 0USize) : I32 => {",
      "  let q : *I32 | 0USize = p;",
      "  if (p != 0USize) { q[0] } else { 0 }",
      "}",
      "",
    ].join("\n"),
    expectedCodes: [
      "E_SAFETY_NULLABLE_POINTER_GUARD",
      "E_SELFHOST_INTERNAL_ERROR",
    ],
  },
  {
    name: "hazard-borrow-use-after-move",
    source: [
      "struct Box { v : I32 }",
      "fn bad() : I32 => {",
      "  let b : Box = Box { v: 1 };",
      "  let moved : Box = b;",
      "  b.v",
      "}",
      "",
    ].join("\n"),
    expectedCodes: ["E_BORROW_USE_AFTER_MOVE", "E_SELFHOST_INTERNAL_ERROR"],
  },
  {
    name: "hazard-borrow-move-while-borrowed",
    source: [
      "struct Box { v : I32 }",
      "fn bad() : I32 => {",
      "  let b : Box = Box { v: 1 };",
      "  let r : *Box = &b;",
      "  let moved : Box = b;",
      "  0",
      "}",
      "",
    ].join("\n"),
    expectedCodes: [
      "E_BORROW_MOVE_WHILE_BORROWED",
      "E_SELFHOST_INTERNAL_ERROR",
    ],
  },
  {
    name: "hazard-borrow-mut-conflict",
    source: [
      "struct Box { v : I32 }",
      "fn bad() : I32 => {",
      "  let b : Box = Box { v: 1 };",
      "  let r1 : *Box = &b;",
      "  let r2 : *mut Box = &mut b;",
      "  0",
      "}",
      "",
    ].join("\n"),
    expectedCodes: ["E_BORROW_MUT_CONFLICT", "E_SELFHOST_INTERNAL_ERROR"],
  },
  {
    name: "hazard-borrow-immut-while-mut",
    source: [
      "struct Box { v : I32 }",
      "fn bad() : I32 => {",
      "  let b : Box = Box { v: 1 };",
      "  let r1 : *mut Box = &mut b;",
      "  let r2 : *Box = &b;",
      "  0",
      "}",
      "",
    ].join("\n"),
    expectedCodes: ["E_BORROW_IMMUT_WHILE_MUT", "E_SELFHOST_INTERNAL_ERROR"],
  },
  {
    name: "hazard-borrow-assign-while-borrowed",
    source: [
      "struct Box { v : I32 }",
      "fn bad() : I32 => {",
      "  let b : Box = Box { v: 1 };",
      "  let r : *Box = &b;",
      "  b = Box { v: 2 };",
      "  0",
      "}",
      "",
    ].join("\n"),
    expectedCodes: [
      "E_BORROW_ASSIGN_WHILE_BORROWED",
      "E_SELFHOST_INTERNAL_ERROR",
    ],
  },
  {
    name: "hazard-borrow-invalid-target",
    source: [
      "fn bad() : I32 => {",
      "  let x : I32 = 1;",
      "  let r : *I32 = &(x + 1);",
      "  0",
      "}",
      "",
    ].join("\n"),
    expectedCodes: ["E_BORROW_INVALID_TARGET", "E_SELFHOST_INTERNAL_ERROR"],
  },
  {
    name: "hazard-borrow-invalid-copy-alias",
    source: [
      "struct Box { v : I32 }",
      "copy type BoxAlias = Box;",
      "fn main() : I32 => 0;",
      "",
    ].join("\n"),
    expectedCodes: ["E_BORROW_INVALID_COPY_ALIAS", "E_SELFHOST_INTERNAL_ERROR"],
  },
  {
    name: "hazard-borrow-use-after-drop",
    source: [
      "type DroppableI32 = I32 then myDestructor;",
      "fn myDestructor(this : *move DroppableI32) : Void => {}",
      "fn bad() : I32 => {",
      "  let x : DroppableI32 = 1;",
      "  drop(x);",
      "  let y : DroppableI32 = x;",
      "  0",
      "}",
      "",
    ].join("\n"),
    expectedCodes: ["E_BORROW_USE_AFTER_DROP", "E_SELFHOST_INTERNAL_ERROR"],
  },
  {
    name: "hazard-borrow-double-drop",
    source: [
      "type DroppableI32 = I32 then myDestructor;",
      "fn myDestructor(this : *move DroppableI32) : Void => {}",
      "fn bad() : I32 => {",
      "  let x : DroppableI32 = 1;",
      "  x.drop();",
      "  drop(x);",
      "  0",
      "}",
      "",
    ].join("\n"),
    expectedCodes: ["E_BORROW_DOUBLE_DROP", "E_SELFHOST_INTERNAL_ERROR"],
  },
];

for (const c of cHazardCases) {
  results.push(checkCRuntimeHazardRejection(c.name, c.source, c.expectedCodes));
}

const absurdCompileOnlyCases = [
  {
    name: "absurd-identifier-20k",
    source: makeAbsurdIdentifierProgram(20000),
  },
  {
    name: "absurd-deep-binary-tree-add-4096",
    source: makeDeepBinaryTreeAdd(4096),
  },
  {
    name: "absurd-nested-parens-12000",
    source: makeNestedParenProgram(12000),
  },
  {
    name: "absurd-wide-add-12000",
    source: makeWideAddProgram(12000),
  },
];

for (const c of absurdCompileOnlyCases) {
  results.push(compareCompileOnlyCase(c.name, c.source));
}

// Module fanout stress is file-based and module-aware.
const moduleEntry = writeModuleFanout(modulesDir, 400);
const moduleJsOutStage0 = path.join(modulesDir, "app.stage0.js");
const moduleJsOutSelfhost = path.join(modulesDir, "app.selfhost.js");
const moduleStage0 = compileFileWithBackend(
  moduleEntry,
  moduleJsOutStage0,
  "selfhost",
  {
    modules: { moduleBaseDir: modulesDir },
  },
);
const moduleSelfhost = compileFileWithBackend(
  moduleEntry,
  moduleJsOutSelfhost,
  "selfhost",
  {
    modules: { moduleBaseDir: modulesDir },
  },
);

const moduleGaps = [];
if (moduleStage0.ok && moduleSelfhost.ok) {
  let s0;
  let sh;
  try {
    s0 = runMainFromJs(moduleStage0.js, "module-fanout-stage0");
  } catch (error) {
    moduleGaps.push(runtimeExecGap("Stage0 module", error));
  }
  try {
    sh = runMainFromJs(moduleSelfhost.js, "module-fanout-selfhost");
  } catch (error) {
    moduleGaps.push(runtimeExecGap("Selfhost module", error));
  }
  if (s0 !== sh) {
    moduleGaps.push(`Runtime divergence: stage0=${s0}, selfhost=${sh}`);
  }
} else if (moduleStage0.ok && !moduleSelfhost.ok) {
  moduleGaps.push(
    `Selfhost failed while stage0 succeeded (${moduleSelfhost.error?.code ?? moduleSelfhost.crash?.code ?? "unknown"})`,
  );
} else if (!moduleStage0.ok && moduleSelfhost.ok) {
  moduleGaps.push(
    `Selfhost accepted module graph that stage0 rejected (${moduleStage0.error?.code ?? moduleStage0.crash?.code ?? "unknown"})`,
  );
}
if (
  moduleSelfhost.ok &&
  moduleStage0.ok &&
  moduleSelfhost.ms > moduleStage0.ms * 4 &&
  moduleSelfhost.ms > 200
) {
  moduleGaps.push(
    `Performance cliff: selfhost ${moduleSelfhost.ms.toFixed(1)}ms vs stage0 ${moduleStage0.ms.toFixed(1)}ms`,
  );
}
if (!moduleSelfhost.ok) {
  const selfhostCode = moduleSelfhost.error?.code ?? moduleSelfhost.crash?.code;
  const stage0Code = moduleStage0.error?.code ?? moduleStage0.crash?.code;
  if (selfhostCode === "E_UNKNOWN" || selfhostCode === "E_GENERIC") {
    moduleGaps.push(
      "Crash quality gap: selfhost module compile threw non-specific/internal error code",
    );
  }
  if (
    stage0Code &&
    selfhostCode &&
    stage0Code !== selfhostCode &&
    (selfhostCode === "E_GENERIC" ||
      selfhostCode === "E_SELFHOST_INTERNAL_ERROR")
  ) {
    moduleGaps.push(diagnosticSpecificityGap(stage0Code, selfhostCode));
  }
}

results.push({
  name: "module-fanout-400",
  stage0: moduleStage0,
  selfhost: moduleSelfhost,
  gaps: moduleGaps,
});

let gapCount = 0;
console.log("\n=== Selfhost stress report ===");
for (const r of results) {
  const s0Status = r.stage0.ok
    ? `ok (${r.stage0.ms.toFixed(1)}ms)`
    : `fail (${r.stage0.ms.toFixed(1)}ms, ${r.stage0.error?.code ?? r.stage0.crash?.code ?? "unknown"})`;
  const shStatus = r.selfhost.ok
    ? `ok (${r.selfhost.ms.toFixed(1)}ms)`
    : `fail (${r.selfhost.ms.toFixed(1)}ms, ${r.selfhost.error?.code ?? r.selfhost.crash?.code ?? "unknown"})`;
  console.log(`- ${r.name}`);
  console.log(`  stage0  : ${s0Status}`);
  console.log(`  selfhost: ${shStatus}`);
  if (r.gaps.length > 0) {
    gapCount += r.gaps.length;
    for (const gap of r.gaps) {
      console.log(`  GAP     : ${gap}`);
    }
  }
}

if (gapCount === 0) {
  console.log("\nNo stress gaps detected in this run.");
} else {
  console.log(`\nDetected ${gapCount} stress gap(s).`);
  process.exitCode = 1;
}
