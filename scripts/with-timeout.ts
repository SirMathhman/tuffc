/**
 * with-timeout.ts <timeoutMs> <cmd> [...args]
 *
 * Runs <cmd> with the given arguments, killing it and exiting with code 124
 * if it doesn't complete within <timeoutMs> milliseconds.
 */
import { spawnSync } from "child_process";

const [, , rawTimeout, ...cmd] = process.argv;

if (!rawTimeout || cmd.length === 0) {
  process.stderr.write(
    "usage: tsx scripts/with-timeout.ts <timeoutMs> <cmd> [...args]\n",
  );
  process.exit(1);
}

const timeoutMs = parseInt(rawTimeout, 10);

const result = spawnSync(cmd[0], cmd.slice(1), {
  stdio: "inherit",
  timeout: timeoutMs,
  shell: true,
});

if (result.error) {
  if ((result.error as NodeJS.ErrnoException).code === "ETIMEDOUT") {
    process.stderr.write(`\nERROR: command timed out after ${timeoutMs}ms. If you are seeing this message, this means that the process has likely encountered an infinite loop or has incredibly bad performance. Add logging to diagnose this issue. Do not necessarily asusume more time is needed, one minute should be the maximum of acceptability.\n`);
    process.exit(124);
  }
  process.stderr.write(`ERROR: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 1);
