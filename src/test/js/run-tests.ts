import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { compileSource } from "../../main/js/compiler.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const casesDir = path.join(root, "src", "test", "tuff", "cases");
const outDir = path.join(root, "tests", "out");
const updateSnapshots = process.argv.includes("--update");

fs.mkdirSync(outDir, { recursive: true });

const testCases = fs.readdirSync(casesDir).filter((x) => x.endsWith(".tuff"));

let passed = 0;
for (const name of testCases) {
  const filePath = path.join(casesDir, name);
  const source = fs.readFileSync(filePath, "utf8");
  const result = compileSource(source, filePath);

  const jsPath = path.join(outDir, name.replace(/\.tuff$/, ".js"));
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

  const sandbox = { module: { exports: {} }, exports: {}, console };
  vm.runInNewContext(`${result.js}\nmodule.exports = { main };`, sandbox);
  if (typeof sandbox.module.exports.main === "function") {
    const output = sandbox.module.exports.main();
    const expectedResultFile = path.join(
      casesDir,
      name.replace(/\.tuff$/, ".result.json"),
    );
    if (fs.existsSync(expectedResultFile)) {
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
  }

  passed += 1;
}

console.log(`Passed ${passed}/${testCases.length} tests`);
