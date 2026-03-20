import { runCommand } from "./run-command.js";

const cpdArgs = [
  "cpd",
  "--dir",
  "src",
  "--language",
  "typescript",
  "--minimum-tokens",
  "35",
];

export function runTests() {
  return runCommand("bun", ["test"], "Bun test");
}

export function runCpd() {
  return runCommand("pmd", cpdArgs, "PMD CPD");
}

export function runProjectChecks() {
  const testExitCode = runTests();

  if (testExitCode !== 0) {
    return testExitCode;
  }

  return runCpd();
}
