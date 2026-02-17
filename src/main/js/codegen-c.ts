// @ts-nocheck
import { TuffError } from "./errors.ts";
import { getEmbeddedCRuntimeSupport } from "./c-runtime-support.ts";

let tempCounter = 0;

function nextTemp(prefix) {
  tempCounter += 1;
  return `__${prefix}_${tempCounter}`;
}

function createContext(ast) {
  const enumNames = new Set();
  const enumVariantConstByName = new Map();
  const structFieldsByName = new Map();
  const aliasByVariant = new Map();
  const unionAliasByName = new Map();
  const fnReturnTypeByName = new Map();

  function flattenUnionNamedVariants(typeNode, out = []) {
    if (!typeNode) return out;
    if (typeNode.kind === "NamedType") {
      out.push(typeNode.name);
      return out;
    }
    if (typeNode.kind === "UnionType") {
      flattenUnionNamedVariants(typeNode.left, out);
      flattenUnionNamedVariants(typeNode.right, out);
      return out;
    }
    return out;
  }

  for (const node of ast.body ?? []) {
    if (node?.kind === "StructDecl") {
      structFieldsByName.set(
        node.name,
        (node.fields ?? []).map((f) => f.name),
      );
    }

    if (node?.kind === "TypeAlias") {
      const variants = flattenUnionNamedVariants(node.aliasedType, []);
      if (variants.length > 0) {
        unionAliasByName.set(node.name, {
          aliasName: node.name,
          variants,
        });
        for (const variant of variants) {
          if (!aliasByVariant.has(variant)) {
            aliasByVariant.set(variant, node.name);
          }
        }
      }
    }

    if (node?.kind !== "EnumDecl") continue;
    enumNames.add(node.name);
    for (const variant of node.variants ?? []) {
      enumVariantConstByName.set(variant, `${node.name}_${variant}`);
    }
  }

  for (const node of ast.body ?? []) {
    if (node?.kind !== "FnDecl") continue;
    fnReturnTypeByName.set(
      node.name,
      typeToCType(node.returnType, {
        unionAliasByName,
        aliasByVariant,
      }),
    );
  }

  for (const aliasInfo of unionAliasByName.values()) {
    const allFields = new Set();
    for (const variant of aliasInfo.variants) {
      for (const f of structFieldsByName.get(variant) ?? []) {
        allFields.add(f);
      }
    }
    aliasInfo.fields = [...allFields];
  }

  return {
    enumNames,
    enumVariantConstByName,
    structFieldsByName,
    aliasByVariant,
    unionAliasByName,
    fnReturnTypeByName,
  };
}

function unsupported(node, what) {
  throw new TuffError(`C codegen does not support ${what} yet`, node?.loc, {
    code: "E_CODEGEN_C_UNSUPPORTED",
    reason:
      "The current C backend MVP only supports a subset of Tuff expressions and declarations.",
    fix: "Use target 'js' for this program, or refactor to a currently supported C-backend subset.",
  });
}

function toCName(name) {
  return name === "main" ? "tuff_main" : name;
}

function typeToCType(typeNode, ctx) {
  if (!typeNode) return "int64_t";
  if (typeNode.kind === "PointerType") {
    const inner = typeToCType(typeNode.to, ctx);
    if (typeNode.move) return `${inner}*`;
    return typeToCType(typeNode.to, ctx);
  }
  if (typeNode.kind !== "NamedType") return "int64_t";
  const n = typeNode.name;
  if (/^[A-Z]$/.test(n)) {
    return "int64_t";
  }
  if (n === "I32" || n === "I64" || n === "Bool" || n === "USize") {
    return "int64_t";
  }
  if (n === "Char") {
    return "int64_t";
  }
  if (n === "Str" || n === "String") {
    return "int64_t";
  }
  if (ctx.enumNames?.has(n)) {
    return "int64_t";
  }
  if (ctx.unionAliasByName?.has(n)) return n;
  if (ctx.aliasByVariant?.has(n)) return ctx.aliasByVariant.get(n);
  return n;
}

