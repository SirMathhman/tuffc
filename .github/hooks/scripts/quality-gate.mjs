import { spawnSync } from "node:child_process";

function runStep(name, command) {
  const result = spawnSync(command, {
    stdio: "inherit",
    shell: true,
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

runStep("unit tests", "npm run test");
runStep("duplicate check", "npm run cpd");

console.log("[hook] Quality gate passed (tests + CPD).");
