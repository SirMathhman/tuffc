// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __thisFile = fileURLToPath(import.meta.url);
// Resolve sibling tuff-c package relative to this compiler file's location.
// Layout: src/main/js/c-runtime-support.ts -> src/main/tuff-c/
const __tuffCDir = path.resolve(path.dirname(__thisFile), "..", "tuff-c");

function readTuffC(name) {
  return fs.readFileSync(path.join(__tuffCDir, name), "utf8");
}

// Load the C substrate files in dependency order.
// Each file's comments describe its dependencies.
function assembleCSubstrate() {
  return [
    readTuffC("substrate.c"),
    readTuffC("strings.c"),
    readTuffC("string-builder.c"),
    readTuffC("collections.c"),
    readTuffC("io.c"),
    readTuffC("panic.c"),
  ].join("\n");
}

let _cached;

export function getEmbeddedCRuntimeSupport() {
  if (_cached === undefined) {
    _cached = assembleCSubstrate();
  }
  return _cached;
}

// Preferred name: this payload is the low-level C substrate used by generated code.
// High-level runtime APIs should be surfaced through stdlib expect/actual modules.
export function getEmbeddedCSubstrateSupport() {
  return getEmbeddedCRuntimeSupport();
}
