import { TuffError } from "./errors.js";

class Scope {
  constructor(parent = null) {
    this.parent = parent;
    this.bindings = new Map();
  }

  define(name, loc = null) {
    if (this.bindings.has(name)) {
      throw new TuffError(
        `Variable shadowing/redeclaration is not allowed: ${name}`,
        loc,
        {
          code: "E_RESOLVE_SHADOWING",
          hint: "Rename one of the variables; shadowing is disallowed in Tuff.",
        },
      );
    }
    this.bindings.set(name, true);
  }

  has(name) {
    if (this.bindings.has(name)) return true;
    return this.parent ? this.parent.has(name) : false;
  }
}

export function resolveNames(ast, options = {}) {
  const hostBuiltins = new Set(options.hostBuiltins ?? []);
  const allowHostPrefix = options.allowHostPrefix ?? "";

  const isHostBuiltin = (name) => {
    if (hostBuiltins.has(name)) return true;
    if (allowHostPrefix && name.startsWith(allowHostPrefix)) return true;
    return false;
  };

  const globals = new Scope();
  for (const node of ast.body) {
    if (
      [
        "FnDecl",
        "StructDecl",
        "TypeAlias",
        "ExternFnDecl",
        "ExternLetDecl",
        "ExternTypeDecl",
      ].includes(node.kind)
    ) {
      globals.define(node.name);
    }
  }

  const visitExpr = (expr, scope) => {
    if (!expr) return;
    switch (expr.kind) {
      case "Identifier":
        if (
          !scope.has(expr.name) &&
          !globals.has(expr.name) &&
          !isHostBuiltin(expr.name)
        ) {
          throw new TuffError(`Unknown identifier '${expr.name}'`, null, {
            code: "E_RESOLVE_UNKNOWN_IDENTIFIER",
            hint: "Declare the identifier in scope or import it from a module.",
          });
        }
        break;
      case "BinaryExpr":
        visitExpr(expr.left, scope);
        visitExpr(expr.right, scope);
        break;
      case "UnaryExpr":
      case "UnwrapExpr":
        visitExpr(expr.expr, scope);
        break;
      case "CallExpr":
        visitExpr(expr.callee, scope);
        expr.args.forEach((a) => visitExpr(a, scope));
        break;
      case "MemberExpr":
        visitExpr(expr.object, scope);
        break;
      case "IndexExpr":
        visitExpr(expr.target, scope);
        visitExpr(expr.index, scope);
        break;
      case "StructInit":
        if (!globals.has(expr.name)) {
          throw new TuffError(
            `Unknown struct/type '${expr.name}' in initializer`,
            null,
            {
              code: "E_RESOLVE_UNKNOWN_STRUCT",
              hint: "Declare the struct before using it or import the correct module.",
            },
          );
        }
        expr.fields.forEach((f) => visitExpr(f.value, scope));
        break;
      case "IfExpr":
        visitExpr(expr.condition, scope);
        visitNode(expr.thenBranch, new Scope(scope));
        if (expr.elseBranch) visitNode(expr.elseBranch, new Scope(scope));
        break;
      case "MatchExpr":
        visitExpr(expr.target, scope);
        for (const c of expr.cases) {
          const matchScope = new Scope(scope);
          if (c.pattern.kind === "StructPattern") {
            for (const field of c.pattern.fields) matchScope.define(field.bind);
          } else if (c.pattern.kind === "NamePattern") {
            if (!globals.has(c.pattern.name)) {
              matchScope.define(c.pattern.name);
            }
          }
          visitNode(c.body, matchScope);
        }
        break;
      case "IsExpr":
        visitExpr(expr.expr, scope);
        break;
      default:
        break;
    }
  };

  const visitNode = (node, scope) => {
    if (!node) return;
    switch (node.kind) {
      case "Program":
        node.body.forEach((n) => visitNode(n, scope));
        break;
      case "Block": {
        const blockScope = new Scope(scope);
        for (const s of node.statements) visitNode(s, blockScope);
        break;
      }
      case "FnDecl": {
        const fnScope = new Scope(scope);
        node.params.forEach((p) => fnScope.define(p.name));
        visitNode(node.body, fnScope);
        break;
      }
      case "LetDecl":
        visitExpr(node.value, scope);
        scope.define(node.name, node.loc);
        break;
      case "ImportDecl":
        node.names.forEach((n) => scope.define(n));
        break;
      case "ExprStmt":
        visitExpr(node.expr, scope);
        break;
      case "AssignStmt":
        visitExpr(node.target, scope);
        visitExpr(node.value, scope);
        break;
      case "ReturnStmt":
        visitExpr(node.value, scope);
        break;
      case "IfStmt":
        visitExpr(node.condition, scope);
        visitNode(node.thenBranch, new Scope(scope));
        if (node.elseBranch) visitNode(node.elseBranch, new Scope(scope));
        break;
      case "ForStmt": {
        const forScope = new Scope(scope);
        forScope.define(node.iterator);
        visitExpr(node.start, forScope);
        visitExpr(node.end, forScope);
        visitNode(node.body, forScope);
        break;
      }
      case "WhileStmt":
        visitExpr(node.condition, scope);
        visitNode(node.body, new Scope(scope));
        break;
      default:
        break;
    }
  };

  visitNode(ast, globals);
  return ast;
}
