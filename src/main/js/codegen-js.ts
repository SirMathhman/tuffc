let objectCtorNames = new Set();
let contractMethodNamesByName = new Map();
let functionEmitStack = [];

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
        if (expr.op === "&mut" && expr.expr?.kind === "Identifier") {
          const n = expr.expr.name;
          return `({ __ptr_get: () => ${n}, __ptr_set: (__v) => { ${n} = __v; } })`;
        }
        return emitExpr(expr.expr);
      }
      return `(${expr.op}${emitExpr(expr.expr)})`;
    case "BinaryExpr":
      return `(${emitExpr(expr.left)} ${expr.op} ${emitExpr(expr.right)})`;
    case "CallExpr":
      if (
        expr.callStyle === "method-sugar" &&
        expr.callee?.kind === "Identifier" &&
        expr.callee.name === "into"
      ) {
        const contractTypeArg = expr.typeArgs?.[0];
        const contractName =
          contractTypeArg?.kind === "NamedType"
            ? contractTypeArg.name
            : undefined;
        const src = emitExpr(expr.args?.[0]);
        const restArgs = (expr.args ?? []).slice(1).map(emitExpr).join(", ");
        const consumeSource =
          expr.args?.[0]?.kind === "Identifier"
            ? `${expr.args[0].name} = undefined;`
            : "";
        return `(() => { const __src = ${src}; const __conv = __src?.__into?.[${JSON.stringify(contractName ?? "")}] ; if (!__conv) { throw new Error(${JSON.stringify(`Missing into converter for ${contractName ?? "<unknown>"}`)}); } const __out = __conv(${restArgs}); ${consumeSource} return __out; })()`;
      }

      if (
        expr.callStyle === "method-sugar" &&
        expr.callee?.kind === "Identifier" &&
        (expr.args?.length ?? 0) >= 1
      ) {
        const receiver = emitExpr(expr.args[0]);
        const rest = (expr.args ?? []).slice(1).map(emitExpr).join(", ");
        const dynArgs = [`__recv.ref`, rest]
          .filter((x) => x.length > 0)
          .join(", ");
        const staticArgs = [`__recv`, rest]
          .filter((x) => x.length > 0)
          .join(", ");
        return `(() => { const __recv = ${receiver}; const __dyn = __recv?.table?.${expr.callee.name}; return __dyn ? __dyn(${dynArgs}) : ${emitExpr(expr.callee)}(${staticArgs}); })()`;
      }
      return `${emitExpr(expr.callee)}(${expr.args.map(emitExpr).join(", ")})`;
    case "MemberExpr":
      return `${emitExpr(expr.object)}.${expr.property}`;
    case "IndexExpr":
      return `${emitExpr(expr.target)}[${emitExpr(expr.index)}]`;
    case "StructInit": {
      const fields = expr.fields
        .map((f) => `${f.key}: ${emitExpr(f.value)}`)
        .join(", ");
      const objectLiteral = `({ __tag: ${JSON.stringify(expr.name)}${fields ? `, ${fields}` : ""} })`;
      if (objectCtorNames.has(expr.name)) {
        const fieldsObject = `{${fields ? ` ${fields} ` : ""}}`;
        return `${expr.name}(${fieldsObject})`;
      }
      return objectLiteral;
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
    case "IntoExpr": {
      const src = emitExpr(expr.value);
      const args = (expr.args ?? []).map(emitExpr).join(", ");
      const consumeSource =
        expr.value?.kind === "Identifier"
          ? `${expr.value.name} = undefined;`
          : "";
      return `(() => { const __src = ${src}; const __conv = __src?.__into?.[${JSON.stringify(expr.contractName)}]; if (!__conv) { throw new Error(${JSON.stringify(`Missing into converter for ${expr.contractName}`)}); } const __out = __conv(${args}); ${consumeSource} return __out; })()`;
    }
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
      return stmt.value
        ? `let ${stmt.name} = ${emitExpr(stmt.value)};`
        : `let ${stmt.name};`;
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
    case "LoopStmt":
      return `while (true) ${emitStmtOrBlock(stmt.body)}`;
    case "BreakStmt":
      return "break;";
    case "ContinueStmt":
      return "continue;";
    case "IntoStmt": {
      const ctx = functionEmitStack[functionEmitStack.length - 1];
      const methods = contractMethodNamesByName.get(stmt.contractName) ?? [];
      const hasLocals =
        methods.length > 0 && methods.every((m) => ctx?.localFns?.has(m));
      if (!ctx || !hasLocals) {
        return `// into ${stmt.contractName}`;
      }
      const tableName = `__dyn_${stmt.contractName}Table`;
      const wrapperName = `__dyn_${stmt.contractName}`;
      const tableFields = methods.map((m) => `${m}: ${m}`).join(", ");
      return [
        `const __self = (typeof __this !== "undefined") ? __this : this;`,
        `__self.__into = __self.__into || {};`,
        `__self.__into[${JSON.stringify(stmt.contractName)}] = (ptr) => {`,
        `  if (ptr && typeof ptr.__ptr_set === "function") { ptr.__ptr_set(__self); }`,
        `  const __ref = ptr && typeof ptr.__ptr_get === "function" ? ptr.__ptr_get() : ptr;`,
        `  return ${wrapperName}({ ref: __ref, table: ${tableName}({ ${tableFields} }) });`,
        `};`,
      ].join("\n");
    }
    case "Block":
      return emitBlock(stmt);
    case "FnDecl": {
      if (stmt.expectDecl === true) {
        return `// expect fn ${stmt.name}`;
      }
      const params = stmt.params.map((p) => p.name).join(", ");
      if (stmt.body.kind === "Block") {
        const localFns = new Set(
          (stmt.body?.statements ?? [])
            .filter((s) => s?.kind === "FnDecl")
            .map((s) => s.name),
        );
        functionEmitStack.push({ localFns, fnName: stmt.name });
        const emittedBody = emitFunctionBlock(stmt.body);
        functionEmitStack.pop();
        return `function ${stmt.name}(${params}) ${emittedBody}`;
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
    case "ObjectDecl": {
      const inputs = stmt.inputs ?? [];
      if (inputs.length === 0) {
        return `const ${stmt.name} = { __tag: ${JSON.stringify(stmt.name)} };`;
      }

      const keyParts = inputs.map((f) => `fields.${f.name}`).join(", ");
      const valueFields = inputs
        .map((f) => `${f.name}: fields.${f.name}`)
        .join(", ");

      return [
        `const ${stmt.name} = (() => {`,
        `  const __cache = new Map();`,
        `  return (fields = {}) => {`,
        `    const __key = JSON.stringify([${keyParts}]);`,
        `    const __cached = __cache.get(__key);`,
        `    if (__cached !== undefined) return __cached;`,
        `    const __value = { __tag: ${JSON.stringify(stmt.name)}${valueFields ? `, ${valueFields}` : ""} };`,
        `    __cache.set(__key, __value);`,
        `    return __value;`,
        `  };`,
        `})();`,
      ].join("\n");
    }
    case "ContractDecl":
      return `// contract ${stmt.name}`;
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
  objectCtorNames = new Set();
  contractMethodNamesByName = new Map();
  functionEmitStack = [];
  for (const node of ast.body ?? []) {
    const decl = node as any;
    if (decl?.kind === "ObjectDecl" && (decl?.inputs ?? []).length > 0) {
      objectCtorNames.add(decl.name);
    }
    if (decl?.kind === "ContractDecl") {
      contractMethodNamesByName.set(
        decl.name,
        (decl.methods ?? []).map((m) => m.name),
      );
    }
  }

  const lines = ['"use strict";', ""];
  for (const node of ast.body) {
    lines.push(emitStmt(node));
    lines.push("");
  }
  return lines.join("\n");
}
