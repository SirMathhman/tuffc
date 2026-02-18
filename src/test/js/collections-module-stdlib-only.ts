// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileSourceResult } from "../../main/js/compiler.ts";

function formatCompileError(error: any): string {
  const code = error?.code ?? "E_UNKNOWN";
  const message = error?.message ?? String(error);
  const loc = error?.loc
    ? `${error.loc.file ?? "<memory>"}:${error.loc.line ?? "?"}:${error.loc.column ?? "?"}`
    : "<no-loc>";
  const reason = error?.reason ? `\nreason: ${error.reason}` : "";
  const fix = error?.fix ? `\nfix: ${error.fix}` : "";
  return `[${code}] ${message}\nloc: ${loc}${reason}${fix}`;
}

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
const collectionsPath = path.join(
  root,
  "src",
  "main",
  "tuff-c",
  "Collections.tuff",
);
const stdlibPath = path.join(root, "src", "main", "tuff-c", "stdlib.tuff");

const source = fs.readFileSync(collectionsPath, "utf8");
const stdlibSource = fs.readFileSync(stdlibPath, "utf8");

if (source.includes("= collections;")) {
  console.error(
    "Collections.tuff should not bind extern functions from non-stdlib collections runtime bucket",
  );
  process.exit(1);
}

if (stdlibSource.includes("= collections;")) {
  console.error(
    "stdlib.tuff should not bind extern functions from non-stdlib collections runtime bucket",
  );
  process.exit(1);
}

const forbiddenBuckets = [
  "= io;",
  "= panic;",
  "= string_builder;",
  "= collections;",
];
for (const bucket of forbiddenBuckets) {
  if (source.includes(bucket) || stdlibSource.includes(bucket)) {
    console.error(
      `Found forbidden extern source bucket in tuff-c collections layer: ${bucket}`,
    );
    process.exit(1);
  }
}

const result = compileSourceResult(source, "<collections-module-stdlib-only>", {
  backend: "selfhost",
  target: "js",
  lint: { enabled: false },
  borrowcheck: { enabled: false },
  typecheck: { strictSafety: false },
});

if (!result.ok) {
  console.error(
    `Expected Collections.tuff to compile via selfhost backend, got:\n${formatCompileError(result.error)}`,
  );
  process.exit(1);
}

if (!result.value.output.includes("map_set_i32_i32")) {
  console.error(
    "Expected generated output to include map_set_i32_i32 implementation from Collections.tuff",
  );
  process.exit(1);
}

console.log("Collections.tuff stdlib-only extern binding checks passed");
