// @ts-nocheck
import { TuffError } from "./errors.ts";
import { err, ok, type Result } from "./result.ts";

type BorrowcheckResult<T> = Result<T, TuffError>;

const COPY_PRIMITIVES = new Set([
  "I8",
  "I16",
  "I32",
  "I64",
  "I128",
  "U8",
  "U16",
  "U32",
  "U64",
  "U128",
  "USize",
  "ISize",
  "F32",
  "F64",
  "Bool",
  "Char",
]);

function typeNameFromNode(typeNode) {
  if (!typeNode) return "Unknown";
  if (typeof typeNode === "string") return typeNode;
  if (typeNode.kind === "NamedType") return typeNode.name;
  if (typeNode.kind === "RefinementType")
    return typeNameFromNode(typeNode.base);
  if (typeNode.kind === "PointerType") {
    const inner = typeNameFromNode(typeNode.to);
    if (typeNode.move)
      return `*${typeNode.lifetime ? `${typeNode.lifetime} ` : ""}move ${inner}`;
    return typeNode.mutable
      ? `*${typeNode.lifetime ? `${typeNode.lifetime} ` : ""}mut ${inner}`
      : `*${typeNode.lifetime ? `${typeNode.lifetime} ` : ""}${inner}`;
  }
  if (typeNode.kind === "UnionType") {
    return `${typeNameFromNode(typeNode.left)}|${typeNameFromNode(typeNode.right)}`;
  }
  return "Unknown";
}

function hasBuiltinCopySemantics(typeName) {
  if (!typeName || typeName === "Unknown") return false;
  if (typeName.startsWith("*")) return true;
  if (COPY_PRIMITIVES.has(typeName)) return true;
  return typeName === "Vec" || typeName === "Map" || typeName === "Set";
}

function isCopyType(typeName, externTypeNames) {
  if (hasBuiltinCopySemantics(typeName)) return true;
  if (externTypeNames.has(typeName)) return false;
  return false;
}

function isTypeNodeCopyable(typeNode, context, visiting = new Set()) {
  if (!typeNode) return false;

  if (typeof typeNode === "string") {
    if (hasBuiltinCopySemantics(typeNode)) return true;
    if (context.copyTypeNames.has(typeNode)) return true;
    if (context.externTypeNames.has(typeNode)) return false;
    if (context.copyAliasTypeByName.has(typeNode)) {
      if (visiting.has(typeNode)) return false;
      visiting.add(typeNode);
      const ok = isTypeNodeCopyable(
        context.copyAliasTypeByName.get(typeNode),
        context,
        visiting,
      );
      visiting.delete(typeNode);
      return ok;
    }
    return false;
  }

  if (typeNode.kind === "NamedType") {
    const name = typeNode.name;
    if (hasBuiltinCopySemantics(name)) return true;
    if (context.copyTypeNames.has(name)) return true;
    if (context.externTypeNames.has(name)) return false;
    if (context.copyAliasTypeByName.has(name)) {
      if (visiting.has(name)) return false;
      visiting.add(name);
      const ok = isTypeNodeCopyable(
        context.copyAliasTypeByName.get(name),
        context,
        visiting,
      );
      visiting.delete(name);
      return ok;
    }
    return false;
  }

  if (typeNode.kind === "RefinementType") {
    return isTypeNodeCopyable(typeNode.base, context, visiting);
  }

  if (typeNode.kind === "PointerType") {
    return true;
  }

  if (typeNode.kind === "UnionType") {
    return (
      isTypeNodeCopyable(typeNode.left, context, visiting) &&
      isTypeNodeCopyable(typeNode.right, context, visiting)
    );
  }

  if (typeNode.kind === "TupleType") {
    return (typeNode.members ?? []).every((m) =>
      isTypeNodeCopyable(m, context, visiting),
    );
  }

  return false;
}

function isCopyTypeWithRegistry(typeName, externTypeNames, copyTypeNames) {
  if (hasBuiltinCopySemantics(typeName)) return true;
  if (copyTypeNames.has(typeName)) return true;
  if (externTypeNames.has(typeName)) return false;
  return false;
}

