// Script to migrate panic-based error handling to Result-based error handling
// Generates .tuff source with Result<T, E> by applying regex transformations

import { fs, path, root } from "./script-utils.ts";

// ============================================================================
// Configuration
// ============================================================================

interface TransformConfig {
  sourceFile: string;
  outputFile: string;
  errorType: string;
  contextVar: string;
  panicWrapper: string;
  affectedFunctions: string[];
}

const resolverConfig: TransformConfig = {
  sourceFile: "src/main/tuff/selfhost/resolver.tuff",
  outputFile: "src/main/tuff/selfhost/resolver.tuff",
  errorType: "ResolveError",
  contextVar: "rslv_current_node",
  panicWrapper: "rslv_panic_loc",
  affectedFunctions: [
    "rslv_panic_loc",
    "resolve_expr_identifier",
    "resolve_expr_call",
    "resolve_expr_member",
    "resolve_expr_index",
    "resolve_expr_struct_init",
    "resolve_expr",
    "resolve_type",
    "resolve_stmt_let",
    "resolve_stmt_into",
    "resolve_stmt",
    "resolve_names",
  ],
};

// ============================================================================
// Transformation Functions
// ============================================================================

function generateResolverResultVersion(): string {
  const sourcePath = path.join(root, resolverConfig.sourceFile);
  let source = fs.readFileSync(sourcePath, "utf8");

  console.log("Step 1: Adding Result and ResolveError imports...");
  source = source.replace(
    "let {\n    getInternedStr, setNew, vecNew, mapNew\n}\n = selfhost::runtimeLexer;",
    `let {
    get_interned_str, set_new, vec_new, map_new
}
 = selfhost::runtimeLexer;
let { ResolveError } = selfhost::errors::ResolveError;
let { Ok, Err } = tuff-core::Result;`,
  );

  console.log(
    "Step 2: Transforming rslv_panic_loc wrapper to return Result...",
  );
  source = source.replace(
    /fn rslv_panic_loc\(code: \*Str, msg: \*Str, reason: \*Str, fix: \*Str\) : I32 =>\npanic_with_code_loc\(code, msg, reason, fix, node_get_line\(rslv_current_node\),\nnode_get_col\(rslv_current_node\)\);/,
    `fn rslv_panic_loc(code: *Str, msg: *Str, reason: *Str, fix: *Str) : Result<I32, ResolveError> => {
    Err<ResolveError> {
        error: ResolveError {
            code: code,
            message: msg,
            reason: reason,
            fix: fix,
            line: node_get_line(rslv_current_node),
            col: node_get_col(rslv_current_node)
        }
    }
}`,
  );

  console.log("Step 3: Updating function signatures to return Result...");
  for (const fnName of resolverConfig.affectedFunctions) {
    if (fnName === "rslv_panic_loc") continue;
    const signatureRegex = new RegExp(
      `(fn ${fnName}\\([^)]*\\))\\s*:\\s*I32\\s*=>`,
      "g",
    );
    source = source.replace(
      signatureRegex,
      `$1 : Result<I32, ResolveError> =>`,
    );
  }

  console.log("Step 4: Converting panic calls to return statements...");
  source = source.replace(
    /rslv_panic_loc\(\s*"([^"]+)",\s*([^,]+),\s*([^,]+),\s*([^)]+)\s*\);/gs,
    (_, code, msg, reason, fix) => {
      return `return rslv_panic_loc("${code}", ${msg}, ${reason}, ${fix});`;
    },
  );

  console.log("Step 5: Wrapping success returns with Ok<I32>...");
  source = source.replace(/return 0;/g, "return Ok<I32> { value: 0 };");
  source = source.replace(/(\n\s+)0(\n\})$/gm, "$1Ok<I32> { value: 0 }$2");

  console.log(
    "Step 6: Adding ? operator to Result-returning function calls...",
  );
  for (const fnName of resolverConfig.affectedFunctions) {
    if (fnName === "rslv_panic_loc") continue;
    const callRegex = new RegExp(`(${fnName}\\([^)]*\\));(?!\\?)`, "g");
    source = source.replace(callRegex, "$1?;");
  }

  return source;
}

// ============================================================================
// Main
// ============================================================================

function main() {
  console.log("=== Panic-to-Result Migration Generator ===\n");
  console.log("Phase 1: Transforming resolver.tuff...\n");

  try {
    const transformed = generateResolverResultVersion();
    const outputPath = path.join(root, resolverConfig.outputFile);
    const backupPath = outputPath + ".backup";

    fs.copyFileSync(outputPath, backupPath);
    console.log(`✓ Backed up original to: ${backupPath}`);

    fs.writeFileSync(outputPath, transformed, "utf8");
    console.log(`✓ Written transformed version to: ${outputPath}\n`);

    console.log("✓ Migration complete!\n");
    console.log("Next steps:");
    console.log(
      "1. Review changes: git diff src/main/tuff/selfhost/resolver.tuff",
    );
    console.log("2. Test compilation: npm run test");
    console.log(
      "3. If tests fail, restore: mv resolver.tuff.backup resolver.tuff",
    );
    console.log("4. If tests pass, commit the migration");
  } catch (error) {
    console.error("✖ Migration failed:", error);
    process.exit(1);
  }
}

main();
