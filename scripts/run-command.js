export function runCommand(command, args, label = command) {
  const result = Bun.spawnSync({
    cmd: [command, ...args],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  if (result.exitCode !== 0) {
    return result.exitCode ?? 1;
  }

  return 0;
}
