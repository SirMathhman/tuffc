// @ts-nocheck
import { TuffError, raise } from "./errors.ts";

class Scope {
  constructor(parent = null) {
    this.parent = parent;
    this.bindings = new Map();
  }

  define(name, loc = null) {
    if (this.bindings.has(name)) {
      return raise(
        new TuffError(
          `Variable shadowing/redeclaration is not allowed: ${name}`,
          loc,
          {
            code: "E_RESOLVE_SHADOWING",
            hint: "Rename one of the variables; shadowing is disallowed in Tuff.",
          },
        ),
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
  const strictModuleImports = options.strictModuleImports ?? false;
  const moduleImportsByPath =
    options.moduleImportsByPath instanceof Map
      ? options.moduleImportsByPath
      : new Map();
  const globalDeclModuleByName = new Map();
  const globalDeclKindByName = new Map();
  const exportedGlobalNames = new Set();
  const externGlobalNames = new Set();

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
        "EnumDecl",
        "TypeAlias",
        "ExternFnDecl",
        "ExternLetDecl",
        "ExternTypeDecl",
        "LetDecl",
      ].includes(node.kind)
    ) {
      globals.define(node.name);
      if (!globalDeclKindByName.has(node.name)) {
        globalDeclKindByName.set(node.name, node.kind);
      }
      if (node.exported === true) {
        exportedGlobalNames.add(node.name);
      }
      if (
        node.kind === "ExternFnDecl" ||
        node.kind === "ExternLetDecl" ||
        node.kind === "ExternTypeDecl"
      ) {
        externGlobalNames.add(node.name);
      }
      if (!globalDeclModuleByName.has(node.name)) {
        globalDeclModuleByName.set(node.name, node.__modulePath ?? null);
      }
    }
  }

  const hasNonGlobalBinding = (scope, name) => {
    let cursor = scope;
    while (cursor && cursor !== globals) {
      if (cursor.bindings.has(name)) return true;
      cursor = cursor.parent;
    }
    return false;
  };

  const visitExpr = (expr, scope, currentModulePath = null) => {
    if (!expr) return;
    switch (expr.kind) {
      case "Identifier":
        if (hasNonGlobalBinding(scope, expr.name) || isHostBuiltin(expr.name)) {
          break;
        }

        if (globals.has(expr.name)) {
          if (strictModuleImports && currentModulePath) {
            if (externGlobalNames.has(expr.name)) {
              break;
            }
            if ((globalDeclKindByName.get(expr.name) ?? "") === "LetDecl") {
              break;
            }
            if (!exportedGlobalNames.has(expr.name)) {
              break;
            }
            const declModulePath =
              globalDeclModuleByName.get(expr.name) ?? null;
            if (declModulePath && declModulePath !== currentModulePath) {
              const imported = moduleImportsByPath.get(currentModulePath);
              if (!(imported instanceof Set) || !imported.has(expr.name)) {
                return raise(
                  new TuffError(
                    `Implicit cross-module reference '${expr.name}' is not allowed`,
                    expr.loc ?? null,
                    {
                      code: "E_MODULE_IMPLICIT_IMPORT",
                      hint: `Add 'let { ${expr.name} } = ...;' in this module to import it explicitly.`,
                    },
                  ),
                );
              }
            }
          }
          break;
        }

        {
          return raise(
            new TuffError(`Unknown identifier '${expr.name}'`, null, {
              code: "E_RESOLVE_UNKNOWN_IDENTIFIER",
              hint: "Declare the identifier in scope or import it from a module.",
            }),
          );
        }
      case "BinaryExpr":
        visitExpr(expr.left, scope, currentModulePath);
        visitExpr(expr.right, scope, currentModulePath);
        break;
      case "UnaryExpr":
      case "UnwrapExpr":
        visitExpr(expr.expr, scope, currentModulePath);
        break;
      case "CallExpr":
        visitExpr(expr.callee, scope, currentModulePath);
        expr.args.forEach((a) => visitExpr(a, scope, currentModulePath));
        break;
      case "MemberExpr":
        visitExpr(expr.object, scope, currentModulePath);
        break;
      case "IndexExpr":
        visitExpr(expr.target, scope, currentModulePath);
        visitExpr(expr.index, scope, currentModulePath);
        break;
      case "StructInit":
        if (!globals.has(expr.name)) {
          return raise(
            new TuffError(
              `Unknown struct/type '${expr.name}' in initializer`,
              null,
              {
                code: "E_RESOLVE_UNKNOWN_STRUCT",
                hint: "Declare the struct before using it or import the correct module.",
              },
            ),
          );
        }
        expr.fields.forEach((f) =>
          visitExpr(f.value, scope, currentModulePath),
        );
        break;
      case "IfExpr":
        visitExpr(expr.condition, scope, currentModulePath);
        visitNode(expr.thenBranch, new Scope(scope), currentModulePath);
        if (expr.elseBranch)
          visitNode(expr.elseBranch, new Scope(scope), currentModulePath);
        break;
      case "MatchExpr":
        visitExpr(expr.target, scope, currentModulePath);
        for (const c of expr.cases) {
          const matchScope = new Scope(scope);
          if (c.pattern.kind === "StructPattern") {
            for (const field of c.pattern.fields) matchScope.define(field.bind);
          } else if (c.pattern.kind === "NamePattern") {
            if (!globals.has(c.pattern.name)) {
              matchScope.define(c.pattern.name);
            }
          }
          visitNode(c.body, matchScope, currentModulePath);
        }
        break;
      case "IsExpr":
        visitExpr(expr.expr, scope, currentModulePath);
        break;
      default:
        break;
    }
  };

