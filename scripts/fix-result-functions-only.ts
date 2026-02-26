#!/usr/bin/env tsx
import * as fs from "fs";
import * as path from "path";

const filePath = path.join(
  process.cwd(),
  "src/main/tuff/selfhost/internal/typecheck_impl.tuff",
);
let content = fs.readFileSync(filePath, "utf-8");

// Backup
const backupPath = filePath + ".backup6";
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
modified = false;
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
modified = false;
for (let i = 0; i < lines.length; i++) {
  if (!isInResultFunction(i)) continue;

  const line = lines[i];
  if (line.match(/^\s+tc_error\(/) && !line.match(/return\s+tc_error/)) {
    lines[i] = line.replace(/(\s+)tc_error/, "$1return tc_error");
    modified = true;
  }
}

if (modified) {
  console.log("✓ Added return to tc_error calls");
}

// Step 3: Add ? to typecheck_expr/stmt/if_expr_branch calls in Result functions
let modified = false;
for (let i = 0; i < lines.length; i++) {
  if (!isInResultFunction(i)) continue;

  const line = lines[i];

  // Match typecheck_expr/stmt/branch calls without ? and NOT in return statements
  if (line.match(/^\s+typecheck_(expr|stmt|if_expr_branch)\([^)]+\);/)) {
    lines[i] = line.replace(/;$/, "?;");
    modified = true;
  }
}

if (modified) {
  console.log("✓ Added ? operators to typecheck calls");
}

// Step 4: Wrap return 0 with Ok in Result functions only
modified = false;
for (let i = 0; i < lines.length; i++) {
  if (!isInResultFunction(i)) continue;

  const line = lines[i];
  if (line.match(/^\s+return 0;$/)) {
    lines[i] = line.replace("return 0;", "return Ok<I32> { value: 0 };");
    modified = true;
  }
}

if (modified) {
  console.log("✓ Wrapped return 0 with Ok in Result functions");
}

// Step 2: Wrap return 0 with Ok in Result functions only
content = lines.join("\n");
fs.writeFileSync(filePath, content, "utf-8");

console.log("✅ Targeted migration complete!");