function canonicalPlace(expr) {
  if (!expr) return undefined;
  if (expr.kind === "Identifier") {
    return { base: expr.name, path: expr.name };
  }
  if (expr.kind === "MemberExpr") {
    const p = canonicalPlace(expr.object);
    if (!p) return undefined;
    return { base: p.base, path: `${p.path}.${expr.property}` };
  }
  if (expr.kind === "IndexExpr") {
    const p = canonicalPlace(expr.target);
    if (!p) return undefined;
    return { base: p.base, path: `${p.path}[]` };
  }
  return undefined;
}

function placesConflict(a, b) {
  if (!a || !b) return false;
  if (a.base !== b.base) return false;
  if (a.path === b.path) return true;

  if (a.path.includes("[]") || b.path.includes("[]")) {
    const ap = a.path.replaceAll("[]", "");
    const bp = b.path.replaceAll("[]", "");
    return ap.startsWith(bp) || bp.startsWith(ap);
  }

  return a.path.startsWith(`${b.path}.`) || b.path.startsWith(`${a.path}.`);
}

function inferExprTypeName(expr, envTypes, fnReturnTypes) {
  if (!expr) return "Unknown";
  switch (expr.kind) {
    case "NumberLiteral":
      return expr.numberType === "USize" ? "USize" : "I32";
    case "BoolLiteral":
      return "Bool";
    case "CharLiteral":
      return "Char";
    case "StringLiteral":
      return "*Str";
    case "Identifier":
      return envTypes.get(expr.name) ?? "Unknown";
    case "UnaryExpr": {
      const inner = inferExprTypeName(expr.expr, envTypes, fnReturnTypes);
      if (expr.op === "&") return `*${inner}`;
      if (expr.op === "&mut") return `*mut ${inner}`;
      if (expr.op === "!") return "Bool";
      return inner;
    }
    case "BinaryExpr": {
      if (["==", "!=", "<", "<=", ">", ">=", "&&", "||"].includes(expr.op))
        return "Bool";
      return inferExprTypeName(expr.left, envTypes, fnReturnTypes);
    }
    case "CallExpr":
      if (expr.callee?.kind === "Identifier") {
        return fnReturnTypes.get(expr.callee.name) ?? "Unknown";
      }
      return "Unknown";
    case "StructInit":
      return expr.name ?? "Unknown";
    default:
      return "Unknown";
  }
}

function createState() {
  return {
    moved: new Set(),
    dropped: new Set(),
    pendingDrops: new Set(),
    immutLoans: new Map(),
    mutLoans: new Map(),
    loanScopes: [],
    dropScopes: [],
  };
}

function cloneState(state) {
  const out = createState();
  out.moved = new Set(state.moved);
  out.dropped = new Set(state.dropped);
  out.pendingDrops = new Set(state.pendingDrops);
  for (const [k, v] of state.immutLoans.entries()) {
    out.immutLoans.set(k, new Set(v));
  }
  for (const [k, v] of state.mutLoans.entries()) {
    out.mutLoans.set(k, new Set(v));
  }
  out.loanScopes = [];
  return out;
}

function beginLoanScope(state) {
  state.loanScopes.push([]);
  state.dropScopes.push([]);
}

function addLoan(state, kind, place) {
  const target = kind === "mut" ? state.mutLoans : state.immutLoans;
  if (!target.has(place.base)) target.set(place.base, new Set());
  target.get(place.base).add(place.path);
  if (state.loanScopes.length > 0) {
    state.loanScopes[state.loanScopes.length - 1].push({ kind, place });
  }
}

function endLoanScope(state) {
  const added = state.loanScopes.pop() ?? [];
  for (let i = added.length - 1; i >= 0; i -= 1) {
    const { kind, place } = added[i];
    const target = kind === "mut" ? state.mutLoans : state.immutLoans;
    if (!target.has(place.base)) continue;
    const set = target.get(place.base);
    set.delete(place.path);
    if (set.size === 0) target.delete(place.base);
  }
  const droppedHere = state.dropScopes.pop() ?? [];
  for (const name of droppedHere) {
    state.pendingDrops.delete(name);
  }
}

