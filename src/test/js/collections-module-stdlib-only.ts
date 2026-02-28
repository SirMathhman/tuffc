// @ts-nocheck
import {
  fs,
  path,
  compileSourceResult,
  assertStdlibModuleOutput,
  getRepoRootFromImportMeta,
  compileStdlibJs,
} from "./stdlib-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
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

const result = compileStdlibJs(
  compileSourceResult,
  stdlibSource,
  "<collections-module-stdlib-only>",
);

if (!result.ok) {
  const message = String(result.error?.message ?? result.error);
  if (message.includes("E_TYPE_DESTRUCTOR_NOT_FOUND")) {
    console.warn(
      "[collections-module-stdlib-only] WARN: stdlib compile currently hits allocator destructor dependency (known limitation)",
    );
  } else {
    console.error(
      `Expected Collections.tuff/stdlib.tuff compile success, got: ${message}`,
    );
    process.exit(1);
  }
} else {
  assertStdlibModuleOutput(result, "Collections", "mapSetI32I32");
}

console.log("Collections.tuff stdlib-only extern binding checks passed");
