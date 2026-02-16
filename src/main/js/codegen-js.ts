function emitPatternGuard(valueExpr, pattern) {
  switch (pattern.kind) {
    case "WildcardPattern":
      return "true";
    case "LiteralPattern":
      return `${valueExpr} === ${JSON.stringify(pattern.value)}`;
    case "NamePattern":
      return `${valueExpr} && ${valueExpr}.__tag === ${JSON.stringify(pattern.name)}`;
    case "StructPattern":
      return `${valueExpr} && ${valueExpr}.__tag === ${JSON.stringify(pattern.name)}`;
    default:
      return "false";
  }
}

function emitExpr(expr) {
  switch (expr.kind) {
    case "NumberLiteral":
      return String(expr.value);
    case "BoolLiteral":
      return expr.value ? "true" : "false";
    case "StringLiteral":
      // The lexer preserves escape sequences as-is, so just wrap in quotes
      return `"${expr.value}"`;
    case "CharLiteral":
      // Same for char literals
      return `"${expr.value}"`;
    case "Identifier":
      return expr.name;
    case "UnaryExpr":
      if (expr.op === "&" || expr.op === "&mut") {
        return emitExpr(expr.expr);
      }
      return `(${expr.op}${emitExpr(expr.expr)})`;
    case "BinaryExpr":
      return `(${emitExpr(expr.left)} ${expr.op} ${emitExpr(expr.right)})`;
    case "CallExpr":
      return `${emitExpr(expr.callee)}(${expr.args.map(emitExpr).join(", ")})`;
    case "MemberExpr":
      return `${emitExpr(expr.object)}.${expr.property}`;
    case "IndexExpr":
      return `${emitExpr(expr.target)}[${emitExpr(expr.index)}]`;
    case "StructInit": {
      const fields = expr.fields
        .map((f) => `${f.key}: ${emitExpr(f.value)}`)
        .join(", ");
      return `({ __tag: ${JSON.stringify(expr.name)}, ${fields} })`;
    }
    case "IfExpr": {
      const thenBody =
        expr.thenBranch.kind === "Block"
          ? `(() => ${emitFunctionBlock(expr.thenBranch)})()`
          : emitExpr(expr.thenBranch);
      const elseBody = expr.elseBranch
        ? expr.elseBranch.kind === "Block"
          ? `(() => ${emitFunctionBlock(expr.elseBranch)})()`
          : emitExpr(expr.elseBranch)
        : "undefined";
      return `((${emitExpr(expr.condition)}) ? ${thenBody} : ${elseBody})`;
    }
    case "MatchExpr": {
      const target = emitExpr(expr.target);
      const branches = expr.cases
        .map((c, idx) => {
          const guard = emitPatternGuard("__m", c.pattern);
          let bind = "";
          if (c.pattern.kind === "StructPattern") {
            bind = c.pattern.fields
              .map((f) => `const ${f.bind} = __m.${f.field};`)
              .join(" ");
          }
          if (c.pattern.kind === "NamePattern") {
            bind = `const ${c.pattern.name} = __m;`;
          }
          const body =
            c.body.kind === "Block"
              ? `(() => ${emitFunctionBlock(c.body)})()`
              : emitExpr(c.body);
          return `${idx === 0 ? "if" : "else if"} (${guard}) { ${bind} return ${body}; }`;
        })
        .join(" ");
      return `(() => { const __m = ${target}; ${branches} else { throw new Error("Non-exhaustive match"); } })()`;
    }
    case "IsExpr": {
      return `(${emitPatternGuard(emitExpr(expr.expr), expr.pattern)})`;
    }
    case "UnwrapExpr":
      return emitExpr(expr.expr);
    case "LambdaExpr": {
      const params = (expr.params ?? []).map((p) => p.name).join(", ");
      if (expr.body?.kind === "Block") {
        return `((${params}) => ${emitFunctionBlock(expr.body)})`;
      }
      return `((${params}) => ${emitExpr(expr.body)})`;
    }
    case "FnExpr": {
      const params = (expr.params ?? []).map((p) => p.name).join(", ");
      const name = expr.name ? ` ${expr.name}` : "";
      if (expr.body?.kind === "Block") {
        return `(function${name}(${params}) ${emitFunctionBlock(expr.body)})`;
      }
      return `(function${name}(${params}) { return ${emitExpr(expr.body)}; })`;
    }
    default:
      return "undefined";
  }
}

