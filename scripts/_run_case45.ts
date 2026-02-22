// @ts-nocheck
import { compileSourceResult } from "../src/main/js/compiler.ts";
import { runMainFromJs } from "../src/test/js/js-runtime-test-utils.ts";

const backendArg = process.argv.find((a) => a.startsWith("--backend="));
const backend = backendArg ? backendArg.slice("--backend=".length) : "stage0";

const source = [
  "let mut counter = 0;",
  "fn Wrapper(field : I32) => {",
  " then () => {",
  "  counter += field;",
  " }",
  "",
  " this",
  "}",
  "",
  "let wrapper = Wrapper(100);",
  "counter;",
  "",
].join("\n");

let compile = compileSourceResult(source, `<db:45:Destructor:${backend}>`, {
  backend,
  target: "js",
});

if (!compile.ok) {
  console.error(`[case45] compile fail (${backend}): ${compile.error.message}`);
  process.exit(1);
}

let value: unknown;
try {
  value = runMainFromJs(compile.value.output, `db45:${backend}`);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("main is not defined")) {
    const wrappedSource = `fn main() => {\n${source}\n}`;
    compile = compileSourceResult(
      wrappedSource,
      `<db:45:Destructor:${backend}:wrapped>`,
      {
        backend,
        target: "js",
      },
    );
    if (!compile.ok) {
      console.error(
        `[case45] wrapped compile fail (${backend}): ${compile.error.message}`,
      );
      process.exit(1);
    }
    try {
      value = runMainFromJs(compile.value.output, `db45:${backend}:wrapped`);
    } catch (wrappedErr) {
      const wrappedMsg =
        wrappedErr instanceof Error ? wrappedErr.message : String(wrappedErr);
      console.error(`[case45] runtime fail (${backend}): ${wrappedMsg}`);
      process.exit(1);
    }
  } else {
    console.error(`[case45] runtime fail (${backend}): ${msg}`);
    process.exit(1);
  }
}

const normalized = value === true ? 1 : value === false ? 0 : value;
if (normalized !== 100) {
  console.error(`[case45] wrong result (${backend}): expected 100, got ${JSON.stringify(value)}`);
  process.exit(1);
}

console.log(`[case45] pass (${backend}): ${JSON.stringify(value)}`);