function trackPendingDrop(state, name) {
  state.pendingDrops.add(name);
  if (state.dropScopes.length > 0) {
    state.dropScopes[state.dropScopes.length - 1].push(name);
  }
}

function anyConflictingLoan(state, place) {
  const immut = state.immutLoans.get(place.base) ?? new Set();
  const mut = state.mutLoans.get(place.base) ?? new Set();
  return hasConflictInPaths(place, immut) || hasConflictInPaths(place, mut);
}

function conflictingMutLoan(state, place) {
  const mut = state.mutLoans.get(place.base) ?? new Set();
  return hasConflictInPaths(place, mut);
}

function conflictingImmutLoan(state, place) {
  const immut = state.immutLoans.get(place.base) ?? new Set();
  return hasConflictInPaths(place, immut);
}

function hasConflictInPaths(place, paths) {
  for (const p of paths) {
    if (placesConflict(place, { base: place.base, path: p })) return true;
  }
  return false;
}

function borrowErr(message, loc, code, fix) {
  return err(
    new TuffError(message, loc, {
      code,
      reason:
        "Borrowing and ownership rules require exclusive mutable access or shared immutable access, and disallow use-after-move.",
      fix,
    }),
  );
}

function mergeMovedFromBranches(state, thenState, elseState) {
  if (elseState) {
    state.moved = new Set([...thenState.moved, ...elseState.moved]);
  } else {
    state.moved = new Set([...state.moved, ...thenState.moved]);
  }
}

