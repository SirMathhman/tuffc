// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { compileFileResult } from "../../main/js/compiler.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const entry = path.join(root, "src", "main", "tuff", "selfhost.tuff");
const outDir = path.join(root, "tests", "out", "c");
const outC = path.join(outDir, "selfhost.c");
const outObj = path.join(outDir, "selfhost.o");
const runtimeDir = path.join(root, "src", "main", "c");

fs.mkdirSync(outDir, { recursive: true });

const compile = compileFileResult(entry, outC, {
  backend: "stage0",
  target: "c",
  enableModules: true,
  modules: { moduleBaseDir: path.dirname(entry) },
  lint: { enabled: false },
  typecheck: { strictSafety: false },
});

if (!compile.ok) {
  console.error("Failed to compile selfhost.tuff to C:");
  console.error(compile.error.message);
  process.exit(1);
}

if (!fs.existsSync(outC)) {
  console.error("Expected generated selfhost.c output file");
  process.exit(1);
}

const candidates =
  process.platform === "win32"
    ? ["clang", "gcc", "cc"]
    : ["cc", "clang", "gcc"];
let selected = undefined;
for (const candidate of candidates) {
  const check = spawnSync(candidate, ["--version"], { encoding: "utf8" });
  if (check.status === 0) {
    selected = candidate;
    break;
  }
}

if (!selected) {
  console.warn(
    "No C compiler found (clang/gcc/cc). Skipping object compile check.",
  );
  console.log(`Generated ${outC}`);
  process.exit(0);
}

const objectCompile = spawnSync(
  selected,
  ["-c", outC, "-I", runtimeDir, "-O0", "-o", outObj],
  { encoding: "utf8" },
);

if (objectCompile.status !== 0) {
  console.error(
    `Failed to compile generated selfhost.c to object with ${selected}`,
  );
  console.error(objectCompile.stdout ?? "");
  console.error(objectCompile.stderr ?? "");
  process.exit(1);
}

console.log(
  `Selfhost C progress check passed with ${selected} (object compile)`,
);
