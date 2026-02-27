#!/usr/bin/env tsx
/**
 * Migrate parser panic calls to Result-based error handling
 * Phase 3: Parser migration following proven Phase 2 (typechecker) pattern
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { runFileMigration } from "./fix-utils.ts";

const TUFFC_ROOT = path.resolve(__dirname, "..");

// Functions to migrate to Result<I32, ParseError>
const RESULT_FUNCTIONS = ["p_parse_after_modifiers", "p_parse_extern_decl"];

// Panic error messages to convert
const PANIC_CONVERSIONS = [
  {
    match: /panic\("Duplicate 'out' modifier"\)/g,
    replace:
      'return p_result_error(\n        "E_PARSE_DUPLICATE_MODIFIER",\n        "Duplicate \'out\' modifier",\n        "The \'out\' modifier was specified more than once",\n        "Remove duplicate \'out\' modifiers, keeping only one"\n    )',
  },
  {
    match: /panic\("Duplicate 'extern' modifier"\)/g,
    replace:
      'return p_result_error(\n        "E_PARSE_DUPLICATE_MODIFIER",\n        "Duplicate \'extern\' modifier",\n        "The \'extern\' modifier was specified more than once",\n        "Remove duplicate \'extern\' modifiers, keeping only one"\n    )',
  },
  {
    match: /panic\("Duplicate 'copy' modifier"\)/g,
    replace:
      'return p_result_error(\n        "E_PARSE_DUPLICATE_MODIFIER",\n        "Duplicate \'copy\' modifier",\n        "The \'copy\' modifier was specified more than once",\n        "Remove duplicate \'copy\' modifiers, keeping only one"\n    )',
  },
  {
    match: /panic\("Duplicate 'expect' modifier"\)/g,
    replace:
      'return p_result_error(\n        "E_PARSE_DUPLICATE_MODIFIER",\n        "Duplicate \'expect\' modifier",\n        "The \'expect\' modifier was specified more than once",\n        "Remove duplicate \'expect\' modifiers, keeping only one"\n    )',
  },
  {
    match: /panic\("Duplicate 'actual' modifier"\)/g,
    replace:
      'return p_result_error(\n        "E_PARSE_DUPLICATE_MODIFIER",\n        "Duplicate \'actual\' modifier",\n        "The \'actual\' modifier was specified more than once",\n        "Remove duplicate \'actual\' modifiers, keeping only one"\n    )',
  },
  {
    match: /panic\("Unexpected declaration modifier"\)/g,
    replace:
      'return p_result_error(\n        "E_PARSE_INVALID_MODIFIER",\n        "Unexpected declaration modifier",\n        "Encountered an unrecognized or invalid modifier",\n        "Use only valid modifiers: out, extern, copy, expect, actual"\n    )',
  },
  {
    match: /panic\("Cannot combine 'expect' and 'actual' modifiers"\)/g,
    replace:
      "return p_result_error(\n        \"E_PARSE_CONFLICTING_MODIFIERS\",\n        \"Cannot combine 'expect' and 'actual' modifiers\",\n        \"These modifiers are mutually exclusive\",\n        \"Use either 'expect' or 'actual', not both\"\n    )",
  },
  {
    match: /panic\("'copy' is not supported on extern declarations"\)/g,
    replace:
      'return p_result_error(\n        "E_PARSE_INVALID_MODIFIER",\n        "\'copy\' is not supported on extern declarations",\n        "External declarations cannot use the copy modifier",\n        "Remove the \'copy\' modifier from extern declarations"\n    )',
  },
  {
    match:
      /panic\("'expect'\/'actual' are not supported on extern declarations"\)/g,
    replace:
      "return p_result_error(\n        \"E_PARSE_INVALID_MODIFIER\",\n        \"'expect'/'actual' are not supported on extern declarations\",\n        \"External declarations cannot use expect/actual modifiers\",\n        \"Remove the 'expect'/'actual' modifiers from extern declarations\"\n    )",
  },
  {
    match:
      /panic\("'extern' modifier must be followed by fn, let, or type declaration"\)/g,
    replace:
      'return p_result_error(\n        "E_PARSE_INVALID_MODIFIER",\n        "\'extern\' modifier must be followed by fn, let, or type declaration",\n        "The extern modifier can only be used with function, variable, or type declarations",\n        "Add fn, let, or type after extern"\n    )',
  },
  {
    match: /panic\("'copy' is only supported on struct\/type declarations"\)/g,
    replace:
      'return p_result_error(\n        "E_PARSE_INVALID_MODIFIER",\n        "\'copy\' is only supported on struct/type declarations",\n        "The copy modifier can only be used with struct or type declarations",\n        "Remove \'copy\' or use it with struct/type declarations"\n    )',
  },
  {
    match:
      /panic\("'expect'\/'actual' are currently supported only on fn declarations"\)/g,
    replace:
      "return p_result_error(\n        \"E_PARSE_INVALID_MODIFIER\",\n        \"'expect'/'actual' are currently supported only on fn declarations\",\n        \"These modifiers are only available for function declarations\",\n        \"Remove 'expect'/'actual' or use them with fn declarations\"\n    )",
  },
  {
    match: /panic\("Expected fn, let, or type after extern"\)/g,
    replace:
      'return p_result_error(\n        "E_PARSE_EXPECTED_TOKEN",\n        "Expected fn, let, or type after extern",\n        "External declarations must be functions, variables, or types",\n        "Add fn, let, or type keyword after extern"\n    )',
  },
  {
    match:
      /panic\("Only 0 or 0USize is supported as a type-level numeric sentinel"\)/g,
    replace:
      'return p_result_error(\n        "E_PARSE_INVALID_LITERAL",\n        "Only 0 or 0USize is supported as a type-level numeric sentinel",\n        "Type-level numeric literals are restricted to zero sentinels",\n        "Use 0 or 0USize for type-level numeric sentinels"\n    )',
  },
];

function migrateFile(filePath: string): boolean {
  console.log(`\nMigrating ${path.relative(TUFFC_ROOT, filePath)}...`);
  let content = fs.readFileSync(filePath, "utf-8");
  let modified = false;

  // Apply panic conversions
  for (const { match, replace } of PANIC_CONVERSIONS) {
    if (content.match(match)) {
      content = content.replace(match, replace);
      modified = true;
      console.log(`  ✓ Converted panic to Result error`);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`  ✅ Saved changes`);
  } else {
    console.log(`  ℹ️  No changes needed`);
  }

  return modified;
}

function main() {
  console.log("=== Parser Result Migration (Phase 3) ===\n");

  const files = [
    "src/main/tuff/selfhost/parser_decls.tuff",
    "src/main/tuff/selfhost/parser_decls_let_extern.tuff",
    "src/main/tuff/selfhost/parser_core.tuff",
  ].map((f) => path.join(TUFFC_ROOT, f));

  const { totalModified, total } = runFileMigration(files, migrateFile);

  console.log(`\n=== Summary ===`);
  console.log(`Files modified: ${totalModified}/${total}`);
  console.log(`\nNext steps:`);
  console.log(`1. Convert function signatures to Result<I32, ParseError>`);
  console.log(`2. Add ? operators for error propagation`);
  console.log(`3. Wrap success returns with Ok<I32>`);
  console.log(`4. Update callers with match expressions`);
}

main();