function isBuiltinTypeName(name) {
  return (
    name === "I32" ||
    name === "I64" ||
    name === "Bool" ||
    name === "USize" ||
    name === "Char" ||
    name === "Str" ||
    name === "String"
  );
}

function collectNamedTypes(typeNode, out = new Set()) {
  if (!typeNode) return out;
  if (typeNode.kind === "NamedType") {
    out.add(typeNode.name);
    for (const arg of typeNode.genericArgs ?? []) {
      collectNamedTypes(arg, out);
    }
    return out;
  }
  if (typeNode.kind === "PointerType") {
    collectNamedTypes(typeNode.to, out);
    return out;
  }
  if (typeNode.kind === "UnionType") {
    collectNamedTypes(typeNode.left, out);
    collectNamedTypes(typeNode.right, out);
    return out;
  }
  return out;
}

function resolveIdentifier(name, ctx) {
  if (ctx.enumVariantConstByName.has(name)) {
    return ctx.enumVariantConstByName.get(name);
  }
  return toCName(name);
}

function inferExprType(expr, ctx, localTypes) {
  if (!expr) return "int64_t";
  switch (expr.kind) {
    case "NumberLiteral":
    case "BoolLiteral":
    case "CharLiteral":
    case "BinaryExpr":
    case "UnaryExpr":
    case "MatchExpr":
      return "int64_t";
    case "StringLiteral":
      return "int64_t";
    case "Identifier":
      return localTypes.get(expr.name) ?? "int64_t";
    case "CallExpr":
      if (expr.callee?.kind === "Identifier") {
        return ctx.fnReturnTypeByName.get(expr.callee.name) ?? "int64_t";
      }
      return "int64_t";
    case "StructInit": {
      const alias = ctx.aliasByVariant.get(expr.name);
      return alias ?? expr.name;
    }
    case "MemberExpr":
      return "int64_t";
    default:
      return "int64_t";
  }
}

function emitPatternGuard(valueExpr, pattern, ctx) {
  switch (pattern.kind) {
    case "WildcardPattern":
      return "1";
    case "LiteralPattern":
      return `(${valueExpr} == ${JSON.stringify(pattern.value)})`;
    case "NamePattern": {
      const enumConst = ctx.enumVariantConstByName.get(pattern.name);
      if (enumConst) {
        return `(${valueExpr} == ${enumConst})`;
      }
      const alias = ctx.aliasByVariant.get(pattern.name);
      if (alias) {
        return `(${valueExpr}.__tag == ${alias}_${pattern.name})`;
      }
      unsupported(pattern, "name-pattern bindings in C match expressions");
      return "0";
    }
    case "StructPattern":
      return `(${valueExpr}.__tag == ${ctx.aliasByVariant.get(pattern.name)}_${pattern.name})`;
    default:
      unsupported(pattern, `${pattern.kind} patterns in C match expressions`);
      return "0";
  }
}

function emitMatchExpr(expr, ctx, localTypes) {
  const target = emitExpr(expr.target, ctx, localTypes);
  let chain = '(tuff_panic("Non-exhaustive match"), 0)';

  for (let i = (expr.cases?.length ?? 0) - 1; i >= 0; i -= 1) {
    const branch = expr.cases[i];
    if (branch.body?.kind === "Block") {
      unsupported(branch.body, "block-valued match branches");
    }

    const guard = emitPatternGuard(target, branch.pattern, ctx);

    let body;
    if (branch.pattern.kind === "StructPattern") {
      if ((branch.pattern.fields ?? []).length === 0) {
        body = emitExpr(branch.body, ctx, localTypes);
      } else if (
        (branch.pattern.fields ?? []).length === 1 &&
        branch.body?.kind === "Identifier" &&
        branch.body.name === branch.pattern.fields[0].bind
      ) {
        body = `${target}.${branch.pattern.fields[0].field}`;
      } else {
        unsupported(
          branch.pattern,
          "multi-binding struct patterns in C match expressions",
        );
      }
    } else {
      body = emitExpr(branch.body, ctx, localTypes);
    }

    chain = `((${guard}) ? (${body}) : (${chain}))`;
  }

  return chain;
}

