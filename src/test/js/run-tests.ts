// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { compileSourceThrow } from "../../main/js/compiler.ts";
import { runMainFromJs } from "./js-runtime-test-utils.ts";
import { getRepoRootFromImportMeta, getBackendArg } from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const casesDir = path.join(root, "src", "test", "tuff", "cases");
const outDir = path.join(root, "tests", "out");
const updateSnapshots = process.argv.includes("--update");
const backend = getBackendArg();

fs.mkdirSync(outDir, { recursive: true });

const testCases = fs.readdirSync(casesDir).filter((x) => x.endsWith(".tuff"));
const selfhostKnownUnsupportedCases = new Set([
  // Pipe-lambda syntax is not yet supported consistently in selfhost parser.
  "iter_semantics.tuff",
  // Result type requires module imports (stdlib not yet available without modules).
  "result-error-propagation.tuff",
]);

let passed = 0;
let skipped = 0;
for (const name of testCases) {
  if (backend === "selfhost" && selfhostKnownUnsupportedCases.has(name)) {
    skipped += 1;
    console.log(`Skipped ${name} (known selfhost parser gap)`);
    continue;
  }

  const filePath = path.join(casesDir, name);
  const source = fs.readFileSync(filePath, "utf8");
  const result = compileSourceThrow(source, filePath, {
    backend,
  });

  const jsBaseName = name.replace(/\.tuff$/, "");
  const jsFileName =
    backend === "selfhost" ? `${jsBaseName}.js` : `${jsBaseName}.${backend}.js`;
  const jsPath = path.join(outDir, jsFileName);
  fs.writeFileSync(jsPath, result.js, "utf8");

  const snapshotPath = `${jsPath}.snap`;
  if (!fs.existsSync(snapshotPath)) {
    fs.writeFileSync(snapshotPath, result.js, "utf8");
  } else {
    const expected = fs.readFileSync(snapshotPath, "utf8");
    if (expected !== result.js) {
      if (updateSnapshots) {
        fs.writeFileSync(snapshotPath, result.js, "utf8");
      } else {
        console.error(`Snapshot mismatch for ${name}`);
        process.exit(1);
      }
    }
  }

  const expectedResultFile = path.join(
    casesDir,
    name.replace(/\.tuff$/, ".result.json"),
  );
  if (fs.existsSync(expectedResultFile)) {
    const output = runMainFromJs(result.js, `run-tests:${name}`);
    const expectedResult = JSON.parse(
      fs.readFileSync(expectedResultFile, "utf8"),
    );
    if (JSON.stringify(output) !== JSON.stringify(expectedResult)) {
      console.error(
        `Runtime expectation failed for ${name}: expected ${JSON.stringify(expectedResult)} got ${JSON.stringify(output)}`,
      );
      process.exit(1);
    }
  }

  passed += 1;
}

console.log(
  `Passed ${passed}/${testCases.length} tests (backend=${backend}, skipped=${skipped})`,
);
