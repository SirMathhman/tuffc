/**
 * Automated migration script: typecheck_impl.tuff panic → Result<I32, TypeError>
 * Transforms typechecker functions from panic-based to Result-based error handling
 */

import { fs, path, root } from "./script-utils.ts";

const TYPECHECK_FILE = path.join(
  root,
  "src/main/tuff/selfhost/internal/typecheck_impl.tuff",
);
const BACKUP_FILE = TYPECHECK_FILE + ".backup4";

function migrate() {
  let source = fs.readFileSync(TYPECHECK_FILE, "utf-8");

  // Backup original
  fs.writeFileSync(BACKUP_FILE, source, "utf-8");
  console.log(`✓ Backed up to ${path.basename(BACKUP_FILE)}`);

  // Step 1: Convert all tc_panic_loc calls to return statements (multiline support)
  // Match tc_panic_loc( ... ); across multiple lines
  source = source.replace(
    /(\s+)tc_panic_loc\(\s*"([^"]+)"[^)]+\);/gs,
    '$1return tc_panic_loc( "$2"',
  );

  // More comprehensive: find all tc_panic_loc calls and add return
  source = source.replace(/^(\s+)(tc_panic_loc\s*\()/gm, "$1return $2");

  // Step 2: Add ? operator to typecheck_expr and typecheck_stmt recursive calls
  // Pattern: typecheck_expr(...); → typecheck_expr(...)?;
  source = source.replace(
    /^(\s+)(typecheck_expr|typecheck_stmt)\(([^;]+)\);$/gm,
    "$1$2($3)?;",
  );

  // Step 3: Wrap bare "return 0" with Ok
  source = source.replace(
    /^(\s+)return 0;$/gm,
    "$1return Ok<I32> { value: 0 };",
  );

  // Also handle return statements with variables
  source = source.replace(
    /^(\s+)return ([a-z_][a-z0-9_]*);$/gm,
    "$1return Ok<I32> { value: $2 };",
  );

  // Step 4: Update helper function signatures that call tc_panic_loc
  const helperFns = [
    "typecheck_if_expr_branch",
    "check_match_exhaustiveness",
    "verify_destructor_signature",
  ];

  for (const fn of helperFns) {
    const regex = new RegExp(`(fn ${fn}\\([^)]+\\)) : I32 =>`, "g");
    source = source.replace(regex, "$1  : Result<I32, TypeError> =>");
  }

  // Step 5: Fix "return tc_panic_loc(...)?;" - remove the ? since it already returns Result
  source = source.replace(
    /return tc_panic_loc\(([^;]+)\)\?;/gs,
    "return tc_panic_loc($1);",
  );

  // Step 6: Handle final returns at end of functions (those without explicit return)
  // This is tricky, so we'll skip for now and fix manually

  fs.writeFileSync(TYPECHECK_FILE, source, "utf-8");
  console.log("✓ Applied typecheck migration transformations");
  console.log("  - Converted tc_panic_loc calls to return statements");
  console.log("  - Added ? operators to typecheck recursive calls");
  console.log("  - Wrapped return 0 with Ok<I32>");
  console.log("  - Updated helper function signatures");
}

try {
  migrate();
  console.log(
    "\n✅ Migration complete! Review typecheck_impl.tuff for any manual fixes needed.",
  );
} catch (error) {
  console.error("❌ Migration failed:", error);
  process.exit(1);
}
