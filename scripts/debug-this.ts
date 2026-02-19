import { compileSourceResult } from "../src/main/js/compiler.ts";

const src = `fn main() => {\nlet x = 100;\nthis.x\n}`;
const r = compileSourceResult(src, "<test>", {
  backend: "stage0",
  target: "js",
});
if (r.ok) {
  const lines = (r.value.output as string).split("\n");
  lines.slice(-15).forEach((l) => console.log(l));
} else {
  console.error((r.error as any).message);
}
