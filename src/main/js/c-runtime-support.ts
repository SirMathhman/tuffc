// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __thisFile = fileURLToPath(import.meta.url);
// Resolve sibling c package relative to this compiler file's location.
// Layout: src/main/js/c-runtime-support.ts -> src/main/c/
const __cDir = path.resolve(path.dirname(__thisFile), "..", "c");

function readC(name) {
  return fs.readFileSync(path.join(__cDir, name), "utf8");
}

// Load the C substrate files in dependency order.
// Headers first (type definitions and forward declarations), then implementations.
function assembleCSubstrate() {
  return [
    // Headers: types and forward declarations
    readC("substrate.h"),
    readC("strings.h"),
    readC("string-builder.h"),
    readC("collections.h"),
    readC("io.h"),
    readC("panic.h"),
    // Implementations
    readC("substrate.c"),
    readC("strings.c"),
    readC("string-builder.c"),
    readC("collections.c"),
    readC("io.c"),
    readC("panic.c"),
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
