// @ts-nocheck
import { compileSourceResult } from "../../main/js/compiler.ts";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..", "..", "..");
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
console.log("OK (selfhost), C length:", r.value.c?.length ?? "no C output");
