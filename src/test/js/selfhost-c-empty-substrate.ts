// @ts-nocheck
import { compileSourceResult } from "../../main/js/compiler.ts";

const program = `
extern let { printf } = stdio;
extern fn printf(fmt: *Str, value: I32) : I32;

fn main() : I32 => {
  printf("value=%d\\n", 7);
  7
}
`;

const result = compileSourceResult(program, "<selfhost-c-empty-substrate>", {
  backend: "selfhost",
  target: "c",
  cSubstrate: "",
  lint: { enabled: false },
  borrowcheck: { enabled: false },
  typecheck: { strictSafety: false },
});

if (!result.ok) {
  console.error(
    `Expected selfhost C compile success with empty substrate override, got: ${result.error.message}`,
  );
  process.exit(1);
}

const output = result.value.output;
if (!output.includes("Built-in minimal runtime prelude")) {
  console.error(
    "Expected generated C to include minimal runtime prelude marker when substrate override is empty",
  );
  process.exit(1);
}

if (!output.includes("typedef struct TuffVec")) {
  console.error(
    "Expected generated C to declare TuffVec in minimal runtime prelude",
  );
  process.exit(1);
}

if (!output.includes("tuff_runtime_panic")) {
  console.error(
    "Expected generated C to include runtime prelude symbol from RuntimePrelude.tuff",
  );
  process.exit(1);
}

console.log("Selfhost empty-substrate C generation checks passed");
