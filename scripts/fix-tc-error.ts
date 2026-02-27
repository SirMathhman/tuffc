#!/usr/bin/env tsx
import { fs, loadAndSetupFixTarget, addReturnToTcErrorCalls, addQuestionMarkToTypecheckCalls } from "./fix-utils.ts";

const { filePath, lines, isInResultFunction } = loadAndSetupFixTarget(".backup7");

// Step 1: Change tc_panic_loc to tc_error in Result functions
let count = 0;
for (let i = 0; i < lines.length; i++) {
  if (!isInResultFunction(i)) continue;

  if (lines[i].includes("tc_panic_loc(")) {
    lines[i] = lines[i].replace(/tc_panic_loc\(/g, "tc_error(");
    count++;
  }
}
if (count > 0) {
  console.log(
    `✓ Changed tc_panic_loc to tc_error in Result functions (${count} lines)`,
  );
}

// Step 2: Add return to tc_error calls in Result functions
count = addReturnToTcErrorCalls(lines, isInResultFunction);
if (count > 0) {
  console.log(`✓ Added return to tc_error calls (${count} lines)`);
}

// Step 3: Add ? to typecheck_expr/stmt/if_expr_branch calls in Result functions
count = addQuestionMarkToTypecheckCalls(lines, isInResultFunction);
if (count > 0) {
  console.log(`✓ Added ? operators to typecheck calls (${count} lines)`);
}

// Step 4: Wrap return 0/1 and final numeric returns with Ok in Result functions only
count = 0;
for (let i = 0; i < lines.length; i++) {
  if (!isInResultFunction(i)) continue;

  const line = lines[i];
  // Match `return 0;` or `return 1;`
  if (line.match(/^\s+return [01];$/)) {
    const num = line.match(/return ([01]);/)![1];
    lines[i] = line.replace(
      `return ${num};`,
      `return Ok<I32> { value: ${num} };`,
    );
    count++;
  }
  // Match bare `0` or `1` as final line of function (just before closing brace)
  else if (
    line.match(/^\s+[01]\s*$/) &&
    i + 1 < lines.length &&
    lines[i + 1].match(/^}/)
  ) {
    const num = line.trim();
    const indent = line.match(/^(\s*)/)?.[1] || "";
    lines[i] = `${indent}Ok<I32> { value: ${num} }`;
    count++;
  }
}
if (count > 0) {
  console.log(
    `✓ Wrapped return 0/1 with Ok in Result functions (${count} lines)`,
  );
}

// Write back
const content = lines.join("\n");
fs.writeFileSync(filePath, content, "utf-8");

console.log("✅ Targeted migration complete!");
