import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { compileSourceResult } from "../src/main/js/compiler.ts";

const source = readFileSync("./src/main/tuff/vec-scratch.tuff", "utf-8");

const resultC = compileSourceResult(source, "vec-scratch.tuff", {
  backend: "stage0",
  target: "c",
});

if (resultC.ok) {
  console.log("✓ Compilation to C succeeded");
  console.log("\nGenerated C code length:", resultC.value.output.length);
  console.log("\nFirst 800 chars of generated C:");
  console.log(resultC.value.output.slice(0, 800));

  // Save C output for clang testing
  mkdirSync("./build", { recursive: true });
  writeFileSync("./build/vec-scratch.c", resultC.value.output);
  console.log("\n→ Saved to ./build/vec-scratch.c");
} else {
  console.log("✗ C compilation failed:");
  console.log(resultC.error.message);
}