function emitBlockToTempAssign(block, tempName, ctx, localTypes) {
  const scoped = new Map(localTypes);
  const stmts = block.statements ?? [];
  if (stmts.length === 0) {
    return `${tempName} = 0;`;
  }

  const rows = [];
  for (let i = 0; i < stmts.length; i += 1) {
    const s = stmts[i];
    const isLast = i === stmts.length - 1;
    if (isLast && s.kind === "ExprStmt") {
      rows.push(`${tempName} = ${emitExpr(s.expr, ctx, scoped)};`);
      continue;
    }
    if (isLast && s.kind === "ReturnStmt") {
      rows.push(
        `${tempName} = ${s.value ? emitExpr(s.value, ctx, scoped) : "0"};`,
      );
      continue;
    }
    rows.push(emitStmt(s, ctx, scoped));
  }
  return rows.join(" ");
}

function emitExpr(expr, ctx, localTypes = new Map()) {
  switch (expr.kind) {
    case "NumberLiteral":
      return String(expr.value);
    case "BoolLiteral":
      return expr.value ? "1" : "0";
    case "Identifier":
      return resolveIdentifier(expr.name, ctx);
    case "UnaryExpr":
      if (expr.op === "&" || expr.op === "&mut") {
        return emitExpr(expr.expr, ctx, localTypes);
      }
      return `(${expr.op}${emitExpr(expr.expr, ctx, localTypes)})`;
    case "BinaryExpr":
      return `(${emitExpr(expr.left, ctx, localTypes)} ${expr.op} ${emitExpr(expr.right, ctx, localTypes)})`;
    case "CallExpr":
      if (expr.callee?.kind === "Identifier" && expr.callee.name === "drop") {
        return "0";
      }
      return `${emitExpr(expr.callee, ctx, localTypes)}(${expr.args.map((a) => emitExpr(a, ctx, localTypes)).join(", ")})`;
    case "MemberExpr": {
      if (
        expr.object?.kind === "Identifier" &&
        ctx.enumNames.has(expr.object.name)
      ) {
        return `${expr.object.name}_${expr.property}`;
      }
      unsupported(expr, "non-enum member access");
      return "0";
    }
    case "IfExpr":
      if (
        expr.thenBranch.kind === "Block" ||
        (expr.elseBranch && expr.elseBranch.kind === "Block")
      ) {
        const tmp = nextTemp("ifexpr");
        const cond = emitExpr(expr.condition, ctx, localTypes);
        const thenBody =
          expr.thenBranch.kind === "Block"
            ? emitBlockToTempAssign(expr.thenBranch, tmp, ctx, localTypes)
            : `${tmp} = ${emitExpr(expr.thenBranch, ctx, localTypes)};`;
        const elseBody = expr.elseBranch
          ? expr.elseBranch.kind === "Block"
            ? emitBlockToTempAssign(expr.elseBranch, tmp, ctx, localTypes)
            : `${tmp} = ${emitExpr(expr.elseBranch, ctx, localTypes)};`
          : `${tmp} = 0;`;

        return `({ int64_t ${tmp} = 0; if (${cond}) { ${thenBody} } else { ${elseBody} } ${tmp}; })`;
      }
      return `((${emitExpr(expr.condition, ctx, localTypes)}) ? (${emitExpr(expr.thenBranch, ctx, localTypes)}) : (${expr.elseBranch ? emitExpr(expr.elseBranch, ctx, localTypes) : "0"}))`;
    case "UnwrapExpr":
      return emitExpr(expr.expr, ctx, localTypes);
    case "StringLiteral":
      return `((int64_t)(intptr_t)${JSON.stringify(expr.value)})`;
    case "CharLiteral": {
      const c = expr.value ?? "\0";
      if (c.length === 1) {
        return String(c.charCodeAt(0));
      }
      if (c === "\\n") return "10";
      if (c === "\\r") return "13";
      if (c === "\\t") return "9";
      if (c === "\\0") return "0";
      return "0";
    }
    case "IndexExpr":
    case "StructInit":
    case "MatchExpr":
      if (expr.kind === "MatchExpr") {
        return emitMatchExpr(expr, ctx, localTypes);
      }
      if (expr.kind === "StructInit") {
        const alias = ctx.aliasByVariant.get(expr.name);
        if (alias) {
          const assignedFields = (expr.fields ?? [])
            .map((f) => `.${f.key} = ${emitExpr(f.value, ctx, localTypes)}`)
            .join(", ");
          return `((${alias}){ .__tag = ${alias}_${expr.name}${assignedFields ? `, ${assignedFields}` : ""} })`;
        }
        unsupported(expr, "standalone struct construction without union alias");
        return "0";
      }
      unsupported(expr, `${expr.kind} expressions`);
      return "0";
    case "IsExpr":
      unsupported(expr, `${expr.kind} expressions`);
      return "0";
    default:
      unsupported(expr, `${expr.kind} expressions`);
      return "0";
  }
}