  const visitNode = (node, scope, currentModulePath = null) => {
    if (!node) return;
    const modulePath = node.__modulePath ?? currentModulePath;
    switch (node.kind) {
      case "Program":
        node.body.forEach((n) => visitNode(n, scope, modulePath));
        break;
      case "Block": {
        const blockScope = new Scope(scope);
        for (const s of node.statements) visitNode(s, blockScope, modulePath);
        break;
      }
      case "FnDecl": {
        const fnScope = new Scope(scope);
        node.params.forEach((p) => fnScope.define(p.name));
        if (node.body?.kind === "Block") {
          visitNode(node.body, fnScope, modulePath);
        } else {
          visitExpr(node.body, fnScope, modulePath);
        }
        break;
      }
      case "LetDecl":
        visitExpr(node.value, scope, modulePath);
        if (!(scope === globals && globals.bindings.has(node.name))) {
          scope.define(node.name, node.loc);
        }
        break;
      case "ImportDecl":
        node.names.forEach((n) => scope.define(n));
        break;
      case "ExprStmt":
        visitExpr(node.expr, scope, modulePath);
        break;
      case "AssignStmt":
        visitExpr(node.target, scope, modulePath);
        visitExpr(node.value, scope, modulePath);
        break;
      case "ReturnStmt":
        visitExpr(node.value, scope, modulePath);
        break;
      case "IfStmt":
        visitExpr(node.condition, scope, modulePath);
        visitNode(node.thenBranch, new Scope(scope), modulePath);
        if (node.elseBranch)
          visitNode(node.elseBranch, new Scope(scope), modulePath);
        break;
      case "ForStmt": {
        const forScope = new Scope(scope);
        forScope.define(node.iterator);
        visitExpr(node.start, forScope, modulePath);
        visitExpr(node.end, forScope, modulePath);
        visitNode(node.body, forScope, modulePath);
        break;
      }
      case "WhileStmt":
        visitExpr(node.condition, scope, modulePath);
        visitNode(node.body, new Scope(scope), modulePath);
        break;
      default:
        break;
    }
  };

  visitNode(ast, globals);
  return ast;
}
