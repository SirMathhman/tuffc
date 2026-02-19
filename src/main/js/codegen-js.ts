let objectCtorNames = new Set();
let contractMethodNamesByName = new Map();
let functionEmitStack = [];

function resolveEmittedIdentifier(name) {
  for (let i = functionEmitStack.length - 1; i >= 0; i -= 1) {
    const map = functionEmitStack[i]?.paramRename;
    if (map && map.has(name)) return map.get(name);
  }
  return name;
}

function resolveThisExpression() {
  for (let i = functionEmitStack.length - 1; i >= 0; i -= 1) {
    const value = functionEmitStack[i]?.thisExpr;
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "this";
}

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
      if (expr.name === "this") return resolveThisExpression();
      return resolveEmittedIdentifier(expr.name);
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
      if (expr.callee?.kind === "Identifier" && expr.callee.name === "drop") {
        const target = expr.args?.[0];
        if (target?.kind === "Identifier") {
          return "undefined";
        }
        return "undefined";
      }

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
        const methodKey = JSON.stringify(expr.callee.name);
        // Priority: (1) direct property fn (this-captured), (2) vtable, (3) global static
        return `(() => { const __recv = ${receiver}; const __prop = __recv?.[${methodKey}]; if (typeof __prop === "function") return __prop(${rest}); const __dyn = __recv?.table?.${expr.callee.name}; return __dyn ? __dyn(${dynArgs}) : ${emitExpr(expr.callee)}(${staticArgs}); })()`;
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
    case "IntoValueExpr": {
      const src = emitExpr(expr.value);
      const contractName = expr.contractName ?? "<unknown>";
      const consumeSource =
        expr.value?.kind === "Identifier"
          ? `${expr.value.name} = undefined;`
          : "";
      return `(() => { const __src = ${src}; const __conv = __src?.__into?.[${JSON.stringify(contractName)}]; if (!__conv) { throw new Error(${JSON.stringify(`Missing into converter for ${contractName}`)}); } ${consumeSource} let __used = false; return (...__intoArgs) => { if (__used) { throw new Error(${JSON.stringify(`Into converter already consumed for ${contractName}`)}); } __used = true; return __conv(...__intoArgs); }; })()`;
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
    case "TupleExpr":
      return `[${(expr.elements ?? []).map(emitExpr).join(", ")}]`;
    case "ArrayExpr": {
      const elems = (expr.elements ?? []).map(emitExpr).join(", ");
      return `(function() { const __a = [${elems}]; Object.defineProperty(__a, 'init', { get() { return __a.length; } }); return __a; })()`;
    }
    case "RangeExpr": {
      const lo = emitExpr(expr.from);
      const hi = emitExpr(expr.to);
      return `(function() { let __cur = ${lo}, __hi = ${hi}; return function() { if (__cur > __hi) return [true, __hi]; let __val = __cur++; return [false, __val]; }; })()`;
    }
    default:
      return "undefined";
  }
}