function emitStmt(stmt, ctx, localTypes = new Map()) {
  switch (stmt.kind) {
    case "LetDecl": {
      const inferred = inferExprType(stmt.value, ctx, localTypes);
      localTypes.set(stmt.name, inferred);
      return `${inferred} ${toCName(stmt.name)} = ${emitExpr(stmt.value, ctx, localTypes)};`;
    }
    case "ExprStmt":
      return `${emitExpr(stmt.expr, ctx, localTypes)};`;
    case "AssignStmt":
      return `${emitExpr(stmt.target, ctx, localTypes)} = ${emitExpr(stmt.value, ctx, localTypes)};`;
    case "ReturnStmt":
      return stmt.value
        ? `return ${emitExpr(stmt.value, ctx, localTypes)};`
        : "return 0;";
    case "IfStmt":
      return emitIfLike(stmt, ctx, localTypes);
    case "IfExpr":
      return emitIfLike(stmt, ctx, localTypes);
    case "WhileStmt":
      return `while (${emitExpr(stmt.condition, ctx, localTypes)}) ${emitBlock(stmt.body, ctx, localTypes)}`;
    case "ForStmt":
      return `for (int64_t ${toCName(stmt.iterator)} = ${emitExpr(stmt.start, ctx, localTypes)}; ${toCName(stmt.iterator)} < ${emitExpr(stmt.end, ctx, localTypes)}; ${toCName(stmt.iterator)}++) ${emitBlock(stmt.body, ctx, localTypes)}`;
    case "LoopStmt":
      return `while (1) ${emitBlock(stmt.body, ctx, localTypes)}`;
    case "BreakStmt":
      return "break;";
    case "ContinueStmt":
      return "continue;";
    case "IntoStmt":
      return `/* into ${stmt.contractName} */`;
    case "DropStmt": {
      if (stmt.target?.kind !== "Identifier" || !stmt.destructorName) {
        return "/* drop <unsupported target> */";
      }
      const n = toCName(stmt.target.name);
      return `${toCName(stmt.destructorName)}(&${n}); ${n} = 0;`;
    }
    case "Block":
      return emitBlock(stmt, ctx, localTypes);
    case "ImportDecl":
      return `/* import placeholder(module=${stmt.modulePath}, names=${stmt.names.join("|")}) */`;
    case "FnDecl": {
      const params = stmt.params
        .map((p) => `${typeToCType(p.type, ctx)} ${toCName(p.name)}`)
        .join(", ");
      const fnName = toCName(stmt.name);
      const returnType = typeToCType(stmt.returnType, ctx);
      const fnLocals = new Map();
      for (const p of stmt.params ?? []) {
        fnLocals.set(p.name, typeToCType(p.type, ctx));
      }
      if (stmt.body.kind === "Block") {
        return `${returnType} ${fnName}(${params}) ${emitFunctionBlock(stmt.body, ctx, fnLocals)}`;
      }
      return `${returnType} ${fnName}(${params}) { return ${emitExpr(stmt.body, ctx, fnLocals)}; }`;
    }
    case "StructDecl":
      return `/* struct ${stmt.name} lowered via union aliases when applicable */`;
    case "EnumDecl": {
      const entries = stmt.variants
        .map((v, idx) => `${stmt.name}_${v} = ${idx}`)
        .join(", ");
      return `typedef enum ${stmt.name} { ${entries} } ${stmt.name};`;
    }
    case "TypeAlias": {
      const aliasInfo = ctx.unionAliasByName.get(stmt.name);
      if (!aliasInfo) {
        return `/* type ${stmt.name} unsupported for C MVP */`;
      }

      const tagEntries = aliasInfo.variants
        .map((v, i) => `${stmt.name}_${v} = ${i + 1}`)
        .join(", ");
      const fields = aliasInfo.fields.map((f) => `int64_t ${f};`).join(" ");
      const constructors = aliasInfo.variants
        .map((v) => {
          const variantFields = ctx.structFieldsByName.get(v) ?? [];
          const params = variantFields.map((f) => `int64_t ${f}`).join(", ");
          const assigns = variantFields
            .map((f) => `out.${f} = ${f};`)
            .join(" ");
          return `static inline ${stmt.name} ${stmt.name}_make_${v}(${params}) { ${stmt.name} out = {0}; out.__tag = ${stmt.name}_${v}; ${assigns} return out; }`;
        })
        .join("\n");

      return `typedef enum ${stmt.name}_Tag { ${tagEntries} } ${stmt.name}_Tag;\ntypedef struct ${stmt.name} { int32_t __tag; ${fields} } ${stmt.name};\n${constructors}`;
    }
    case "ContractDecl":
      return `/* contract ${stmt.name} */`;
    case "ExternFnDecl":
      return emitPrototype(
        `extern ${typeToCType(stmt.returnType, ctx)}`,
        stmt.name,
        emitParamList(stmt.params, ctx),
      );
    case "ExternLetDecl":
      return `extern ${typeToCType(stmt.type, ctx)} ${toCName(stmt.name)};`;
    case "ExternTypeDecl":
      return `/* extern type ${stmt.name} */`;
    case "ClassFunctionDecl":
      unsupported(stmt, `${stmt.kind} declarations`);
      return "";
    default:
      unsupported(stmt, `${stmt.kind} statements`);
      return "";
  }
}