function emitStmt(stmt) {
  switch (stmt.kind) {
    case "LetDecl":
      // Use 'let' to allow reassignment during bootstrap
      return `let ${stmt.name} = ${emitExpr(stmt.value)};`;
    case "ImportDecl":
      return `// module import placeholder: { ${stmt.names.join(", ")} } = ${stmt.modulePath}`;
    case "ExprStmt":
      return `${emitExpr(stmt.expr)};`;
    case "AssignStmt":
      return `${emitExpr(stmt.target)} = ${emitExpr(stmt.value)};`;
    case "ReturnStmt":
      return stmt.value ? `return ${emitExpr(stmt.value)};` : "return;";
    case "IfStmt":
      return emitIfLikeStmt(stmt);
    case "IfExpr":
      return emitIfLikeStmt(stmt);
    case "WhileStmt":
      return `while (${emitExpr(stmt.condition)}) ${emitStmtOrBlock(stmt.body)}`;
    case "ForStmt":
      return `for (let ${stmt.iterator} = ${emitExpr(stmt.start)}; ${stmt.iterator} < ${emitExpr(stmt.end)}; ${stmt.iterator}++) ${emitStmtOrBlock(stmt.body)}`;
    case "BreakStmt":
      return "break;";
    case "ContinueStmt":
      return "continue;";
    case "Block":
      return emitBlock(stmt);
    case "FnDecl": {
      const params = stmt.params.map((p) => p.name).join(", ");
      if (stmt.body.kind === "Block") {
        return `function ${stmt.name}(${params}) ${emitFunctionBlock(stmt.body)}`;
      }
      return `function ${stmt.name}(${params}) { return ${emitExpr(stmt.body)}; }`;
    }
    case "StructDecl": {
      const init = stmt.fields
        .map((f) => `${f.name}: fields.${f.name}`)
        .join(", ");
      return `function ${stmt.name}(fields = {}) { return { __tag: ${JSON.stringify(stmt.name)}${init ? `, ${init}` : ""} }; }`;
    }
    case "EnumDecl": {
      const entries = stmt.variants
        .map((v) => `${v}: { __tag: ${JSON.stringify(v)} }`)
        .join(", ");
      return `const ${stmt.name} = { ${entries} };`;
    }
    case "TypeAlias":
      return `// type ${stmt.name} = ${JSON.stringify(stmt.aliasedType.kind)}`;
    case "ExternFnDecl":
      // Extern functions are provided by the runtime - just emit a comment
      return `// extern fn ${stmt.name}`;
    case "ExternLetDecl":
      return `// extern let ${stmt.name}`;
    case "ExternTypeDecl":
      return `// extern type ${stmt.name}`;
    default:
      return "";
  }
}

function emitIfLikeStmt(stmt) {
  const elsePart = stmt.elseBranch
    ? ` else ${emitStmtOrBlock(stmt.elseBranch)}`
    : "";
  return `if (${emitExpr(stmt.condition)}) ${emitStmtOrBlock(stmt.thenBranch)}${elsePart}`;
}

function emitStmtOrBlock(node) {
  if (node.kind === "Block") return emitBlock(node);
  return `{ ${emitStmt(node)} }`;
}

function emitBlock(block) {
  return `{\n${block.statements.map((s) => `  ${emitStmt(s)}`).join("\n")}\n}`;
}

function emitFunctionBlock(block) {
  if (block.statements.length === 0) {
    return "{\n}";
  }
  const rows = [];
  for (let idx = 0; idx < block.statements.length; idx += 1) {
    const s = block.statements[idx];
    const isLast = idx === block.statements.length - 1;
    if (isLast && s.kind === "ExprStmt") {
      rows.push(`  return ${emitExpr(s.expr)};`);
      continue;
    }
    // For IfStmt at last position, emit as expression with return
    if (isLast && s.kind === "IfStmt") {
      rows.push(`  return ${emitIfStmtConditionalExpr(s)};`);
      continue;
    }
    rows.push(`  ${emitStmt(s)}`);
  }
  return `{\n${rows.join("\n")}\n}`;
}

function emitIfStmtConditionalExpr(s) {
  const thenBody =
    s.thenBranch.kind === "Block"
      ? `(() => ${emitFunctionBlock(s.thenBranch)})()`
      : emitExpr(s.thenBranch);
  const elseBody = s.elseBranch
    ? s.elseBranch.kind === "Block"
      ? `(() => ${emitFunctionBlock(s.elseBranch)})()`
      : s.elseBranch.kind === "IfStmt"
        ? emitIfStmtConditionalExpr(s.elseBranch)
        : emitExpr(s.elseBranch)
    : "undefined";
  return `((${emitExpr(s.condition)}) ? ${thenBody} : ${elseBody})`;
}

function emitIfStmtAsExpr(s) {
  return emitIfStmtConditionalExpr(s);
}

export function generateJavaScript(ast: { body: unknown[] }): string {
  const lines = ['"use strict";', ""];
  for (const node of ast.body) {
    lines.push(emitStmt(node));
    lines.push("");
  }
  return lines.join("\n");
}
