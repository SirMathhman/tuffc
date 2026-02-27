#!/usr/bin/env tsx
import {
  fs,
  loadAndSetupFixTarget,
  addReturnToTcErrorCalls,
  addQuestionMarkToTypecheckCalls,
  addOkWrapToReturns,
} from "./fix-utils.ts";

function reportStep(desc: string, n: number): void {
  if (n > 0) console.log(`\u2713 ${desc} (${n} lines)`);
}

const { filePath, lines, isInResultFunction } =
  loadAndSetupFixTarget(".backup7");

// Step 1: Change tc_panic_loc to tc_error in Result functions
let count = 0;
for (let i = 0; i < lines.length; i++) {
  if (!isInResultFunction(i)) continue;

  if (lines[i].includes("tc_panic_loc(")) {
    lines[i] = lines[i].replace(/tc_panic_loc\(/g, "tc_error(");
    count++;
  }
}
if (count > 0)
  console.log(
    `✓ Changed tc_panic_loc to tc_error in Result functions (${count} lines)`,
  );

// Step 2: Add return to tc_error calls in Result functions
count = addReturnToTcErrorCalls(lines, isInResultFunction);
if (count > 0) reportStep("Added return to tc_error calls", count);

// Step 3: Add ? to typecheck_expr/stmt/if_expr_branch calls in Result functions
count = addQuestionMarkToTypecheckCalls(lines, isInResultFunction);
if (count > 0) reportStep("Added ? operators to typecheck calls", count);

// Step 4: Wrap return 0/1 and final numeric returns with Ok in Result functions only
count = addOkWrapToReturns(lines, isInResultFunction);
if (count > 0)
  reportStep("Wrapped return 0/1 with Ok in Result functions", count);
const content = lines.join("\n");
fs.writeFileSync(filePath, content, "utf-8");

console.log("✅ Targeted migration complete!");
