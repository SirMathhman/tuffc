import { spawn } from "node:child_process";

const command = [
  "pmd",
  "cpd",
  "index.js",
  "index.test.js",
  "--language",
  "ecmascript",
  "--minimum-tokens",
  "35",
  "--ignore-literals",
  "--ignore-identifiers",
].join(" ");

const child = spawn(command, {
  shell: true,
  windowsHide: true,
});

const stdoutChunks = [];
const stderrChunks = [];

child.stdout.on("data", (chunk) => {
  stdoutChunks.push(chunk);
});

child.stderr.on("data", (chunk) => {
  stderrChunks.push(chunk);
});

child.on("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});

child.on("close", (code) => {
  const stdout = Buffer.concat(stdoutChunks);
  const stderr = Buffer.concat(stderrChunks);

  if (code === 0) {
    if (stdout.length > 0) {
      process.stdout.write(stdout);
    }

    if (stderr.length > 0) {
      process.stderr.write(stderr);
    }

    process.exit(0);
  }

  if (stdout.length > 0) {
    process.stderr.write(stdout);
  }

  if (stderr.length > 0) {
    process.stderr.write(stderr);
  }

  process.exit(code ?? 1);
});
