const fs = require('fs');
const content = fs.readFileSync('src/index.ts', 'utf8');
const lines = content.split('\n');

// Helper functions to insert before parseAssignmentStatement
const helperFunctions = `  // Helper function to validate and get mutable binding
  function requireMutableBinding(nameTok: Tok): Binding {
    const binding: Binding = requireBinding(nameTok.val);
    if (!binding.mutable) {
      throw new Error(
        \`Type error: cannot assign to immutable variable "\${nameTok.val}"\`,
      );
    }
    return binding;
  }

  // Helper function to create arithmetic compound assignment expression
  function createArithmeticCompoundExpr(
    binding: Binding,
    rhs: TypedExpr,
    jsOp: string
  ): TypedExpr {
    if (binding.type === "Bool") {
      throw new Error("Type error: Bool not compatible with arithmetic operators");
    }
    const resultType: TuffType = promoteTypes(binding.type, rhs.type);
    return { code: \`\${binding.jsName} \${jsOp} \${rhs.code}\`, type: resultType };
  }

  // Helper function to create boolean compound assignment expression
  function createBoolCompoundExpr(
    binding: Binding,
    rhs: TypedExpr,
    jsOp: string
  ): TypedExpr {
    if (binding.type !== "Bool") {
      throw new Error("Type error: integer not compatible with bool operators");
    }
    if (rhs.type !== "Bool") {
      throw new Error("Type error: integer not compatible with bool operators");
    }
    return { code: \`\${binding.jsName} \${jsOp} \${rhs.code}\`, type: "Bool" };
  }

`;

const newParseAssignment = `  function parseAssignmentStatement(stmts: string[]): void {
    const nameTok: Tok = consume();
    consume(); // EQ
    const rhs: TypedExpr = parseOr();
    expect("SEMI");
    const binding: Binding = requireMutableBinding(nameTok);
    assertTypeCompatible(binding.type, rhs.type);
    stmts.push(\`\${binding.jsName} = \${rhs.code};\`);
  }`;

const newParseCompoundAssignment = `  function parseCompoundAssignmentStatement(stmts: string[]): void {
    const nameTok: Tok = consume();
    const opTok: Tok = consume(); // compound operator
    const rhs: TypedExpr = parseOr();
    expect("SEMI");

    const binding: Binding = requireMutableBinding(nameTok);

    // Desugar: x op= rhs becomes x = x op rhs
    // Create a synthetic expression representing "x op rhs"
    let desugaredExpr: TypedExpr;

    if (opTok.kind === "PLUS_EQ") {
      desugaredExpr = createArithmeticCompoundExpr(binding, rhs, "+");
    } else if (opTok.kind === "MINUS_EQ") {
      desugaredExpr = createArithmeticCompoundExpr(binding, rhs, "-");
    } else if (opTok.kind === "STAR_EQ") {
      desugaredExpr = createArithmeticCompoundExpr(binding, rhs, "*");
    } else if (opTok.kind === "SLASH_EQ") {
      desugaredExpr = createArithmeticCompoundExpr(binding, rhs, "/");
    } else if (opTok.kind === "AMP_EQ") {
      desugaredExpr = createBoolCompoundExpr(binding, rhs, "&&");
    } else if (opTok.kind === "PIPE_EQ") {
      desugaredExpr = createBoolCompoundExpr(binding, rhs, "||");
    } else {
      throw new Error(\`Unexpected compound operator: \${opTok.kind}\`);
    }

    // Type check the desugared expression against the variable's type
    assertTypeCompatible(binding.type, desugaredExpr.type);

    // Generate code: for arithmetic we can use JS compound assignment directly
    // For bool operators, we must expand fully
    if (opTok.kind === "AMP_EQ" || opTok.kind === "PIPE_EQ") {
      stmts.push(\`\${binding.jsName} = \${desugaredExpr.code};\`);
    } else {
      // Use JS compound assignment
      const jsOp: string = opTok.val; // += -= *= /=
      stmts.push(\`\${binding.jsName} \${jsOp} \${rhs.code};\`);
    }
  }`;

// Build new file
const newLines = [];
let i = 0;

// Copy lines before parseAssignmentStatement (0-485)
while (i < 486) {
  newLines.push(lines[i]);
  i++;
}

// Add helper functions
newLines.push(helperFunctions);

// Add refactored parseAssignmentStatement
newLines.push(newParseAssignment);
newLines.push('');

// Skip old parseAssignmentStatement (486-498) and go to parseCompoundAssignmentStatement
i = 500;

// Add refactored parseCompoundAssignmentStatement
newLines.push(newParseCompoundAssignment);

// Skip old parseCompoundAssignmentStatement (500-575) and copy rest of file
i = 576;
while (i < lines.length) {
  newLines.push(lines[i]);
  i++;
}

fs.writeFileSync('src/index.ts', newLines.join('\n'), 'utf8');
console.log('Refactoring complete');
