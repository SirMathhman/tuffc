const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const jestPackageJson = require.resolve("jest/package.json");
const jestBin = path.join(path.dirname(jestPackageJson), "bin", "jest.js");
const jestArgs = [
  jestBin,
  "--runInBand",
  "--coverage",
  "--coverageReporters=json-summary",
];

const jestRun = spawnSync(process.execPath, jestArgs, {
  stdio: "inherit",
  env: process.env,
});

if (typeof jestRun.status === "number" && jestRun.status !== 0) {
  process.exit(jestRun.status);
}

const summaryPath = path.join(
  process.cwd(),
  "coverage",
  "coverage-summary.json",
);
if (!fs.existsSync(summaryPath)) {
  console.error("Coverage summary not found.");
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const total = summary.total || {};

const coverageDimensions = ["lines", "statements", "functions", "branches"];
const failingDimensions = coverageDimensions.filter((dimension) => {
  const pct = total[dimension]?.pct;
  return typeof pct === "number" ? pct < 100 : true;
});

if (failingDimensions.length > 0) {
  const report = failingDimensions
    .map((dimension) => `${dimension}=${total[dimension]?.pct ?? "N/A"}%`)
    .join(", ");

  console.error(
    `Coverage below 100%: ${report}. Failing with exit code 2 as requested.`,
  );
  process.exit(2);
}

process.exit(0);
