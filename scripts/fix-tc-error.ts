#!/usr/bin/env tsx
import * as fs from "fs";
import * as path from "path";

const filePath = path.join(
  process.cwd(),
  "src/main/tuff/selfhost/internal/typecheck_impl.tuff",
);
let content = fs.readFileSync(filePath, "utf-8");

// Backup
const backupPath = filePath + ".backup7";
fs.writeFileSync(backupPath, content, "utf-8");
console.log(`✓ Backed up to ${path.basename(backupPath)}`);

const lines = content.split("\n");

// Find Result-returning function ranges (line numbers are 0-indexed)
interface FunctionRange {
  name: string;
  start: number;
  end: number;
}

const resultFunctions: FunctionRange[] = [];

// Find all functions that return Result<I32, TypeError> (may span multiple lines)
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.match(/^fn\s+(\w+)/)) {
    const match = line.match(/^fn\s+(\w+)/);
    const name = match ? match[1] : "unknown";

    // Check this line and next few lines for Result<I32, TypeError>
    let signatureBlock = line;
    for (let k = i + 1; k < Math.min(i + 5, lines.length); k++) {
      signatureBlock += lines[k];
      if (lines[k].includes("=>")) break;
    }

    if (signatureBlock.match(/:\s*Result<I32,\s*TypeError>\s*=>/)) {
      const start = i;

      // Find the end of this function (next fn declaration or EOF)
      let end = lines.length - 1;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^fn\s+\w+/)) {
          end = j - 1;
          break;
        }
      }

      resultFunctions.push({ name, start, end });
    }
  }
}

console.log(`Found ${resultFunctions.length} Result-returning functions:`);
resultFunctions.forEach((f) =>
  console.log(`  - ${f.name} (lines ${f.start + 1}-${f.end + 1})`),
);

// Helper to check if a line is within any Result function
function isInResultFunction(lineNum: number): boolean {
  return resultFunctions.some((f) => lineNum >= f.start && lineNum <= f.end);
}

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
count = 0;
for (let i = 0; i < lines.length; i++) {
  if (!isInResultFunction(i)) continue;

  const line = lines[i];
  if (line.match(/^\s+tc_error\(/) && !line.match(/return\s+tc_error/)) {
    lines[i] = line.replace(/(\s+)tc_error/, "$1return tc_error");
    count++;
  }
}
if (count > 0) {
  console.log(`✓ Added return to tc_error calls (${count} lines)`);
}

// Step 3: Add ? to typecheck_expr/stmt/if_expr_branch calls in Result functions
count = 0;
for (let i = 0; i < lines.length; i++) {
  if (!isInResultFunction(i)) continue;

  const line = lines[i];
  // Match typecheck_expr/stmt/branch calls without ? and NOT in return statements
  if (line.match(/^\s+typecheck_(expr|stmt|if_expr_branch)\([^)]+\);/)) {
    lines[i] = line.replace(/;$/, "?;");
    count++;
  }
}
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
content = lines.join("\n");
fs.writeFileSync(filePath, content, "utf-8");

console.log("✅ Targeted migration complete!");
