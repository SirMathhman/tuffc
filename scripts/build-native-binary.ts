import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..");

const defaultOut = path.join(
  root,
  "dist",
  process.platform === "win32" ? "tuffc.exe" : "tuffc",
);
const outputArg = process.argv.find((arg) => arg.startsWith("--out="));
const outputPath = outputArg ? outputArg.slice("--out=".length) : defaultOut;

const sourcePath = path.join(
  root,
  "tests",
  "out",
  "c-bootstrap",
  process.platform === "win32"
    ? "stage3_selfhost_cli.exe"
    : "stage3_selfhost_cli",
);

if (!fs.existsSync(sourcePath)) {
  throw new Error(
    `[build-native-binary] Native bootstrap executable not found: ${sourcePath}. ` +
      "Run `npm run native:selfhost:parity` first.",
  );
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.copyFileSync(sourcePath, outputPath);
if (process.platform !== "win32") {
  fs.chmodSync(outputPath, 0o755);
}

console.log(`Built native executable: ${outputPath}`);
