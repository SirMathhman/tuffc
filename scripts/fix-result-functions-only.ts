#!/usr/bin/env tsx
import {
  fs,
  addQuestionMarkToTypecheckCalls,
  addReturnToTcErrorCalls,
  addOkWrapToReturns,
  loadAndSetupFixTarget,
} from "./fix-utils.ts";

const { filePath, lines, isInResultFunction } =
  loadAndSetupFixTarget(".backup6");

// Step 1: Change tc_panic_loc to tc_error in Result functions
let modified = false;
for (let i = 0; i < lines.length; i++) {
  if (!isInResultFunction(i)) continue;

  const line = lines[i];
  if (line.includes("tc_panic_loc(")) {
    lines[i] = line.replace(/tc_panic_loc\(/g, "tc_error(");
    modified = true;
  }
}

if (modified) {
  console.log("✓ Changed tc_panic_loc to tc_error in Result functions");
}

// Step 2: Add return to tc_error calls in Result functions
const returnCount = addReturnToTcErrorCalls(lines, isInResultFunction);
if (returnCount > 0) {
  console.log("✓ Added return to tc_error calls");
}

// Step 3: Add ? to typecheck_expr/stmt/if_expr_branch calls in Result functions
modified = addQuestionMarkToTypecheckCalls(lines, isInResultFunction) > 0;

if (modified) {
  console.log("✓ Added ? operators to typecheck calls");
}

// Step 4: Wrap return 0/1 with Ok in Result functions only
const wrapCount = addOkWrapToReturns(lines, isInResultFunction);
if (wrapCount > 0) {
  console.log("✓ Wrapped return 0/1 with Ok in Result functions");
}

// Step 2: Wrap return 0 with Ok in Result functions only
const content = lines.join("\n");
fs.writeFileSync(filePath, content, "utf-8");

console.log("✅ Targeted migration complete!");