function emitIfLike(stmt, ctx, localTypes) {
  const elsePart = stmt.elseBranch
    ? ` else ${emitStmtOrBlock(stmt.elseBranch, ctx, localTypes)}`
    : "";
  return `if (${emitExpr(stmt.condition, ctx, localTypes)}) ${emitStmtOrBlock(stmt.thenBranch, ctx, localTypes)}${elsePart}`;
}

function emitPrototype(returnType, name, params) {
  return `${returnType} ${name}(${params});`;
}

function emitParamList(params, ctx) {
  return (params ?? [])
    .map((p) => `${typeToCType(p.type, ctx)} ${toCName(p.name)}`)
    .join(", ");
}

function emitStmtOrBlock(node, ctx, localTypes) {
  if (node.kind === "Block") return emitBlock(node, ctx, localTypes);
  return `{ ${emitStmt(node, ctx, localTypes)} }`;
}

function emitBlock(block, ctx, localTypes) {
  const scoped = new Map(localTypes);
  const body = block.statements
    .map((s) => `  ${emitStmt(s, ctx, scoped)}`)
    .join("\n");
  return `{\n${body}\n}`;
}

function emitFunctionBlock(block, ctx, localTypes) {
  if (block.statements.length === 0) {
    return "{\n  return 0;\n}";
  }

  const scoped = new Map(localTypes);
  const rows = block.statements.map((s, idx) => {
    const isLast = idx === block.statements.length - 1;
    if (isLast && s.kind === "ExprStmt") {
      return "  return " + emitExpr(s.expr, ctx, scoped) + ";";
    }
    if (isLast && s.kind === "IfStmt") {
      const ifExpr = {
        kind: "IfExpr",
        condition: s.condition,
        thenBranch: s.thenBranch,
        elseBranch: s.elseBranch,
      };
      return `  return ${emitExpr(ifExpr, ctx, scoped)};`;
    }
    return `  ${emitStmt(s, ctx, scoped)}`;
  });
  return `{\n${rows.join("\n")}\n}`;
}

