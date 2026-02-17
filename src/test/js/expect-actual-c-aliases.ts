// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileFileResult } from "../../main/js/compiler.ts";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const outDir = path.join(root, "tests", "out", "expect-actual-c-aliases");

const appDir = path.join(outDir, "app");
const coreDir = path.join(outDir, "libs", "tuff-core");
const cDir = path.join(outDir, "libs", "tuff-c");

const entry = path.join(appDir, "Main.tuff");
const outC = path.join(outDir, "targeted.c");
const outMissingActual = path.join(outDir, "missing-actual.c");

fs.mkdirSync(appDir, { recursive: true });
fs.mkdirSync(coreDir, { recursive: true });
fs.mkdirSync(cDir, { recursive: true });

fs.writeFileSync(
  entry,
  ["let { value } = tuff_core::Entry;", "fn main() : I32 => value();", ""].join(
    "\n",
  ),
  "utf8",
);

fs.writeFileSync(
  path.join(coreDir, "Entry.tuff"),
  [
    "let { length } = tuff_core::Strings;",
    'out fn value() : I32 => if ("abc".length() == 3USize) 42 else 0;',
    "",
  ].join("\n"),
  "utf8",
);

fs.writeFileSync(
  path.join(cDir, "Entry.tuff"),
  [
    "let { length } = tuff_core::Strings;",
    'out fn value() : I32 => if ("abc".length() == 3USize) 42 else 0;',
    "",
  ].join("\n"),
  "utf8",
);

fs.writeFileSync(
  path.join(coreDir, "Strings.tuff"),
  [
    "out module Strings {",
    "  expect fn length(this : *Str) : USize;",
    "}",
    "",
  ].join("\n"),
  "utf8",
);

fs.writeFileSync(
  path.join(cDir, "Strings.tuff"),
  [
    "out module Strings {",
    "  expect fn length(this : *Str) : USize;",
    "  actual fn length(this : *Str) : USize => 3USize;",
    "}",
    "",
  ].join("\n"),
  "utf8",
);

const targetedC = compileFileResult(entry, outC, {
  backend: "stage0",
  target: "c",
  enableModules: true,
  modules: {
    moduleBaseDir: appDir,
    packageAliases: {
      tuff_core: coreDir,
    },
    packageAliasesByTarget: {
      c: {
        tuff_core: cDir,
      },
    },
  },
});

if (!targetedC.ok) {
  console.error(
    `Expected C-target alias expect/actual compile success, got: ${targetedC.error.message}`,
  );
  process.exit(1);
}

if (
  typeof targetedC.value.c !== "string" ||
  !targetedC.value.c.includes("int main(void)")
) {
  console.error("Expected C output for targeted expect/actual alias compile");
  process.exit(1);
}

if (targetedC.value.c.includes("expect fn")) {
  console.error("C output should not include expect declaration artifacts");
  process.exit(1);
}

const missingActual = compileFileResult(entry, outMissingActual, {
  backend: "stage0",
  target: "c",
  enableModules: true,
  modules: {
    moduleBaseDir: appDir,
    packageAliases: {
      tuff_core: coreDir,
    },
  },
});

if (missingActual.ok) {
  console.error("Expected missing-actual configuration to fail for C target");
  process.exit(1);
}

const missingActualCode =
  missingActual.error?.meta?.code ??
  missingActual.error?.code ??
  (typeof missingActual.error?.message === "string" &&
  missingActual.error.message.includes("E_EXPECT_ACTUAL_PAIRING")
    ? "E_EXPECT_ACTUAL_PAIRING"
    : undefined);

if (missingActualCode !== "E_EXPECT_ACTUAL_PAIRING") {
  console.error(
    `Expected E_EXPECT_ACTUAL_PAIRING, got ${missingActualCode ?? "<none>"}`,
  );
  process.exit(1);
}

console.log("Expect/actual C alias resolution checks passed");
