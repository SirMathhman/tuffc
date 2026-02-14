import vm from "node:vm";
import {
  compileTuffToJs,
  compileTuffToJsDiagnostics,
} from "../../main/js/web-compiler.ts";

const source = [
  "fn add(a : I32, b : I32) : I32 => a + b;",
  "fn main() : I32 => add(40, 2);",
  "",
].join("\n");

const js = compileTuffToJs(source, {
  typecheck: { strictSafety: false },
  lint: { enabled: true, mode: "warn" },
});

const sandbox = { module: { exports: {} }, exports: {}, console };
vm.runInNewContext(`${js}\nmodule.exports = { main };`, sandbox);

if (typeof sandbox.module.exports.main !== "function") {
  console.error("Expected compiled browser API output to define main()");
  process.exit(1);
}

const value = sandbox.module.exports.main();
if (value !== 42) {
  console.error(`Expected compiled output to return 42, got ${value}`);
  process.exit(1);
}

const bad = compileTuffToJsDiagnostics("fn main() : I32 => missing_symbol;", {
  typecheck: { strictSafety: false },
});

if (bad.ok) {
  console.error("Expected diagnostic mode to report unknown identifier error");
  process.exit(1);
}

if (bad.error.code !== "E_RESOLVE_UNKNOWN_IDENTIFIER") {
  console.error(`Expected E_RESOLVE_UNKNOWN_IDENTIFIER, got ${bad.error.code}`);
  process.exit(1);
}

console.log("Web compiler API checks passed");
