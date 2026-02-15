// @ts-nocheck
import vm from "node:vm";

export function runMainFromJs(js, label) {
  const sandbox = { module: { exports: {} }, exports: {}, console };
  vm.runInNewContext(`${js}\nmodule.exports = { main };`, sandbox);
  if (typeof sandbox.module.exports.main !== "function") {
    throw new Error(`${label}: generated JS does not export main()`);
  }
  return sandbox.module.exports.main();
}
