// @ts-nocheck
import { compileSourceResult } from "../../main/js/compiler.ts";
import { compileToCEmpty } from "./compile-test-utils.ts";

const program = `
extern let { printf } = stdio;
extern fn printf(fmt: *Str, value: I32) : I32;

fn double(n: I32) : I32 => n * 2;
fn main() : I32 => {
  printf("value=%d\\n", double(4));
  7
}
`;

const output = compileToCEmpty(
  compileSourceResult,
  program,
  "selfhost C compile with empty substrate override",
);
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

if (
  !output.includes("tuff_runtime_panic") &&
  !output.includes("tuffRuntimePanic")
) {
  console.error(
    "Expected generated C to include runtime prelude symbol from RuntimePrelude.tuff",
  );
  process.exit(1);
}

console.log("Selfhost empty-substrate C generation checks passed");
