// @ts-nocheck
import { TuffError } from "./errors.ts";
import { getEmbeddedCSubstrateSupport } from "./c-runtime-support.ts";

let tempCounter = 0;

/** Encode a raw Tuff string token value as a C double-quoted string literal.
 * The input is the raw lexer value with Tuff escape sequences in source form
 * (two chars: `\` + escape letter). C uses the same sequences for \n, \r, \t,
 * \\, \", and \0. Tuff \uXXXX sequences are not valid in C string literals
 * (C's \u is restricted to identifier contexts), so we decode them to UTF-8
 * bytes stored as octal escapes. */
function toCStringLiteral(raw) {
  // Only rewrite \uXXXX sequences; everything else passes through identically.
  const cStr = raw.replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex) => {
    const cp = parseInt(hex, 16);
    // UTF-8 encode the codepoint into octal escape sequences.
    let bytes;
    if (cp < 0x80) {
      bytes = [cp];
    } else if (cp < 0x800) {
      bytes = [0xc0 | (cp >> 6), 0x80 | (cp & 0x3f)];
    } else {
      bytes = [
        0xe0 | (cp >> 12),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      ];
    }
    return bytes.map((b) => `\\${b.toString(8).padStart(3, "0")}`).join("");
  });
  return `"${cStr}"`;
}

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

  // Detect this-returning functions (method-sugar pattern).
  // Helper: detect uses of this.this.X (outer context access) in an AST node.
  const hasThisThisAccess = (node) => {
    if (!node || typeof node !== "object") return false;
    if (
      node.kind === "MemberExpr" &&
      node.object?.kind === "MemberExpr" &&
      node.object.object?.kind === "Identifier" &&
      node.object.object.name === "this" &&
      node.object.property === "this"
    )
      return true;
    for (const val of Object.values(node)) {
      if (val === null || typeof val !== "object") continue;
      if (Array.isArray(val)) {
        if (val.some((v) => hasThisThisAccess(v))) return true;
      } else if (hasThisThisAccess(val)) return true;
    }
    return false;
  };
  // Names of nested fns that need outer context as first param.
  const contextualFnNames = new Set();
  const thisReturners = new Map();
  for (const node of ast.body ?? []) {
    if (node?.kind !== "FnDecl") continue;
    const body = node.body;
    let returnsThis = false;
    let bodyStmts = [];
    const isThisExpr = (n) =>
      (n?.kind === "ExprStmt" &&
        n.expr?.kind === "Identifier" &&
        n.expr.name === "this") ||
      (n?.kind === "Identifier" && n.name === "this");
    if (body?.kind === "Identifier" && body.name === "this") {
      returnsThis = true;
      bodyStmts = [];
    } else if (body?.kind === "Block") {
      const stmts = body.statements ?? [];
      if (stmts.length > 0 && isThisExpr(stmts[stmts.length - 1])) {
        returnsThis = true;
        bodyStmts = stmts.slice(0, -1);
      }
    }
    if (returnsThis) {
      const fields = [];
      for (const p of (node.params ?? []).filter((p) => !p.implicitThis)) {
        fields.push({ name: p.name, isFnPtr: false });
      }
      for (const s of bodyStmts) {
        if (s.kind === "LetDecl") fields.push({ name: s.name, isFnPtr: false });
        if (s.kind === "FnDecl") {
          // Check if nested fn is itself a thisReturner (body ends with `this`).
          const nestedBody = s.body;
          const nestedBodyStmts =
            nestedBody?.kind === "Block" ? (nestedBody.statements ?? []) : [];
          const nestedLastIsThis =
            (nestedBody?.kind === "Identifier" && nestedBody.name === "this") ||
            (nestedBodyStmts.length > 0 &&
              isThisExpr(nestedBodyStmts[nestedBodyStmts.length - 1]));
          if (nestedLastIsThis) {
            // Register nested fn as its own thisReturner.
            const nestedBodyMinusLast =
              nestedBody?.kind === "Identifier"
                ? []
                : nestedBodyStmts.slice(0, -1);
            const nestedFields = [];
            for (const p of (s.params ?? []).filter((p) => !p.implicitThis)) {
              nestedFields.push({ name: p.name, isFnPtr: false });
            }
            for (const ns of nestedBodyMinusLast) {
              if (ns.kind === "LetDecl")
                nestedFields.push({ name: ns.name, isFnPtr: false });
            }
            thisReturners.set(s.name, {
              fields: nestedFields,
              bodyStmts: nestedBodyMinusLast,
              params: s.params ?? [],
            });
            fnReturnTypeByName.set(s.name, `__TuffThis_${s.name}`);
            const nestedParams = (s.params ?? [])
              .filter((p) => !p.implicitThis)
              .map(() => "int64_t")
              .join(", ");
            fields.push({
              name: s.name,
              isFnPtr: true,
              fnPtrParams: nestedParams || "void",
              fnPtrRetType: `__TuffThis_${s.name}`,
            });
          } else {
            // Nested fn: becomes a function pointer field in the struct.
            // Check if it uses this.this.X (needs outer context as first param).
            const needsOuterCtx = hasThisThisAccess(s.body);
            const outerStructType = `__TuffThis_${node.name}`;
            const nestedParams = (s.params ?? [])
              .filter((p) => !p.implicitThis)
              .map(() => "int64_t")
              .join(", ");
            const fnPtrParams = needsOuterCtx
              ? `${outerStructType}*${nestedParams ? `, ${nestedParams}` : ""}`
              : nestedParams || "void";
            if (needsOuterCtx) contextualFnNames.add(s.name);
            fields.push({
              name: s.name,
              isFnPtr: true,
              fnPtrParams,
              needsOuterCtx: needsOuterCtx ? outerStructType : null,
            });
          }
        }
      }
      thisReturners.set(node.name, {
        fields,
        bodyStmts,
        params: node.params ?? [],
      });
      // Override return type to struct type.
      fnReturnTypeByName.set(node.name, `__TuffThis_${node.name}`);
    }
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

  // Detect function-returning functions (fn body ends with ExprStmt(Identifier(nestedFnName))
  // where that nestedFnName is a nested FnDecl in the body).
  const fnReturners = new Map(); // fnName → { retFnName, typedefName }
  for (const node of ast.body ?? []) {
    if (node?.kind !== "FnDecl") continue;
    if (thisReturners.has(node.name)) continue;
    const body = node.body;
    const bodyStmts = body?.kind === "Block" ? (body.statements ?? []) : [];
    if (bodyStmts.length === 0) continue;
    const lastStmt = bodyStmts[bodyStmts.length - 1];
    const retName =
      lastStmt?.kind === "ExprStmt" && lastStmt.expr?.kind === "Identifier"
        ? lastStmt.expr.name
        : lastStmt?.kind === "Identifier"
          ? lastStmt.name
          : null;
    if (!retName) continue;
    const nestedFn = bodyStmts.find(
      (s) => s.kind === "FnDecl" && s.name === retName,
    );
    if (!nestedFn) continue;
    const typedefName = `__FnPtr_${retName}`;
    const nestedParams = (nestedFn.params ?? [])
      .filter((p) => !p.implicitThis)
      .map(() => "int64_t")
      .join(", ");
    fnReturners.set(node.name, {
      retFnName: retName,
      typedefName,
      nestedParamTypes: nestedParams || "void",
    });
    fnReturnTypeByName.set(node.name, typedefName);
  }

  return {
    enumNames,
    enumVariantConstByName,
    structFieldsByName,
    aliasByVariant,
    unionAliasByName,
    fnReturnTypeByName,
    thisReturners,
    fnReturners,
    contextualFnNames,
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

// C stdlib functions already declared via substrate.h — suppress re-declaration.
const C_STDLIB_BUILTINS = new Set([
  "malloc",
  "free",
  "realloc",
  "memcpy",
  "memmove",
  "printf",
  "fprintf",
  "strlen",
  "strdup",
  "strcmp",
  "exit",
  "abort",
]);

function typeToCType(typeNode, ctx) {
  if (!typeNode) return "int64_t";
  if (typeNode.kind === "PointerType") {
    // *[T; I; L] (array slice pointer) → TuffVec* (fat pointer, already in substrate)
    if (typeNode.to?.kind === "ArrayType") return "TuffVec*";
    const inner = typeToCType(typeNode.to, ctx);
    if (typeNode.move) return `${inner}*`;
    return typeToCType(typeNode.to, ctx);
  }
  // Bare array type (element type only) — seldom appears standalone.
  if (typeNode.kind === "ArrayType") return "int64_t";
  // Nullable pointer union: T | 0 / T | 0USize → lower to T (null represented as NULL/0).
  if (typeNode.kind === "UnionType") {
    if (typeNode.right?.kind === "RefinementType")
      return typeToCType(typeNode.left, ctx);
    return "int64_t";
  }
  if (typeNode.kind === "BinaryTypeExpr") return "size_t";
  if (typeNode.kind === "MemberTypeExpr") return "size_t";
  if (typeNode.kind === "MemberCallTypeExpr") return "size_t";
  if (typeNode.kind === "NumberLiteralType") return "size_t";
  if (typeNode.kind === "FunctionType") return "int64_t";
  if (typeNode.kind === "TupleType") return "int64_t";
  if (typeNode.kind === "SelfType") return "void*";
  if (typeNode.kind !== "NamedType") return "int64_t";
  const n = typeNode.name;
  if (/^[A-Z]$/.test(n)) {
    return "int64_t";
  }
  // SizeOf<T> (byte-count type) → size_t
  if (n === "SizeOf") return "size_t";
  // Void → void
  if (n === "Void") return "void";
  // Alloc<T> erases to T (destructor wrapper — codegen handles drops separately).
  if (n === "Alloc") {
    const inner = typeNode.genericArgs?.[0];
    return inner ? typeToCType(inner, ctx) : "int64_t";
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
    case "MatchExpr":
      return "int64_t";
    case "StringLiteral":
      return "int64_t";
    case "Identifier":
      if (localTypes.has(expr.name)) return localTypes.get(expr.name);
      // If it refers to a known function, treat as function pointer.
      if (ctx.fnReturnTypeByName.has(expr.name)) {
        return `${ctx.fnReturnTypeByName.get(expr.name)}(*)()`;
      }
      return "int64_t";
    case "TupleExpr":
    case "ArrayExpr":
      return "__tuff_vec_t";
    case "RangeExpr":
      return "__tuff_range_t";
    case "UnaryExpr":
      // &x propagates the type of x (slice refs).
      if (expr.op === "&" || expr.op === "&mut")
        return inferExprType(expr.expr, ctx, localTypes);
      return "int64_t";
    case "CallExpr":
      // RangeExpr or range variable call → produces a tuple-like vec
      if (expr.callee?.kind === "RangeExpr") return "__tuff_range_result_t";
      if (
        expr.callee?.kind === "Identifier" &&
        localTypes.get(expr.callee.name) === "__tuff_range_t"
      )
        return "__tuff_range_result_t";
      if (expr.callee?.kind === "Identifier") {
        const cn = expr.callee.name;
        // If it's a this-returning function, return struct type.
        if (ctx.thisReturners?.has(cn)) return `__TuffThis_${cn}`;
        // malloc/realloc return a TuffVec* fat slice pointer (special-cased in emitExpr).
        if (cn === "malloc" || cn === "realloc") return "TuffVec*";
        return ctx.fnReturnTypeByName.get(cn) ?? "int64_t";
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
    case "BinaryExpr": {
      // Pointer arithmetic on TuffVec* slice: slice + offset → slice->data + offset
      if (
        expr.op === "+" &&
        expr.left?.kind === "Identifier" &&
        localTypes.get(expr.left.name) === "TuffVec*"
      ) {
        const ptrStr = emitExpr(expr.left, ctx, localTypes);
        const offStr = emitExpr(expr.right, ctx, localTypes);
        return `(${ptrStr}->data + ${offStr})`;
      }
      return `(${emitExpr(expr.left, ctx, localTypes)} ${expr.op} ${emitExpr(expr.right, ctx, localTypes)})`;
    }
    case "CallExpr": {
      if (expr.callee?.kind === "Identifier" && expr.callee.name === "drop") {
        return "0";
      }
      // sizeOf<T>() → sizeof(C_type) cast to int64_t
      if (
        expr.callee?.kind === "Identifier" &&
        expr.callee.name === "sizeOf" &&
        (expr.typeArgs?.length ?? 0) > 0
      ) {
        const cType = typeToCType(expr.typeArgs[0], ctx);
        return `(int64_t)sizeof(${cType})`;
      }
      // malloc<T, L>(byteCount) → allocate TuffVec fat slice (data + metadata).
      if (
        expr.callee?.kind === "Identifier" &&
        expr.callee.name === "malloc" &&
        (expr.args?.length ?? 0) >= 1
      ) {
        const bytesStr = emitExpr(expr.args[0], ctx, localTypes);
        const nbytes = nextTemp("malloc_nbytes");
        const vec = nextTemp("malloc_vec");
        return `({ size_t ${nbytes} = (size_t)(${bytesStr}); TuffVec* ${vec} = (TuffVec*)malloc(sizeof(TuffVec)); if (${vec}) { ${vec}->data = (int64_t*)malloc(${nbytes}); ${vec}->init = 0; ${vec}->length = ${nbytes} / sizeof(int64_t); if (!${vec}->data) { free(${vec}); ${vec} = NULL; } } ${vec}; })`;
      }
      // realloc<T, ...>(ptr, byteCount) → grow TuffVec data in-place.
      if (
        expr.callee?.kind === "Identifier" &&
        expr.callee.name === "realloc" &&
        (expr.args?.length ?? 0) >= 2
      ) {
        const ptrStr = emitExpr(expr.args[0], ctx, localTypes);
        const bytesStr = emitExpr(expr.args[1], ctx, localTypes);
        const nbytes = nextTemp("realloc_nbytes");
        const vec = nextTemp("realloc_vec");
        const data = nextTemp("realloc_data");
        return `({ size_t ${nbytes} = (size_t)(${bytesStr}); TuffVec* ${vec} = (TuffVec*)(${ptrStr}); if (${vec}) { int64_t* ${data} = (int64_t*)realloc(${vec}->data, ${nbytes}); if (${data}) { ${vec}->data = ${data}; ${vec}->length = ${nbytes} / sizeof(int64_t); } else { ${vec} = NULL; } } ${vec}; })`;
      }
      // Range/generator call: callee is a RangeExpr directly → immediate next
      if (expr.callee?.kind === "RangeExpr") {
        const rangeHandle = emitExpr(expr.callee, ctx, localTypes);
        return `__tuff_range_next(${rangeHandle})`;
      }
      // Generator call: callee is an identifier of type __tuff_range_t
      if (
        expr.callee?.kind === "Identifier" &&
        (localTypes.get(expr.callee.name) === "__tuff_range_t" ||
          (ctx.topLevelTypes &&
            ctx.topLevelTypes.get(expr.callee.name) === "__tuff_range_t"))
      ) {
        return `__tuff_range_next(${emitExpr(expr.callee, ctx, localTypes)})`;
      }
      // free(ptr) → free TuffVec data then the struct itself.
      if (
        expr.callee?.kind === "Identifier" &&
        expr.callee.name === "free" &&
        (expr.args?.length ?? 0) >= 1
      ) {
        const ptrStr = emitExpr(expr.args[0], ctx, localTypes);
        const vec = nextTemp("free_vec");
        return `({ TuffVec* ${vec} = (TuffVec*)(${ptrStr}); if (${vec}) { free(${vec}->data); free(${vec}); } 0; })`;
      }
      // Method-sugar calls: receiver is args[0]. In C, all Tuff methods are
      // free functions and the receiver is always their first argument.
      if (expr.callStyle === "method-sugar") {
        const [receiver, ...restArgs] = expr.args ?? [];
        const recvC = emitExpr(receiver, ctx, localTypes);
        const cArgs = restArgs
          .map((a) => emitExpr(a, ctx, localTypes))
          .join(", ");
        const callee = emitExpr(expr.callee, ctx, localTypes);
        if (ctx.contextualFnNames?.has(expr.callee?.name)) {
          // Contextual (closure-capturing) fn: pass pointer to receiver struct.
          const ctxArgs = cArgs ? `&${recvC}, ${cArgs}` : `&${recvC}`;
          return `${callee}(${ctxArgs})`;
        }
        const fullArgs = cArgs ? `${recvC}, ${cArgs}` : recvC;
        return `${callee}(${fullArgs})`;
      }
      return `${emitExpr(expr.callee, ctx, localTypes)}(${(expr.args ?? []).map((a) => emitExpr(a, ctx, localTypes)).join(", ")})`;
    }
    case "MemberExpr": {
      // this.this.field → outer_ctx->field (outer context access in nested fn, via pointer)
      if (
        expr.object?.kind === "MemberExpr" &&
        expr.object.object?.kind === "Identifier" &&
        expr.object.object.name === "this" &&
        expr.object.property === "this"
      ) {
        return `outer_ctx->${toCName(expr.property)}`;
      }
      // this.field → direct local variable access in C
      if (expr.object?.kind === "Identifier" && expr.object.name === "this") {
        return toCName(expr.property);
      }
      if (
        expr.object?.kind === "Identifier" &&
        ctx.enumNames.has(expr.object.name)
      ) {
        return `${expr.object.name}_${expr.property}`;
      }
      // General struct / TuffVec* field access.
      {
        const objStr = emitExpr(expr.object, ctx, localTypes);
        const objType =
          expr.object?.kind === "Identifier"
            ? localTypes.get(expr.object.name)
            : inferExprType(expr.object, ctx, localTypes);
        const isSlicePtr = objType === "TuffVec*";
        // int64_t vec handles (.length, .init, .capacity)
        const isVecHandle =
          objType === "__tuff_vec_t" || objType === "__tuff_range_result_t";
        if (isSlicePtr) return `${objStr}->${expr.property}`;
        if (isVecHandle) {
          if (expr.property === "length" || expr.property === "init")
            return `__vec_length(${objStr})`;
          if (expr.property === "capacity") return `__vec_capacity(${objStr})`;
        }
        return `${objStr}.${expr.property}`;
      }
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
    case "StringLiteral": {
      // Must produce a valid C string literal (not JSON). JSON.stringify would
      // double-escape actual newlines as \\n.
      const cStr = toCStringLiteral(expr.value ?? "");
      return `((int64_t)(intptr_t)${cStr})`;
    }
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
      if (expr.kind === "IndexExpr") {
        const objStr = emitExpr(expr.target, ctx, localTypes);
        const idxStr = emitExpr(expr.index, ctx, localTypes);
        const targetType =
          expr.target?.kind === "Identifier"
            ? localTypes.get(expr.target.name)
            : inferExprType(expr.target, ctx, localTypes);
        if (targetType === "TuffVec*") return `${objStr}->data[${idxStr}]`;
        // Tuples, arrays, and range results are int64_t vec handles — use __vec_get.
        if (
          targetType === "__tuff_vec_t" ||
          targetType === "__tuff_range_result_t"
        )
          return `__vec_get(${objStr}, ${idxStr})`;
        return `${objStr}[${idxStr}]`;
      }
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
    case "IsExpr": {
      const isTarget = emitExpr(expr.expr, ctx, localTypes);
      const pat = expr.pattern;
      if (pat?.kind === "NamePattern") {
        const alias = ctx.aliasByVariant.get(pat.name);
        if (alias) return `(${isTarget}.__tag == ${alias}_${pat.name})`;
        return `((int64_t)(${isTarget}) != 0)`;
      }
      return "0";
    }
    case "TupleExpr": {
      // Tuples are heap-allocated TuffVec handles.
      const pushes = (expr.elements ?? [])
        .map((e) => `__vec_push(__tv, ${emitExpr(e, ctx, localTypes)}); `)
        .join("");
      return `({ int64_t __tv = __vec_new(); ${pushes}__tv; })`;
    }
    case "ArrayExpr": {
      const pushes = (expr.elements ?? [])
        .map((e) => `__vec_push(__tv, ${emitExpr(e, ctx, localTypes)}); `)
        .join("");
      return `({ int64_t __tv = __vec_new(); ${pushes}__tv; })`;
    }
    case "RangeExpr":
      return `__tuff_range_new(${emitExpr(expr.from, ctx, localTypes)}, ${emitExpr(expr.to, ctx, localTypes)})`;
    case "LambdaExpr":
      // Lambda expressions — not representable in C MVP; emit 0.
      return "0";
    case "IntoExpr":
      return emitExpr(expr.value, ctx, localTypes);
    default:
      unsupported(expr, `${expr.kind} expressions`);
      return "0";
  }
}

function emitStmt(stmt, ctx, localTypes = new Map()) {
  switch (stmt.kind) {
    case "LetDecl": {
      const inferred = inferExprType(stmt.value, ctx, localTypes);
      // Map special vec/range types to int64_t in C declarations.
      const cType =
        inferred === "__tuff_vec_t" ||
        inferred === "__tuff_range_t" ||
        inferred === "__tuff_range_result_t"
          ? "int64_t"
          : inferred;
      localTypes.set(stmt.name, inferred);
      return `${cType} ${toCName(stmt.name)} = ${emitExpr(stmt.value, ctx, localTypes)};`;
    }
    case "TupleDestructure": {
      // let (x, y) = tuple; → int64_t x = __vec_get(tmp, 0); int64_t y = __vec_get(tmp, 1);
      const tmp = nextTemp("tup");
      const valExpr = emitExpr(stmt.value, ctx, localTypes);
      const inferred = inferExprType(stmt.value, ctx, localTypes);
      localTypes.set("__tup_tmp__", inferred);
      const lines = [`int64_t ${tmp} = ${valExpr};`];
      for (let i = 0; i < (stmt.names ?? []).length; i++) {
        const name = stmt.names[i];
        if (!name || name === "_") continue;
        localTypes.set(name, "int64_t");
        lines.push(`int64_t ${toCName(name)} = __vec_get(${tmp}, ${i});`);
      }
      return lines.join(" ");
    }
    case "ExprStmt":
      return `${emitExpr(stmt.expr, ctx, localTypes)};`;
    case "AssignStmt":
      // this.field = val → field = val (direct local variable in C)
      if (
        stmt.target?.kind === "MemberExpr" &&
        stmt.target.object?.kind === "Identifier" &&
        stmt.target.object.name === "this"
      ) {
        return `${toCName(stmt.target.property)} = ${emitExpr(stmt.value, ctx, localTypes)};`;
      }
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
    case "LifetimeStmt":
      return stmt.body?.kind === "Block"
        ? emitBlock(stmt.body, ctx, localTypes)
        : emitStmtOrBlock(stmt.body, ctx, localTypes);
    case "DropStmt": {
      if (stmt.target?.kind !== "Identifier" || !stmt.destructorName) {
        return "/* drop <unsupported target> */";
      }
      const n = toCName(stmt.target.name);
      // TuffVec* slices need data freed first, then the struct (no address-of).
      if (
        localTypes.get(stmt.target.name) === "TuffVec*" &&
        stmt.destructorName === "free"
      ) {
        const tmp = nextTemp("drop_vec");
        return `{ TuffVec* ${tmp} = ${n}; if (${tmp}) { free(${tmp}->data); free(${tmp}); } ${n} = NULL; }`;
      }
      return `${toCName(stmt.destructorName)}(&${n}); ${n} = 0;`;
    }
    case "Block":
      return emitBlock(stmt, ctx, localTypes);
    case "ImportDecl":
      return `/* import placeholder(module=${stmt.modulePath}, names=${stmt.names.join("|")}) */`;
    case "FnDecl": {
      if (!stmt.body) return `/* expect fn ${stmt.name ?? ""} */`;
      // Check if this function returns `this` (method-sugar struct pattern).
      // Check if this function returns a nested function (fnReturner pattern).
      const fnRetInfo = ctx.fnReturners?.get(stmt.name);
      if (fnRetInfo) {
        const { retFnName, typedefName } = fnRetInfo;
        const fnName = toCName(stmt.name);
        const params = (stmt.params ?? [])
          .filter((p) => !p.implicitThis)
          .map((p) => `int64_t ${toCName(p.name)}`)
          .join(", ");
        const rawStmts =
          stmt.body?.kind === "Block" ? (stmt.body.statements ?? []) : [];
        const fnLocals = new Map();
        for (const p of (stmt.params ?? []).filter((p) => !p.implicitThis)) {
          fnLocals.set(p.name, "int64_t");
        }
        // Hoist nested FnDecls; collect other body stmts (skip the return expr)
        const hoisted = rawStmts
          .filter((s) => s.kind === "FnDecl")
          .map((s) => emitStmt(s, ctx, fnLocals))
          .join("\n\n");
        const bodyLines = [];
        for (const s of rawStmts) {
          if (s.kind === "FnDecl") continue; // hoisted
          const isReturnExpr =
            (s.kind === "ExprStmt" &&
              s.expr?.kind === "Identifier" &&
              s.expr?.name === retFnName) ||
            (s.kind === "Identifier" && s.name === retFnName);
          if (isReturnExpr) continue; // handled below
          bodyLines.push(`  ${emitStmt(s, ctx, fnLocals)}`);
        }
        bodyLines.push(`  return (${typedefName})${toCName(retFnName)};`);
        const outerFn = `${typedefName} ${fnName}(${params || "void"}) {\n${bodyLines.join("\n")}\n}`;
        return hoisted ? `${hoisted}\n\n${outerFn}` : outerFn;
      }
      const thisInfo = ctx.thisReturners?.get(stmt.name);
      if (thisInfo) {
        const structName = `__TuffThis_${stmt.name}`;
        const fnName = toCName(stmt.name);
        const params = (stmt.params ?? [])
          .filter((p) => !p.implicitThis)
          .map((p) => `int64_t ${toCName(p.name)}`)
          .join(", ");
        const fnLocals = new Map();
        for (const p of (stmt.params ?? []).filter((p) => !p.implicitThis)) {
          fnLocals.set(p.name, "int64_t");
        }
        // Determine body statements (exclude the trailing `this` expression).
        const rawStmts =
          stmt.body?.kind === "Block" ? (stmt.body.statements ?? []) : [];
        const isThisExpr = (n) =>
          (n?.kind === "ExprStmt" &&
            n.expr?.kind === "Identifier" &&
            n.expr.name === "this") ||
          (n?.kind === "Identifier" && n.name === "this");
        const bodyStmts = isThisExpr(rawStmts[rawStmts.length - 1])
          ? rawStmts.slice(0, -1)
          : rawStmts;
        const bodyLines = [];
        bodyLines.push(`  ${structName} __tuff_this = {0};`);
        for (const p of (stmt.params ?? []).filter((p) => !p.implicitThis)) {
          bodyLines.push(
            `  __tuff_this.${toCName(p.name)} = ${toCName(p.name)};`,
          );
        }
        for (const s of bodyStmts) {
          if (s.kind === "FnDecl") {
            // Nested fn: hoist declaration and set as function pointer field.
            // We emit it separately above the outer fn; here just assign the ptr.
            bodyLines.push(
              `  __tuff_this.${toCName(s.name)} = ${toCName(s.name)};`,
            );
          } else {
            bodyLines.push(`  ${emitStmt(s, ctx, fnLocals)}`);
          }
          if (s.kind === "LetDecl") {
            fnLocals.set(s.name, "int64_t");
            bodyLines.push(
              `  __tuff_this.${toCName(s.name)} = ${toCName(s.name)};`,
            );
          }
        }
        bodyLines.push(`  return __tuff_this;`);
        // Hoist nested FnDecls to file scope (emit them before the outer fn).
        const isNestedThisReturnerFn = (s) => {
          const rt = s.returnType;
          if (
            rt?.kind === "NamedType" &&
            typeof rt.name === "string" &&
            rt.name.startsWith("__this_")
          )
            return true;
          const b = s.body;
          if (b?.kind === "Identifier" && b.name === "this") return true;
          if (b?.kind === "Block") {
            const ss = b.statements ?? [];
            const last = ss[ss.length - 1];
            return (
              (last?.kind === "ExprStmt" &&
                last.expr?.kind === "Identifier" &&
                last.expr.name === "this") ||
              (last?.kind === "Identifier" && last.name === "this")
            );
          }
          return false;
        };
        const hoisted = bodyStmts
          .filter(
            (s) => s.kind === "FnDecl" && !ctx.contextualFnNames?.has(s.name),
          )
          .map((s) => {
            // If nested fn is a known thisReturner, emit it fully via recursive call.
            if (ctx.thisReturners?.has(s.name)) {
              return emitStmt(s, ctx, fnLocals);
            }
            // If nested fn returns `this` but is not registered, emit as stub.
            if (isNestedThisReturnerFn(s)) {
              const np =
                (s.params ?? [])
                  .filter((p) => !p.implicitThis)
                  .map((p) => `int64_t ${toCName(p.name)}`)
                  .join(", ") || "void";
              return `int64_t ${toCName(s.name)}(${np}) { return 0; }`;
            }
            return emitStmt(s, ctx, fnLocals);
          })
          .join("\n\n");
        // Emit contextual nested fns (those that use this.this.X) with outer_ctx param.
        const hoistedFinal = bodyStmts
          .filter(
            (s) => s.kind === "FnDecl" && ctx.contextualFnNames?.has(s.name),
          )
          .map((s) => {
            // Build info about this fn's field entry to get the outer struct type.
            const field = thisInfo.fields.find((f) => f.name === s.name);
            const outerType = field?.needsOuterCtx ?? structName;
            const np = (s.params ?? [])
              .filter((p) => !p.implicitThis)
              .map((p) => `int64_t ${toCName(p.name)}`)
              .join(", ");
            const allParams = np
              ? `struct ${outerType}_s* outer_ctx, ${np}`
              : `struct ${outerType}_s* outer_ctx`;
            const bodyLocals = new Map(fnLocals);
            for (const p of (s.params ?? []).filter((p) => !p.implicitThis)) {
              bodyLocals.set(p.name, "int64_t");
            }
            const body =
              s.body?.kind === "Block"
                ? emitFunctionBlock(s.body, ctx, bodyLocals)
                : `{ return ${emitExpr(s.body, ctx, bodyLocals)}; }`;
            return `int64_t ${toCName(s.name)}(${allParams}) ${body}`;
          })
          .join("\n\n");
        // Merge all hoisted fns (thisReturners/stubs + contextuals).
        const allHoisted = [hoisted, hoistedFinal].filter(Boolean).join("\n\n");
        const outerFn = `${structName} ${fnName}(${params}) {\n${bodyLines.join("\n")}\n}`;
        return allHoisted ? `${allHoisted}\n\n${outerFn}` : outerFn;
      }
      const params = (stmt.params ?? [])
        .filter((p) => !p.implicitThis)
        .map((p) => `${typeToCType(p.type, ctx)} ${toCName(p.name)}`)
        .join(", ");
      const fnName = toCName(stmt.name);
      const returnType = typeToCType(stmt.returnType, ctx);
      const fnLocals = new Map();
      for (const p of stmt.params ?? []) {
        if (!p.implicitThis) {
          fnLocals.set(p.name, typeToCType(p.type, ctx));
        }
      }
      if (stmt.body.kind === "Block") {
        return `${returnType} ${fnName}(${params}) ${emitFunctionBlock(stmt.body, ctx, fnLocals)}`;
      }
      return `${returnType} ${fnName}(${params}) { return ${emitExpr(stmt.body, ctx, fnLocals)}; }`;
    }
    case "ObjectDecl":
      return `/* object ${stmt.name} */`;
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
      // Standard C library functions are already declared via substrate.h includes.
      if (C_STDLIB_BUILTINS.has(stmt.name)) {
        return `/* extern ${stmt.name} — declared via C stdlib headers in substrate.h */`;
      }
      return emitPrototype(
        `extern ${typeToCType(stmt.returnType, ctx)}`,
        stmt.name,
        emitParamList(stmt.params, ctx),
      );
    case "ExternLetDecl":
      return `extern ${typeToCType(stmt.type, ctx)} ${toCName(stmt.name)};`;
    case "ExternImportDecl":
      return `/* extern from ${stmt.source} */`;
    case "ExternTypeDecl":
      return `/* extern type ${stmt.name} */`;
    case "TupleDestructure": {
      const tdValStr = emitExpr(stmt.value, ctx, localTypes);
      const tdTmp = nextTemp("tup");
      const tdType = inferExprType(stmt.value, ctx, localTypes);
      const tdLines = [`${tdType} ${tdTmp} = ${tdValStr};`];
      for (let ti = 0; ti < (stmt.names ?? []).length; ti += 1) {
        const dn = stmt.names[ti];
        localTypes.set(dn, "int64_t");
        tdLines.push(`int64_t ${toCName(dn)} = 0; /* tuple element ${ti} */`);
      }
      return tdLines.join(" ");
    }
    case "TemplateDecl":
      return `/* template ${(stmt as any).param ?? ""} */`;
    case "ClassFunctionDecl":
      return `/* class fn ${(stmt as any).name ?? ""} — not supported in C backend */`;
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
    .filter((p) => !p.implicitThis)
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
  const mainRows = [];
  const fnNodes = [];
  const enumTypeNames = new Set(
    (ast.body ?? []).filter((n) => n.kind === "EnumDecl").map((n) => n.name),
  );
  const aliasTypeNames = new Set(
    (ast.body ?? []).filter((n) => n.kind === "TypeAlias").map((n) => n.name),
  );
  const namedTypes = new Set();

  // Collect extern fn names covered by ExternImportDecl attributions.
  const coveredExternFns = new Set();
  for (const node of ast.body ?? []) {
    if (node.kind === "ExternImportDecl") {
      for (const name of node.names) coveredExternFns.add(name);
    }
  }

  // Validate every extern fn declaration has a source attribution.
  for (const node of ast.body ?? []) {
    if (node.kind === "ExternFnDecl" && !coveredExternFns.has(node.name)) {
      throw new TuffError(
        `extern fn '${node.name}' has no source attribution`,
        node.loc,
        {
          code: "E_EXTERN_NO_SOURCE",
          hint: `Add 'extern let { ${node.name} } = <module>;' before the declaration.`,
        },
      );
    }
  }

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
    "/* Embedded C substrate support */",
    getEmbeddedCSubstrateSupport(),
    "",
    // Tuff runtime helpers for tuples and ranges.
    "static int64_t __tuff_range_new(int64_t start, int64_t end) {",
    "  int64_t r = __vec_new(); __vec_push(r, start); __vec_push(r, end); return r;",
    "}",
    "static int64_t __tuff_range_next(int64_t range) {",
    "  TuffVec* rv = (TuffVec*)tuff_from_val(range);",
    "  if (!rv || rv->init < 2) { int64_t t = __vec_new(); __vec_push(t, 1); __vec_push(t, 0); return t; }",
    "  int64_t cur = rv->data[0], end = rv->data[1];",
    "  if (cur > end) { int64_t t = __vec_new(); __vec_push(t, 1); __vec_push(t, end); return t; }",
    "  rv->data[0] = cur + 1;",
    "  int64_t t = __vec_new(); __vec_push(t, 0); __vec_push(t, cur); return t;",
    "}",
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

  // Emit function pointer typedefs for fn-returning functions.
  for (const [, { typedefName, nestedParamTypes }] of ctx.fnReturners) {
    lines.push(`typedef int64_t (*${typedefName})(${nestedParamTypes});`);
  }
  if (ctx.fnReturners.size > 0) lines.push("");

  // Emit struct typedefs for this-returning functions early (before globals use them).
  // Use topological order so nested struct types are emitted before their parents.
  {
    const emittedStructs = new Set();
    const emitStructTypedef = (fnName) => {
      if (emittedStructs.has(fnName)) return;
      const info = ctx.thisReturners.get(fnName);
      if (!info) return;
      // Emit dependencies first.
      for (const f of info.fields) {
        if (f.fnPtrRetType?.startsWith("__TuffThis_")) {
          const depFn = f.fnPtrRetType.slice("__TuffThis_".length);
          emitStructTypedef(depFn);
        }
      }
      emittedStructs.add(fnName);
      const structName = `__TuffThis_${fnName}`;
      // Check if any fn ptr field references this struct itself (self-referential).
      const selfRefTag = `__TuffThis_${fnName}_s`;
      const isSelfRef = info.fields.some(
        (f) =>
          f.isFnPtr &&
          f.fnPtrParams != null &&
          f.fnPtrParams.includes(structName),
      );
      const fieldDecls = info.fields
        .map((f) => {
          if (!f.isFnPtr) return `int64_t ${toCName(f.name)};`;
          // Replace self-referential type with tagged struct pointer.
          const fp = isSelfRef
            ? f.fnPtrParams.replace(
                new RegExp(structName, "g"),
                `struct ${selfRefTag}`,
              )
            : f.fnPtrParams;
          const retT = f.fnPtrRetType ?? "int64_t";
          return `${retT} (*${toCName(f.name)})(${fp});`;
        })
        .join(" ");
      if (isSelfRef) {
        lines.push(`struct ${selfRefTag};`);
        lines.push(
          `typedef struct ${selfRefTag} { ${fieldDecls} } ${structName};`,
        );
      } else {
        lines.push(`typedef struct { ${fieldDecls} } ${structName};`);
      }
    };
    for (const fnName of ctx.thisReturners.keys()) {
      emitStructTypedef(fnName);
    }
  }
  if (ctx.thisReturners.size > 0) lines.push("");

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
      // If the value is a direct function reference, emit as a function pointer.
      const isFnRef =
        node.value?.kind === "Identifier" &&
        ctx.fnReturnTypeByName.has(node.value.name);
      if (isFnRef) {
        const retType =
          ctx.fnReturnTypeByName.get(node.value.name) ?? "int64_t";
        const fnNode = (ast.body ?? []).find(
          (n) => n.kind === "FnDecl" && n.name === node.value.name,
        );
        const paramTypes = (fnNode?.params ?? [])
          .filter((p) => !p.implicitThis)
          .map(() => "int64_t")
          .join(", ");
        const fnPtrType = `${retType} (*)(${paramTypes || "void"})`;
        topLevelTypes.set(node.name, fnPtrType);
        lines.push(
          `${retType} (*${toCName(node.name)})(${paramTypes || "void"});`,
        );
      } else if (inferred.startsWith("__FnPtr_")) {
        // fn-returning function call — declare as function pointer typedef
        topLevelTypes.set(node.name, inferred);
        lines.push(`${inferred} ${toCName(node.name)};`);
      } else if (
        inferred === "__tuff_vec_t" ||
        inferred === "__tuff_range_t" ||
        inferred === "__tuff_range_result_t"
      ) {
        // Tuples, arrays, ranges all stored as int64_t handles.
        topLevelTypes.set(node.name, inferred);
        lines.push(`int64_t ${toCName(node.name)};`);
      } else {
        topLevelTypes.set(node.name, inferred);
        lines.push(`${inferred} ${toCName(node.name)};`);
      }
      initRows.push(
        `${toCName(node.name)} = ${emitExpr(node.value, ctx, topLevelTypes)};`,
      );
      lines.push("");
      continue;
    }
    // Only truly executable statements go into tuff_main; declarations stay at file level.
    const executableKinds = new Set([
      "ExprStmt",
      "AssignStmt",
      "ReturnStmt",
      "WhileStmt",
      "IfStmt",
      "BreakStmt",
      "ContinueStmt",
      "ForStmt",
      "TupleDestructure",
    ]);
    if (executableKinds.has(node.kind)) {
      mainRows.push(`  ${emitStmt(node, ctx, topLevelTypes)}`);
    } else {
      lines.push(emitStmt(node, ctx, topLevelTypes));
      lines.push("");
    }
  }

  // Also emit any top-level declaration nodes that shouldn't go into mainRows.
  // These are type-level constructs that were previously caught by the catch-all
  // but now need explicit file-level placement since mainRows is for executables.
  // (FnDecl and LetDecl are already handled above; ExprStmt/AssignStmt go to mainRows.)

  for (const node of fnNodes) {
    // Use fnReturnTypeByName which has struct overrides for this-returning fns.
    const returnType =
      ctx.fnReturnTypeByName.get(node.name) ??
      typeToCType(node.returnType, ctx);
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

  const hasDeclaredMain = fnNodes.some((n) => n.name === "main");
  if (!hasDeclaredMain) {
    if (mainRows.length > 0) {
      const bodyRows = mainRows.slice(0, -1);
      const lastRow = mainRows[mainRows.length - 1].trim().replace(/;$/, "");
      lines.push("TuffValue tuff_main(void) {");
      for (const r of bodyRows) lines.push(r);
      lines.push(`  return (TuffValue)(${lastRow});`);
      lines.push("}");
    } else {
      lines.push("TuffValue tuff_main(void) { return 0; }");
    }
    lines.push("");
  }

  lines.push("int main(int argc, char **argv) {");
  lines.push("  tuff_set_argv(argc, argv);");
  lines.push("  tuff_init_globals();");
  lines.push("  return (int)tuff_main();");
  lines.push("}");

  return lines.join("\n");
}