let __tupleCounter = 0;
function emitStmt(stmt) {
  switch (stmt.kind) {
    case "TupleDestructure": {
      const tmp = `__tup${__tupleCounter++}`;
      const lines = [`const ${tmp} = ${emitExpr(stmt.value)};`];
      for (let i = 0; i < stmt.names.length; i++) {
        lines.push(`let ${stmt.names[i]} = ${tmp}[${i}];`);
      }
      return lines.join("\n");
    }
    case "LetDecl": {
      // Use 'let' to allow reassignment during bootstrap
      const decl = stmt.value
        ? `let ${stmt.name} = ${emitExpr(stmt.value)};`
        : `let ${stmt.name};`;
      const fnCtx = functionEmitStack[functionEmitStack.length - 1];
      if (
        fnCtx?.thisExpr === "__tuff_this" &&
        stmt.name !== "__tuff_this" &&
        stmt.name !== "__this_param"
      ) {
        return `${decl} __tuff_this.${stmt.name} = ${stmt.name};`;
      }
      return decl;
    }
    case "TypeAlias":
    case "ExternTypeDecl":
      return `// type alias: ${stmt.name}`;
    case "ImportDecl":
      return `// module import placeholder: { ${stmt.names.join(", ")} } = ${stmt.modulePath}`;
    case "ExprStmt":
      return `${emitExpr(stmt.expr)};`;
    case "AssignStmt": {
      const assign = `${emitExpr(stmt.target)} = ${emitExpr(stmt.value)};`;
      const fnCtx = functionEmitStack[functionEmitStack.length - 1];
      if (
        fnCtx?.thisExpr === "__tuff_this" &&
        stmt.target?.kind === "Identifier"
      ) {
        return `${assign} __tuff_this.${stmt.target.name} = ${stmt.target.name};`;
      }
      // this.x = value → also update local var x
      if (
        fnCtx?.thisExpr === "__tuff_this" &&
        stmt.target?.kind === "MemberExpr" &&
        stmt.target.object?.kind === "Identifier" &&
        stmt.target.object.name === "this"
      ) {
        const propName = stmt.target.property;
        const val = emitExpr(stmt.value);
        return `${propName} = ${val}; __tuff_this.${propName} = ${propName};`;
      }
      return assign;
    }
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
    case "LifetimeStmt":
      return stmt.body?.kind === "Block"
        ? emitBlock(stmt.body)
        : emitStmtOrBlock(stmt.body);
    case "DropStmt": {
      if (stmt.target?.kind !== "Identifier" || !stmt.destructorName) {
        return "// drop <unsupported target>";
      }
      const n = stmt.target.name;
      const d = stmt.destructorName;
      // Pass value directly (not a pointer wrapper) since destructors consume the value
      return `if (${n} !== undefined) { ${d}(${n}); ${n} = undefined; }`;
    }
    case "Block":
      return emitBlock(stmt);
    case "FnDecl": {
      if (stmt.expectDecl === true) {
        return `// expect fn ${stmt.name}`;
      }
      const paramRename = new Map();
      const params = stmt.params
        .map((p) => {
          if (p.name === "this") {
            paramRename.set("this", "__this_param");
            return "__this_param";
          }
          return p.name;
        })
        .join(", ");
      const hasExplicitThisParam = (stmt.params ?? []).some(
        (p) => p?.name === "this",
      );
      const visibleParamNames = (stmt.params ?? [])
        .filter((p) => p?.name !== "this")
        .map((p) => p?.name)
        .filter((name) => typeof name === "string" && name.length > 0);
      // Check if the enclosing function has a synthetic this.
      // If so, we capture it BEFORE declaring this function (in outer scope) to avoid
      // JavaScript TDZ issues caused by inner's own `let __tuff_this` shadowing the outer.
      const enclosingCtx = functionEmitStack[functionEmitStack.length - 1];
      const outerHasTuffThis = enclosingCtx?.thisExpr === "__tuff_this";
      const captureVar = `__tuff_outer_for_${stmt.name}`;
      // Preamble runs in OUTER scope — captures outer's __tuff_this before shadowing.
      const outerCapturePreamble =
        outerHasTuffThis && !hasExplicitThisParam
          ? `const ${captureVar} = __tuff_this;\n`
          : "";
      const buildSyntheticThisInit = () => {
        if (hasExplicitThisParam) return "";
        const fields = visibleParamNames.map((n) => `${n}: ${n}`).join(", ");
        if (outerHasTuffThis) {
          const outerField = fields
            ? `, this: ${captureVar}`
            : `this: ${captureVar}`;
          return `let __tuff_this = { ${fields}${outerField} };`;
        }
        return `let __tuff_this = { ${fields} };`;
      };
      const syntheticThisInit = buildSyntheticThisInit();
      const registrationSuffix =
        outerHasTuffThis &&
        stmt.name !== "__tuff_this" &&
        stmt.name !== "__this_param"
          ? `\n__tuff_this.${stmt.name} = ${stmt.name};`
          : "";
      if (stmt.body.kind === "Block") {
        const localFns = new Set(
          (stmt.body?.statements ?? [])
            .filter((s) => s?.kind === "FnDecl")
            .map((s) => s.name),
        );
        functionEmitStack.push({
          localFns,
          fnName: stmt.name,
          paramRename,
          thisExpr: hasExplicitThisParam ? "__this_param" : "__tuff_this",
        });
        const emittedBody = emitFunctionBlock(stmt.body);
        functionEmitStack.pop();
        let fnStr;
        if (!hasExplicitThisParam) {
          const bodyWithThis = emittedBody.replace(
            "{\n",
            `{\n  ${syntheticThisInit}\n`,
          );
          fnStr = `function ${stmt.name}(${params}) ${bodyWithThis}`;
        } else {
          fnStr = `function ${stmt.name}(${params}) ${emittedBody}`;
        }
        return `${outerCapturePreamble}${fnStr}${registrationSuffix}`;
      }
      functionEmitStack.push({
        localFns: new Set(),
        fnName: stmt.name,
        paramRename,
        thisExpr: hasExplicitThisParam ? "__this_param" : "__tuff_this",
      });
      const out = hasExplicitThisParam
        ? `function ${stmt.name}(${params}) { return ${emitExpr(stmt.body)}; }`
        : `function ${stmt.name}(${params}) { ${syntheticThisInit} return ${emitExpr(stmt.body)}; }`;
      functionEmitStack.pop();
      return `${outerCapturePreamble}${out}${registrationSuffix}`;
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
    case "ExternImportDecl":
      return `const { ${(stmt.names ?? []).join(", ")} } = ${stmt.source};`;
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
  let trailingDrops = 0;
  for (let i = block.statements.length - 1; i >= 0; i -= 1) {
    if (block.statements[i]?.kind === "DropStmt") {
      trailingDrops += 1;
      continue;
    }
    break;
  }

  if (trailingDrops > 0) {
    const retIdx = block.statements.length - trailingDrops - 1;
    const retStmt = block.statements[retIdx];
    if (retStmt?.kind === "ExprStmt" || retStmt?.kind === "IfStmt") {
      const rows = [];
      for (let i = 0; i < retIdx; i += 1) {
        rows.push(`  ${emitStmt(block.statements[i])}`);
      }
      // Run drops first, then evaluate return expression (so drops can affect return value)
      for (let i = retIdx + 1; i < block.statements.length; i += 1) {
        rows.push(`  ${emitStmt(block.statements[i])}`);
      }
      if (retStmt.kind === "ExprStmt") {
        rows.push(`  return ${emitExpr(retStmt.expr)};`);
      } else {
        rows.push(`  return ${emitIfStmtConditionalExpr(retStmt)};`);
      }
      return `{\n${rows.join("\n")}\n}`;
    }
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
