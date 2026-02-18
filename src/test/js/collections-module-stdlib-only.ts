// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

console.log("Collections.tuff stdlib-only extern binding checks passed");
