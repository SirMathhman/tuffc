// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compileSourceResult } from "../../main/js/compiler.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const outDir = path.join(root, "tests", "out", "c");

fs.mkdirSync(outDir, { recursive: true });

const monoProbeSource = `
fn id<T>(x: T): T => x;
fn pair<A, B>(a: A, b: B): A => a;
fn main(): I32 {
  let x: I32 = id<I32>(41);
  let y: I32 = id(1);
  let z: I32 = pair<I32, Bool>(x, true);
  x + y + z
}
`;

const monoProbe = compileSourceResult(monoProbeSource, "<c-monomorph-probe>", {
  backend: "stage0",
  target: "c",
});

if (!monoProbe.ok) {
  console.error("Monomorphization probe compile failed:");
  console.error(monoProbe.error.message);
  process.exit(1);
}

const monoPlan = monoProbe.value?.monomorphizationPlan;
const monoSpecializations = monoPlan?.specializations ?? [];
const hasIdI32 = monoSpecializations.some(
  (s) => s?.functionName === "id" && (s?.typeArgs ?? []).join(",") === "I32",
);
const hasPairI32Bool = monoSpecializations.some(
  (s) =>
    s?.functionName === "pair" && (s?.typeArgs ?? []).join(",") === "I32,Bool",
);

if (!hasIdI32 || !hasPairI32Bool) {
  console.error("Expected monomorphization specializations were not collected");
  console.error(JSON.stringify(monoPlan, null, 2));
  process.exit(1);
}

function runCase(caseName) {
  const sourcePath = path.join(
    root,
    "src",
    "test",
    "tuff",
    "cases",
    `${caseName}.tuff`,
  );
  const expectedPath = path.join(
    root,
    "src",
    "test",
    "tuff",
    "cases",
    `${caseName}.result.json`,
  );
  const outSource = path.join(outDir, `${caseName}.c`);
  const outExe = path.join(
    outDir,
    process.platform === "win32" ? `${caseName}.exe` : caseName,
  );

  const source = fs.readFileSync(sourcePath, "utf8");
  const result = compileSourceResult(source, sourcePath, {
    backend: "stage0",
    target: "c",
  });

  if (!result.ok) {
    console.error(`C backend compile failed for ${caseName}:`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (typeof result.value.c !== "string") {
    console.error(`Expected C output in result.value.c for ${caseName}`);
    process.exit(1);
  }

  if (!result.value.c.includes("int main(void)")) {
    console.error(`Generated C for ${caseName} is missing process entrypoint`);
    process.exit(1);
  }

  if (!result.value.c.includes("tuff_main")) {
    console.error(`Generated C for ${caseName} is missing tuff_main symbol`);
    process.exit(1);
  }

  fs.writeFileSync(outSource, result.value.c, "utf8");

  const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
  return { caseName, expected, outSource, outExe };
}

const compilerCandidates =
  process.platform === "win32"
    ? ["gcc", "clang", "cc"]
    : ["clang", "cc", "gcc"];
const selected = compilerCandidates.find((candidate) => {
  const check = spawnSync(candidate, ["--version"], { encoding: "utf8" });
  return check.status === 0;
});

if (!selected) {
  console.warn(
    "No C compiler found (clang/gcc/cc). Skipping native compile/run verification.",
  );
  console.log(`Generated C outputs at ${outDir}`);
  process.exit(0);
}

const cases = [
  runCase("factorial"),
  runCase("enum_match"),
  runCase("option_match"),
  runCase("runtime_strings"),
  runCase("runtime_collections"),
  runCase("runtime_io"),
];

for (const testCase of cases) {
  const compile = spawnSync(
    selected,
    [testCase.outSource, "-O0", "-o", testCase.outExe],
    {
      encoding: "utf8",
    },
  );
  if (compile.status !== 0) {
    console.error(
      `Failed to compile generated C for ${testCase.caseName} with ${selected}`,
    );
    console.error(compile.stdout ?? "");
    console.error(compile.stderr ?? "");
    process.exit(1);
  }

  const run = spawnSync(testCase.outExe, [], { encoding: "utf8" });
  if (run.status !== testCase.expected) {
    console.error(
      `Expected executable exit code ${testCase.expected} for ${testCase.caseName}, got ${run.status}`,
    );
    console.error(run.stdout ?? "");
    console.error(run.stderr ?? "");
    process.exit(1);
  }
}

console.log(
  `C backend smoke passed with ${selected} for ${cases.length} case(s)`,
);