export function generateC(ast) {
  const ctx = createContext(ast);
  const topLevelTypes = new Map();
  const initRows = [];
  const fnNodes = [];
  const enumTypeNames = new Set(
    (ast.body ?? []).filter((n) => n.kind === "EnumDecl").map((n) => n.name),
  );
  const aliasTypeNames = new Set(
    (ast.body ?? []).filter((n) => n.kind === "TypeAlias").map((n) => n.name),
  );
  const namedTypes = new Set();

  for (const node of ast.body ?? []) {
    if (node.kind === "FnDecl" || node.kind === "ExternFnDecl") {
    }
    if (node.kind === "ExternLetDecl") {
      collectNamedTypes(node.type, namedTypes);
    }
    if (node.kind === "ExternTypeDecl") {
      namedTypes.add(node.name);
    }
  }

  const lines = [
    "#include <stdint.h>",
    "#include <stddef.h>",
    "#include <stdio.h>",
    "#include <stdlib.h>",
    "#include <string.h>",
    "#include <errno.h>",
    "#ifdef _WIN32",
    "#include <direct.h>",
    "#else",
    "#include <sys/stat.h>",
    "#include <sys/types.h>",
    "#endif",
    "",
    "/* Generated by Tuff Stage0 C backend (MVP). */",
    "",
    "/* Embedded C runtime support */",
    getEmbeddedCRuntimeSupport(),
    "",
  ];

  for (const t of [...namedTypes].sort()) {
    if (isBuiltinTypeName(t)) continue;
    if (/^[A-Z]$/.test(t)) continue;
    if (enumTypeNames.has(t)) continue;
    if (aliasTypeNames.has(t)) continue;
    lines.push(`typedef int64_t ${t};`);
  }
  lines.push("");

  for (const node of ast.body) {
    if (node.kind === "FnDecl") {
      if (node.expectDecl === true) {
        continue;
      }
      fnNodes.push(node);
      continue;
    }
    if (node.kind === "LetDecl") {
      const inferred = inferExprType(node.value, ctx, topLevelTypes);
      topLevelTypes.set(node.name, inferred);
      lines.push(`${inferred} ${toCName(node.name)};`);
      initRows.push(
        `${toCName(node.name)} = ${emitExpr(node.value, ctx, topLevelTypes)};`,
      );
      lines.push("");
      continue;
    }
    lines.push(emitStmt(node, ctx, topLevelTypes));
    lines.push("");
  }

  for (const node of fnNodes) {
    const returnType = typeToCType(node.returnType, ctx);
    const params = emitParamList(node.params, ctx);
    lines.push(emitPrototype(returnType, toCName(node.name), params));
  }
  lines.push("");

  for (const node of fnNodes) {
    lines.push(emitStmt(node, ctx, topLevelTypes));
    lines.push("");
  }

  lines.push("static void tuff_init_globals(void) {");
  for (const row of initRows) {
    lines.push(`  ${row}`);
  }
  lines.push("}");
  lines.push("");

  lines.push("int main(void) {");
  lines.push("  tuff_init_globals();");
  lines.push("  return (int)tuff_main();");
  lines.push("}");

  return lines.join("\n");
}
