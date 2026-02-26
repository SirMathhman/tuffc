/**
 * Comprehensive typecheck_impl.tuff Result migration
 * Handles all tc_panic_loc conversions and Result propagation
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE = path.join(
  __dirname,
  "../src/main/tuff/selfhost/internal/typecheck_impl.tuff",
);
const BACKUP = FILE + ".backup5";

function main() {
  let src = fs.readFileSync(FILE, "utf-8");
  fs.writeFileSync(BACKUP, src, "utf-8");
  console.log(`✓ Backed up to ${path.basename(BACKUP)}`);

  // Step 1: Add "return" before all tc_panic_loc calls
  src = src.replace(/^(\s+)(tc_panic_loc\s*\()/gm, "$1return $2");
  console.log("✓ Converted tc_panic_loc calls to return statements");

  // Step 2: Add ? to typecheck_expr/typecheck_stmt recursive calls
  src = src.replace(
    /^(\s+)(typecheck_expr|typecheck_stmt)\s*\(([^;]+?)\)\s*;$/gm,
    "$1$2($3)?;",
  );
  console.log("✓ Added ? operators to typecheck calls");

  // Step 3: Wrap bare "return 0" with Ok
  src = src.replace(
    /^(\s+)return\s+0\s*;$/gm,
    "$1return Ok<I32> { value: 0 };",
  );
  console.log("✓ Wrapped return 0 with Ok");

  // Step 4: Wrap final bare return values at end of blocks
  // This catches "return n;" where n is a variable
  src = src.replace(
    /^(\s+)return\s+([a-z_][a-z0-9_]*)\s*;$/gm,
    (match, indent, ident) => {
      // Don't wrap if it's already wrapped or if it's calling a Result function
      if (
        ident.includes("Ok") ||
        ident.includes("Err") ||
        ident.includes("tc_panic")
      ) {
        return match;
      }
      return `${indent}return Ok<I32> { value: ${ident} };`;
    },
  );
  console.log("✓ Wrapped return <var> with Ok");

  // Step 5: Remove ? from "return tc_panic_loc(...)?;" since it already returns Result
  src = src.replace(
    /return\s+tc_panic_loc\s*\(([^)]+)\)\s*\?\s*;/gs,
    "return tc_panic_loc($1);",
  );
  console.log("✓ Fixed double ? on tc_panic_loc returns");

  // Step 6: Update remaining helper function signatures
  const helpers = [
    "typecheck_if_expr_branch",
    "check_match_exhaustiveness",
    "verify_destructor_signature",
  ];
  for (const fn of helpers) {
    const regex = new RegExp(
      `(fn\\s+${fn}\\s*\\([^)]+\\))\\s*:\\s*I32\\s*=>`,
      "g",
    );
    src = src.replace(regex, "$1 : Result<I32, TypeError> =>");
  }
  console.log("✓ Updated helper function signatures");

  fs.writeFileSync(FILE, src, "utf-8");
  console.log("\n✅ Migration complete!");
  console.log("   Review typecheck_impl.tuff - may need manual fixes for:");
  console.log("   - Functions that return expressions without explicit return");
  console.log("   - Complex control flow patterns");
}

main();
