import { spawnSync } from "node:child_process";

function runStep(name, command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.error(`[hook] ${name} failed to start:`, result.error.message);
    process.exit(2);
  }

  if (typeof result.status === "number" && result.status !== 0) {
    console.error(
      `[hook] ${name} failed with exit code ${result.status}. Blocking.`,
    );
    process.exit(2);
  }
}

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

runStep("unit tests", npmCmd, ["run", "test"]);
runStep("duplicate check", npmCmd, ["run", "cpd"]);

console.log("[hook] Quality gate passed (tests + CPD).");
