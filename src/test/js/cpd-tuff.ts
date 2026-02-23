// @ts-nocheck
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  getNodeExecPath,
  getRepoRootFromImportMeta,
  getTsxCliPath,
} from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const tsxCli = getTsxCliPath(root);
const nodeExec = getNodeExecPath();
const script = path.join(root, "scripts", "cpd-tuff.ts");
const fixtureDir = path.join("tests", "cpd-fixtures");

function runCpd(args: string[]) {
  return spawnSync(nodeExec, [tsxCli, script, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function parseJsonFromStdout(stdout: string): unknown {
  const start = stdout.indexOf("{");
  if (start < 0) {
    throw new Error(`Expected JSON object in CPD stdout, got:\n${stdout}`);
  }
  return JSON.parse(stdout.slice(start));
}

const informative = runCpd([
  "--dir",
  fixtureDir,
  "--min-tokens",
  "10",
  "--normalize-identifiers",
  "--json",
]);
if (informative.status !== 0) {
  console.error("cpd:tuff informative mode failed unexpectedly");
  console.error(informative.stderr || informative.stdout);
  process.exit(1);
}

const informativeJson = parseJsonFromStdout(informative.stdout) as {
  findings?: unknown[];
};
if (!Array.isArray(informativeJson.findings)) {
  console.error("cpd:tuff json output missing findings array");
  process.exit(1);
}
if (informativeJson.findings.length === 0) {
  console.error("Expected duplicate findings in CPD fixture set at min-tokens=10");
  process.exit(1);
}

const strict = runCpd([
  "--dir",
  fixtureDir,
  "--min-tokens",
  "10",
  "--normalize-identifiers",
  "--fail-on-duplicates",
  "--max-reports",
  "1",
]);
if (strict.status !== 2) {
  console.error(`Expected strict mode to exit with 2, got ${strict.status}`);
  console.error(strict.stderr || strict.stdout);
  process.exit(1);
}

const highThreshold = runCpd([
  "--dir",
  fixtureDir,
  "--min-tokens",
  "200",
  "--json",
]);
if (highThreshold.status !== 0) {
  console.error("cpd:tuff high-threshold check failed unexpectedly");
  console.error(highThreshold.stderr || highThreshold.stdout);
  process.exit(1);
}

const highThresholdJson = parseJsonFromStdout(highThreshold.stdout) as {
  findings?: unknown[];
};
if (!Array.isArray(highThresholdJson.findings)) {
  console.error("cpd:tuff high-threshold json missing findings array");
  process.exit(1);
}
if (highThresholdJson.findings.length !== 0) {
  console.error(
    `Expected zero CPD findings at min-tokens=200, got ${highThresholdJson.findings.length}`,
  );
  process.exit(1);
}

console.log("CPD tuff fixture checks passed");
