// @ts-nocheck
import { compileSourceResult } from "../../main/js/compiler.ts";
import fs from "node:fs";
import path from "node:path";
import { getRepoRootFromImportMeta } from "./path-test-utils.ts";

const root = getRepoRootFromImportMeta(import.meta.url);
const src = fs.readFileSync(
  path.join(root, "src", "main", "tuff", "vec-scratch.tuff"),
  "utf8",
);

const r = compileSourceResult(src, "vec-scratch.tuff", {
  backend: "selfhost",
  target: "c",
});
if (!r.ok) {
  console.error("ERROR:", r.error.message);
  if (r.error.meta) console.error("META:", JSON.stringify(r.error.meta));
  process.exit(1);
}
const selfhost = process.argv.includes("--selfhost");
console.log(
  `OK${selfhost ? " (selfhost)" : ""}, C length:`,
  r.value.c?.length ?? "no C output",
);
