import { TuffError } from "./errors.js";

const PRIMITIVES = new Set([
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
  "*Str",
  "Void",
  "Char",
]);

const NUMERIC = new Set([
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
]);

function named(type) {
  if (!type) return null;
  if (typeof type === "string") return type;
  if (type.kind === "NamedType") return type.name;
  if (type.kind === "UnionType")
    return `${named(type.left)}|${named(type.right)}`;
  if (type.kind === "ArrayType") return "Array";
  if (type.kind === "PointerType") return "Pointer";
  if (type.kind === "TupleType") return "Tuple";
  return null;
}

export function typecheck(ast) {
  const structs = new Map();
  const functions = new Map();
  const typeAliases = new Map();

  for (const node of ast.body) {
    if (node.kind === "StructDecl") {
      structs.set(node.name, node);
    } else if (node.kind === "FnDecl") {
      functions.set(node.name, node);
    } else if (node.kind === "TypeAlias") {
      typeAliases.set(node.name, node.aliasedType);
    }
  }

  const inferExpr = (expr, scope) => {
    switch (expr.kind) {
      case "NumberLiteral":
        return "I32";
      case "BoolLiteral":
        return "Bool";
      case "StringLiteral":
        return "*Str";
      case "CharLiteral":
        return "Char";
      case "Identifier": {
        if (scope.has(expr.name)) return scope.get(expr.name);
        if (functions.has(expr.name)) return "Fn";
        if (structs.has(expr.name)) return expr.name;
        return "Unknown";
      }
      case "StructInit": {
        const s = structs.get(expr.name);
        if (!s) throw new TuffError(`Unknown struct '${expr.name}'`);
        const fieldMap = new Map(s.fields.map((f) => [f.name, f]));
        for (const f of expr.fields) {
          if (!fieldMap.has(f.key))
            throw new TuffError(
              `Unknown field '${f.key}' for struct ${expr.name}`,
            );
          inferExpr(f.value, scope);
        }
        return expr.name;
      }
      case "UnaryExpr": {
        const t = inferExpr(expr.expr, scope);
        if (expr.op === "!" && t !== "Bool")
          throw new TuffError("'!' expects Bool");
        if (expr.op === "-" && !NUMERIC.has(t))
          throw new TuffError("Unary '-' expects numeric type");
        return t;
      }
      case "BinaryExpr": {
        const l = inferExpr(expr.left, scope);
        const r = inferExpr(expr.right, scope);
        if (["+", "-", "*", "/", "%"].includes(expr.op)) {
          if (!NUMERIC.has(l) || !NUMERIC.has(r))
            throw new TuffError(`Operator ${expr.op} expects numeric operands`);
          return l;
        }
        if (["==", "!=", "<", "<=", ">", ">="].includes(expr.op)) return "Bool";
        if (["&&", "||"].includes(expr.op)) {
          if (l !== "Bool" || r !== "Bool")
            throw new TuffError(`Operator ${expr.op} expects Bool operands`);
          return "Bool";
        }
        return "Unknown";
      }
      case "CallExpr": {
        if (expr.callee.kind === "Identifier") {
          const fn = functions.get(expr.callee.name);
          if (fn) {
            if (expr.args.length !== fn.params.length) {
              throw new TuffError(
                `Function ${fn.name} expects ${fn.params.length} args, got ${expr.args.length}`,
              );
            }
            for (let idx = 0; idx < expr.args.length; idx++) {
              const argType = inferExpr(expr.args[idx], scope);
              const expected = named(fn.params[idx].type) ?? argType;
              if (
                expected &&
                argType !== "Unknown" &&
                expected !== argType &&
                !typeAliases.has(expected)
              ) {
                throw new TuffError(
                  `Type mismatch in call to ${fn.name} arg ${idx + 1}: expected ${expected}, got ${argType}`,
                );
              }
            }
            return named(fn.returnType) ?? "Unknown";
          }
        }
        expr.args.forEach((a) => inferExpr(a, scope));
        return "Unknown";
      }
      case "MemberExpr":
        inferExpr(expr.object, scope);
        return "Unknown";
      case "IndexExpr":
        inferExpr(expr.target, scope);
        inferExpr(expr.index, scope);
        return "Unknown";
      case "IfExpr": {
        const cond = inferExpr(expr.condition, scope);
        if (cond !== "Bool") throw new TuffError("if condition must be Bool");
        const a = inferNode(expr.thenBranch, new Map(scope));
        const b = expr.elseBranch
          ? inferNode(expr.elseBranch, new Map(scope))
          : a;
        return a === b ? a : "Unknown";
      }
      case "MatchExpr":
        inferExpr(expr.target, scope);
        for (const c of expr.cases) inferNode(c.body, new Map(scope));
        return "Unknown";
      case "IsExpr":
        inferExpr(expr.expr, scope);
        return "Bool";
      case "UnwrapExpr":
        return inferExpr(expr.expr, scope);
      default:
        return "Unknown";
    }
  };

  const inferNode = (node, scope) => {
    switch (node.kind) {
      case "Block": {
        let last = "Void";
        const local = new Map(scope);
        for (const s of node.statements) last = inferNode(s, local);
        return last;
      }
      case "LetDecl": {
        const valueType = inferExpr(node.value, scope);
        const expected = named(node.type);
        if (
          expected &&
          valueType !== "Unknown" &&
          expected !== valueType &&
          !typeAliases.has(expected)
        ) {
          throw new TuffError(
            `Type mismatch for let ${node.name}: expected ${expected}, got ${valueType}`,
          );
        }
        scope.set(node.name, expected ?? valueType);
        return "Void";
      }
      case "AssignStmt": {
        const value = inferExpr(node.value, scope);
        if (node.target.kind === "Identifier") {
          const t = scope.get(node.target.name);
          if (t && value !== "Unknown" && t !== value)
            throw new TuffError(
              `Assignment mismatch for ${node.target.name}: expected ${t}, got ${value}`,
            );
        }
        return "Void";
      }
      case "ExprStmt":
        return inferExpr(node.expr, scope);
      case "ReturnStmt":
        return node.value ? inferExpr(node.value, scope) : "Void";
      case "IfStmt": {
        const cond = inferExpr(node.condition, scope);
        if (cond !== "Bool") throw new TuffError("if condition must be Bool");
        inferNode(node.thenBranch, new Map(scope));
        if (node.elseBranch) inferNode(node.elseBranch, new Map(scope));
        return "Void";
      }
      case "ForStmt":
        scope.set(node.iterator, "I32");
        inferExpr(node.start, scope);
        inferExpr(node.end, scope);
        inferNode(node.body, new Map(scope));
        return "Void";
      case "WhileStmt":
        inferExpr(node.condition, scope);
        inferNode(node.body, new Map(scope));
        return "Void";
      case "FnDecl": {
        const fnScope = new Map();
        for (const p of node.params) {
          fnScope.set(p.name, named(p.type) ?? "Unknown");
        }
        const bodyType = inferNode(node.body, fnScope);
        const expected = named(node.returnType);
        if (
          expected &&
          bodyType !== "Unknown" &&
          bodyType !== "Void" &&
          bodyType !== expected
        ) {
          throw new TuffError(
            `Function ${node.name} return type mismatch: expected ${expected}, got ${bodyType}`,
          );
        }
        return "Void";
      }
      default:
        return "Void";
    }
  };

  for (const name of [
    ...functions.keys(),
    ...structs.keys(),
    ...typeAliases.keys(),
  ]) {
    if (!PRIMITIVES.has(name) && PRIMITIVES.has(name)) {
      throw new TuffError(`Name ${name} conflicts with primitive type`);
    }
  }

  for (const node of ast.body) {
    inferNode(node, new Map());
  }

  return ast;
}