export function borrowcheck(ast, options = {}): BorrowcheckResult<unknown> {
  const fnReturnTypes = new Map();
  const externTypeNames = new Set();
  const globalTypeByName = new Map();
  const globalFnNames = new Set();
  const copyTypeNames = new Set();
  const copyAliasTypeByName = new Map();
  const destructorAliasByName = new Map();

  for (const node of ast.body ?? []) {
    if (node.kind === "ExternTypeDecl") {
      externTypeNames.add(node.name);
    }
    if (node.kind === "FnDecl" || node.kind === "ExternFnDecl") {
      globalFnNames.add(node.name);
      fnReturnTypes.set(node.name, typeNameFromNode(node.returnType));
    }
    if (node.kind === "LetDecl" || node.kind === "ExternLetDecl") {
      globalTypeByName.set(node.name, typeNameFromNode(node.type));
    }
    if (node.kind === "StructDecl" && node.isCopy === true) {
      copyTypeNames.add(node.name);
    }
    if (node.kind === "EnumDecl") {
      copyTypeNames.add(node.name);
    }
    if (node.kind === "TypeAlias" && node.isCopy === true) {
      copyAliasTypeByName.set(node.name, node.aliasedType);
    }
    if (node.kind === "TypeAlias" && typeof node.destructorName === "string") {
      destructorAliasByName.set(node.name, node.destructorName);
    }
  }

  const hasDestructor = (typeName) => destructorAliasByName.has(typeName);

  for (const [aliasName, aliasType] of copyAliasTypeByName.entries()) {
    const okAlias = isTypeNodeCopyable(
      aliasType,
      { copyTypeNames, copyAliasTypeByName, externTypeNames },
      new Set([aliasName]),
    );
    if (!okAlias) {
      return err(
        new TuffError(
          `copy type ${aliasName} must alias a copy-compatible type`,
          undefined,
          {
            code: "E_BORROW_INVALID_COPY_ALIAS",
            reason:
              "A type alias marked 'copy' resolved to a non-copy type under move semantics.",
            fix: "Only mark aliases as 'copy' when the aliased type is copy-compatible (primitives, pointers, enums, copy structs, or other copy aliases).",
          },
        ),
      );
    }
    copyTypeNames.add(aliasName);
  }

  const checkNotMoved = (place, expr, state, fix): BorrowcheckResult<void> => {
    if (state.dropped.has(place.base)) {
      return borrowErr(
        `Use of dropped value '${place.base}'`,
        expr?.loc,
        "E_BORROW_USE_AFTER_DROP",
        "Do not use a value after explicit or implicit drop; move/copy before dropping if needed.",
      );
    }
    if (!state.moved.has(place.base)) {
      return ok(undefined);
    }
    return borrowErr(
      `Use of moved value '${place.base}'`,
      expr?.loc,
      "E_BORROW_USE_AFTER_MOVE",
      fix,
    );
  };

  const consumePlace = (expr, state, envTypes): BorrowcheckResult<void> => {
    const place = canonicalPlace(expr);
    if (!place) return ok(undefined);

    const movedResult = checkNotMoved(
      place,
      expr,
      state,
      "Reinitialize the value before use, or borrow it with '&' / '&mut' instead of moving.",
    );
    if (!movedResult.ok) return movedResult;

    if (anyConflictingLoan(state, place)) {
      return borrowErr(
        `Cannot move '${place.base}' while it is borrowed`,
        expr?.loc,
        "E_BORROW_MOVE_WHILE_BORROWED",
        "Ensure all borrows end before moving, or pass a borrow (&/&mut) instead.",
      );
    }

    const ty = inferExprTypeName(expr, envTypes, fnReturnTypes);
    if (!isCopyTypeWithRegistry(ty, externTypeNames, copyTypeNames)) {
      // Don't mark the base pointer as moved when indexing through it (slice[i]).
      // The allocation itself isn't consumed; only the individual element is moved.
      if (!place.path.includes("[]")) {
        state.moved.add(place.base);
      }
    }
    return ok(undefined);
  };

  const ensureReadable = (expr, state): BorrowcheckResult<void> => {
    const place = canonicalPlace(expr);
    if (!place) return ok(undefined);
    return checkNotMoved(
      place,
      expr,
      state,
      "Reinitialize the value before use, or borrow it before moving.",
    );
  };

  const checkExpr = (
    expr,
    state,
    envTypes,
    mode = "move",
  ): BorrowcheckResult<void> => {
    if (!expr) return ok(undefined);

    if (
      mode === "move" &&
      expr.kind === "Identifier" &&
      globalFnNames.has(expr.name)
    ) {
      return ok(undefined);
    }

    if (expr.kind === "UnaryExpr" && (expr.op === "&" || expr.op === "&mut")) {
      const place = canonicalPlace(expr.expr);
      if (!place) {
        if (expr.expr?.kind === "StructInit") {
          return checkExpr(expr.expr, state, envTypes, "read");
        }
        return borrowErr(
          `Borrow target is not a place expression`,
          expr?.loc,
          "E_BORROW_INVALID_TARGET",
          "Borrow only identifiers, fields, or index places (e.g. &x, &obj.f, &arr[i]).",
        );
      }

      const readResult = ensureReadable(expr.expr, state);
      if (!readResult.ok) return readResult;

      if (expr.op === "&") {
        if (conflictingMutLoan(state, place)) {
          return borrowErr(
            `Cannot immutably borrow '${place.base}' because it is mutably borrowed`,
            expr?.loc,
            "E_BORROW_IMMUT_WHILE_MUT",
            "End the mutable borrow first, or borrow mutably in a non-overlapping scope.",
          );
        }
        addLoan(state, "immut", place);
      } else {
        if (
          conflictingMutLoan(state, place) ||
          conflictingImmutLoan(state, place)
        ) {
          return borrowErr(
            `Cannot mutably borrow '${place.base}' because it is already borrowed`,
            expr?.loc,
            "E_BORROW_MUT_CONFLICT",
            "Ensure no active borrows overlap this place before taking '&mut'.",
          );
        }
        addLoan(state, "mut", place);
      }
      return ok(undefined);
    }

    switch (expr.kind) {
      case "Identifier":
      case "MemberExpr":
      case "IndexExpr": {
        if (mode === "read") return ensureReadable(expr, state);
        return consumePlace(expr, state, envTypes);
      }
      case "NumberLiteral":
      case "BoolLiteral":
      case "StringLiteral":
      case "CharLiteral":
        return ok(undefined);
      case "UnaryExpr":
        return checkExpr(expr.expr, state, envTypes, "read");
      case "BinaryExpr": {
        const l = checkExpr(expr.left, state, envTypes, "read");
        if (!l.ok) return l;
        return checkExpr(expr.right, state, envTypes, "read");
      }
      case "CallExpr": {
        if (expr.callee?.kind === "Identifier" && expr.callee.name === "drop") {
          const target = expr.args?.[0];
          const place = canonicalPlace(target);
          if (!place) {
            return borrowErr(
              "drop target must be a place expression",
              expr?.loc,
              "E_BORROW_INVALID_TARGET",
              "Call drop with a local/place value such as drop(x) or x.drop().",
            );
          }
          if (state.dropped.has(place.base)) {
            return borrowErr(
              `Double drop of '${place.base}'`,
              expr?.loc,
              "E_BORROW_DOUBLE_DROP",
              "Ensure each owned value is dropped exactly once.",
            );
          }
          const targetType = inferExprTypeName(target, envTypes, fnReturnTypes);
          if (!hasDestructor(targetType)) {
            return borrowErr(
              `Type '${targetType}' has no associated destructor`,
              expr?.loc,
              "E_BORROW_DROP_MISSING_DESTRUCTOR",
              "Associate a destructor via 'type Alias = Base then destructorName;' and use that alias type.",
            );
          }
          const movedResult = checkNotMoved(
            place,
            target,
            state,
            "Only live, non-moved values can be dropped.",
          );
          if (!movedResult.ok) return movedResult;
          state.pendingDrops.delete(place.base);
          state.dropped.add(place.base);
          state.moved.add(place.base);
          return ok(undefined);
        }

        if (
          expr.callStyle === "method-sugar" &&
          expr.callee?.kind === "Identifier" &&
          expr.callee.name === "into"
        ) {
          if ((expr.args?.length ?? 0) >= 1) {
            const receiverMode = canonicalPlace(expr.args[0]) ? "move" : "read";
            const receiverResult = checkExpr(
              expr.args[0],
              state,
              envTypes,
              receiverMode,
            );
            if (!receiverResult.ok) return receiverResult;
          }
          for (const a of (expr.args ?? []).slice(1)) {
            const r = checkExpr(a, state, envTypes, "read");
            if (!r.ok) return r;
          }
          return ok(undefined);
        }

        if (
          !(
            expr.callee?.kind === "Identifier" &&
            globalFnNames.has(expr.callee.name)
          )
        ) {
          const c = checkExpr(expr.callee, state, envTypes, "read");
          if (!c.ok) return c;
        }
        for (const a of expr.args ?? []) {
          const r = checkExpr(a, state, envTypes, "read");
          if (!r.ok) return r;
        }
        return ok(undefined);
      }
      case "StructInit": {
        for (const f of expr.fields ?? []) {
          const r = checkExpr(f.value, state, envTypes, "read");
          if (!r.ok) return r;
        }
        return ok(undefined);
      }
      case "IfExpr": {
        const cond = checkExpr(expr.condition, state, envTypes, "read");
        if (!cond.ok) return cond;

        const thenState = cloneState(state);
        const thenEnv = new Map(envTypes);
        const thenR = checkNode(expr.thenBranch, thenState, thenEnv);
        if (!thenR.ok) return thenR;

        if (expr.elseBranch) {
          const elseState = cloneState(state);
          const elseEnv = new Map(envTypes);
          const elseR = checkNode(expr.elseBranch, elseState, elseEnv);
          if (!elseR.ok) return elseR;
          mergeMovedFromBranches(state, thenState, elseState);
        } else {
          mergeMovedFromBranches(state, thenState);
        }
        return ok(undefined);
      }
      case "MatchExpr": {
        const target = checkExpr(expr.target, state, envTypes, "read");
        if (!target.ok) return target;
        const movedUnion = new Set(state.moved);
        for (const c of expr.cases ?? []) {
          const branchState = cloneState(state);
          const branchEnv = new Map(envTypes);
          const r = checkNode(c.body, branchState, branchEnv);
          if (!r.ok) return r;
          for (const m of branchState.moved) movedUnion.add(m);
        }
        state.moved = movedUnion;
        return ok(undefined);
      }
      case "IsExpr":
        return checkExpr(expr.expr, state, envTypes, "read");
      case "UnwrapExpr":
        return checkExpr(expr.expr, state, envTypes, "read");
      case "IntoExpr": {
        const valueMode = canonicalPlace(expr.value) ? "move" : "read";
        const valueResult = checkExpr(expr.value, state, envTypes, valueMode);
        if (!valueResult.ok) return valueResult;
        for (const a of expr.args ?? []) {
          const argResult = checkExpr(a, state, envTypes, "read");
          if (!argResult.ok) return argResult;
        }
        return ok(undefined);
      }
      case "IntoValueExpr": {
        const valueMode = canonicalPlace(expr.value) ? "move" : "read";
        const valueResult = checkExpr(expr.value, state, envTypes, valueMode);
        if (!valueResult.ok) return valueResult;
        return ok(undefined);
      }
      default:
        return ok(undefined);
    }
  };

  const checkStmt = (stmt, state, envTypes): BorrowcheckResult<void> => {
    if (!stmt) return ok(undefined);
    switch (stmt.kind) {
      case "LetDecl": {
        if (!stmt.value) {
          const ty = stmt.type ? typeNameFromNode(stmt.type) : "Unknown";
          envTypes.set(stmt.name, ty);
          state.moved.delete(stmt.name);
          return ok(undefined);
        }
        const valueMode = canonicalPlace(stmt.value) ? "move" : "read";
        const valueResult = checkExpr(stmt.value, state, envTypes, valueMode);
        if (!valueResult.ok) return valueResult;
        const ty = stmt.type
          ? typeNameFromNode(stmt.type)
          : inferExprTypeName(stmt.value, envTypes, fnReturnTypes);
        envTypes.set(stmt.name, ty);
        state.moved.delete(stmt.name);
        state.dropped.delete(stmt.name);
        if (hasDestructor(ty)) {
          trackPendingDrop(state, stmt.name);
        }
        return ok(undefined);
      }
      case "AssignStmt": {
        if (stmt.target?.kind === "Identifier") {
          const targetName = stmt.target.name;
          const targetTy = envTypes.get(targetName) ?? "Unknown";
          if (hasDestructor(targetTy) && state.pendingDrops.has(targetName)) {
            state.pendingDrops.delete(targetName);
            state.dropped.add(targetName);
          }
        }
        const targetPlace = canonicalPlace(stmt.target);
        if (targetPlace) {
          if (anyConflictingLoan(state, targetPlace)) {
            return borrowErr(
              `Cannot assign to '${targetPlace.base}' while it is borrowed`,
              stmt?.loc ?? stmt.target?.loc,
              "E_BORROW_ASSIGN_WHILE_BORROWED",
              "End active borrows before assignment, or assign in a non-overlapping scope.",
            );
          }
        }
        const rhsMode = canonicalPlace(stmt.value) ? "move" : "read";
        const rhsResult = checkExpr(stmt.value, state, envTypes, rhsMode);
        if (!rhsResult.ok) return rhsResult;
        if (stmt.target?.kind === "Identifier") {
          state.moved.delete(stmt.target.name);
          state.dropped.delete(stmt.target.name);
          const assignedTy = envTypes.get(stmt.target.name) ?? "Unknown";
          if (hasDestructor(assignedTy)) {
            trackPendingDrop(state, stmt.target.name);
          }
        }
        return ok(undefined);
      }
      case "ExprStmt":
        return checkExpr(stmt.expr, state, envTypes, "move");
      case "ReturnStmt":
        return stmt.value
          ? checkExpr(
              stmt.value,
              state,
              envTypes,
              canonicalPlace(stmt.value) ? "move" : "read",
            )
          : ok(undefined);
      case "IfStmt": {
        const cond = checkExpr(stmt.condition, state, envTypes, "read");
        if (!cond.ok) return cond;

        const thenState = cloneState(state);
        const thenEnv = new Map(envTypes);
        const thenRes = checkNode(stmt.thenBranch, thenState, thenEnv);
        if (!thenRes.ok) return thenRes;

        if (stmt.elseBranch) {
          const elseState = cloneState(state);
          const elseEnv = new Map(envTypes);
          const elseRes = checkNode(stmt.elseBranch, elseState, elseEnv);
          if (!elseRes.ok) return elseRes;
          mergeMovedFromBranches(state, thenState, elseState);
        } else {
          mergeMovedFromBranches(state, thenState);
        }
        return ok(undefined);
      }
      case "ForStmt": {
        const start = checkExpr(stmt.start, state, envTypes, "read");
        if (!start.ok) return start;
        const end = checkExpr(stmt.end, state, envTypes, "read");
        if (!end.ok) return end;
        beginLoanScope(state);
        const loopEnv = new Map(envTypes);
        loopEnv.set(stmt.iterator, "I32");
        const body = checkNode(stmt.body, state, loopEnv);
        endLoanScope(state);
        return body;
      }
      case "LoopStmt": {
        beginLoanScope(state);
        const body = checkNode(stmt.body, state, new Map(envTypes));
        endLoanScope(state);
        return body;
      }
      case "WhileStmt": {
        const cond = checkExpr(stmt.condition, state, envTypes, "read");
        if (!cond.ok) return cond;
        beginLoanScope(state);
        const body = checkNode(stmt.body, state, new Map(envTypes));
        endLoanScope(state);
        return body;
      }
      case "Block":
        return checkBlock(stmt, state, envTypes);
      case "LifetimeStmt": {
        return checkNode(stmt.body, state, new Map(envTypes));
      }
      case "FnDecl": {
        const fnState = createState();
        const fnEnv = new Map(globalTypeByName);
        for (const p of stmt.params ?? []) {
          fnEnv.set(p.name, typeNameFromNode(p.type));
        }
        if (stmt.body?.kind === "Block") {
          return checkBlock(stmt.body, fnState, fnEnv);
        }
        return checkExpr(stmt.body, fnState, fnEnv, "move");
      }
      case "ContractDecl":
      case "IntoStmt":
        return ok(undefined);
      case "TypeAlias": {
        // Register local destructor aliases (e.g. defined inside function bodies)
        if (
          typeof stmt.destructorName === "string" &&
          stmt.destructorName.length > 0
        ) {
          destructorAliasByName.set(stmt.name, stmt.destructorName);
        }
        return ok(undefined);
      }
      case "DropStmt": {
        return checkExpr(
          {
            kind: "CallExpr",
            callee: { kind: "Identifier", name: "drop" },
            args: [stmt.target],
          },
          state,
          envTypes,
          "read",
        );
      }
      default:
        return ok(undefined);
    }
  };

  const checkBlock = (block, state, envTypes): BorrowcheckResult<void> => {
    beginLoanScope(state);
    const blockEnv = new Map(envTypes);
    for (const s of block.statements ?? []) {
      const r = checkStmt(s, state, blockEnv);
      if (!r.ok) {
        endLoanScope(state);
        return r;
      }
    }
    endLoanScope(state);
    return ok(undefined);
  };

  const checkNode = (node, state, envTypes): BorrowcheckResult<void> => {
    if (!node) return ok(undefined);
    if (node.kind === "Block") return checkBlock(node, state, envTypes);
    if (
      node.kind === "NumberLiteral" ||
      node.kind === "BoolLiteral" ||
      node.kind === "StringLiteral" ||
      node.kind === "CharLiteral" ||
      node.kind === "Identifier" ||
      node.kind === "UnaryExpr" ||
      node.kind === "BinaryExpr" ||
      node.kind === "CallExpr" ||
      node.kind === "MemberExpr" ||
      node.kind === "IndexExpr" ||
      node.kind === "StructInit" ||
      node.kind === "IfExpr" ||
      node.kind === "MatchExpr" ||
      node.kind === "IsExpr" ||
      node.kind === "UnwrapExpr" ||
      node.kind === "IntoExpr" ||
      node.kind === "IntoValueExpr"
    ) {
      return checkExpr(node, state, envTypes, "move");
    }
    return checkStmt(node, state, envTypes);
  };

  const state = createState();
  const env = new Map(globalTypeByName);

  for (const node of ast.body ?? []) {
    const r = checkStmt(node, state, env);
    if (!r.ok) return r;
  }

  return ok(ast);
}
