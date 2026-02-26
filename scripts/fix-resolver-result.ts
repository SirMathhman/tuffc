// Complete resolver.tuff Result migration fixer
// Handles all remaining transformations

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const resolverPath = path.join(root, "src/main/tuff/selfhost/resolver.tuff");

function fixResolverResult() {
  let source = fs.readFileSync(resolverPath, "utf8");

  console.log("Step 1: Wrapping bare return 0; and return 1; statements...");
  source = source.replace(
    /(\s+)return 0;$/gm,
    "$1return Ok<I32> { value: 0 };",
  );
  source = source.replace(
    /(\s+)return 1;$/gm,
    "$1return Ok<I32> { value: 1 };",
  );

  console.log("Step 2: Wrapping bare 0 and 1 at end of functions...");
  // Match patterns like: "    0\n}" or "    1\n}"
  source = source.replace(/(\n\s+)(0|1)(\n\})/g, "$1Ok<I32> { value: $2 }$3");

  console.log("Step 3: Adding ? to Result-returning function calls...");
  // List of all functions that return Result
  const resultFunctions = [
    "resolve_expr",
    "resolve_expr_identifier",
    "resolve_expr_call",
    "resolve_expr_member",
    "resolve_expr_index",
    "resolve_expr_struct_init",
    "resolve_expr_lambda",
    "resolve_expr_fn_expr",
    "resolve_type",
    "resolve_stmt",
    "resolve_stmt_let",
    "resolve_stmt_into",
    "resolve_stmt_block",
    "resolve_stmt_fn_decl",
    "resolve_stmt_let_or_import",
    "resolve_stmt_flow",
    "resolve_stmt_lifetime_or_into",
    "resolve_names",
  ];

  for (const fnName of resultFunctions) {
    // Match: fnName(...); but not fnName(...)?;
    const regex = new RegExp(`(${fnName}\\([^;]*\\));(?!\\?)`, "g");
    source = source.replace(regex, "$1?;");
  }

  console.log("Step 4: Fixing multiline function calls...");
  // Handle calls that span multiple lines
  for (const fnName of resultFunctions) {
    // Look for patterns like: fnName(\n ... \n );
    const multilineRegex = new RegExp(
      `(${fnName}\\([^)]*\\n[^)]*\\));(?!\\?)`,
      "g",
    );
    source = source.replace(multilineRegex, "$1?;");
  }

  return source;
}

function main() {
  console.log("=== Resolver Result Migration Complete Fixer ===\n");

  try {
    const fixed = fixResolverResult();

    // Backup
    const backupPath = resolverPath + ".backup2";
    fs.copyFileSync(resolverPath, backupPath);
    console.log(`✓ Backed up to: ${backupPath}\n`);

    // Write fixed version
    fs.writeFileSync(resolverPath, fixed, "utf8");
    console.log(`✓ Fixed all remaining issues in resolver.tuff\n`);

    console.log("Next: Test compilation with npm run test");
  } catch (error) {
    console.error("✖ Fix failed:", error);
    process.exit(1);
  }
}

main();
