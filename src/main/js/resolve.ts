// @ts-nocheck
import { TuffError } from "./errors.ts";
import { err, ok, type Result } from "./result.ts";

type ResolveResult<T> = Result<T, TuffError>;

class Scope {
  parent: Scope | undefined;
  bindings: Map<string, boolean>;

  constructor(parent: Scope | undefined = undefined) {
    this.parent = parent;
    this.bindings = new Map();
  }

  define(name: string, loc: unknown = undefined): ResolveResult<true> {
    if (this.bindings.has(name)) {
      return err(
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
    return ok(true);
  }

  has(name: string): boolean {
    if (this.bindings.has(name)) return true;
    return this.parent ? this.parent.has(name) : false;
  }
}

export function resolveNames(
  ast: { body: unknown[] },
  options: Record<string, unknown> = {},
): ResolveResult<{ body: unknown[] }> {
  const signatureKey = (node) =>
    JSON.stringify({
      generics: node.generics ?? [],
      params: (node.params ?? []).map((p) => ({ name: p.name, type: p.type })),
      returnType: node.returnType ?? undefined,
    });

  const expectFnsByName = new Map();
  const actualFnsByName = new Map();
  for (const node of ast.body) {
    if (node.kind !== "FnDecl") continue;
    if (node.expectDecl === true) {
      const group = expectFnsByName.get(node.name) ?? [];
      group.push(node);
      expectFnsByName.set(node.name, group);
    }
    if (node.actualDecl === true) {
      const group = actualFnsByName.get(node.name) ?? [];
      group.push(node);
      actualFnsByName.set(node.name, group);
    }
  }

  const pairedNames = new Set([
    ...expectFnsByName.keys(),
    ...actualFnsByName.keys(),
  ]);
  for (const name of pairedNames) {
    const expectFns = expectFnsByName.get(name) ?? [];
    const actualFns = actualFnsByName.get(name) ?? [];
    if (expectFns.length !== 1 || actualFns.length !== 1) {
      return err(
        new TuffError(
          `expect/actual pairing requires exactly one expect and one actual for '${name}'`,
          undefined,
          {
            code: "E_EXPECT_ACTUAL_PAIRING",
            hint: "Declare exactly one 'expect fn' and one matching 'actual fn' for each platform declaration.",
          },
        ),
      );
    }
    if (signatureKey(expectFns[0]) !== signatureKey(actualFns[0])) {
      return err(
        new TuffError(
          `expect/actual signatures do not match for '${name}'`,
          undefined,
          {
            code: "E_EXPECT_ACTUAL_SIGNATURE_MISMATCH",
            hint: "Make generic params, parameter list, and return type identical between expect and actual declarations.",
          },
        ),
      );
    }
  }

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
  const contractNames = new Set();

  const isHostBuiltin = (name) => {
    if (hostBuiltins.has(name)) return true;
    if (allowHostPrefix && name.startsWith(allowHostPrefix)) return true;
    return false;
  };

  const globals = new Scope();
  const valueDeclKinds = new Set([
    "FnDecl",
    "ClassFunctionDecl",
    "ExternFnDecl",
    "ExternLetDecl",
    "LetDecl",
  ]);
  const typeDeclKinds = new Set([
    "StructDecl",
    "EnumDecl",
    "ObjectDecl",
    "ContractDecl",
    "TypeAlias",
    "ExternTypeDecl",
  ]);

  const canCoexistGlobalName = (existingKind, nextKind) => {
    const existingIsValue = valueDeclKinds.has(existingKind);
    const existingIsType = typeDeclKinds.has(existingKind);
    const nextIsValue = valueDeclKinds.has(nextKind);
    const nextIsType = typeDeclKinds.has(nextKind);
    return (existingIsValue && nextIsType) || (existingIsType && nextIsValue);
  };

  for (const node of ast.body) {
    if (node.kind === "FnDecl" && node.expectDecl === true) {
      continue;
    }
    if (
      [
        "FnDecl",
        "StructDecl",
        "EnumDecl",
        "ObjectDecl",
        "ContractDecl",
        "TypeAlias",
        "ExternFnDecl",
        "ExternLetDecl",
        "ExternTypeDecl",
        "LetDecl",
      ].includes(node.kind)
    ) {
      if (globals.bindings.has(node.name)) {
        const existingKind = globalDeclKindByName.get(node.name);
        if (!canCoexistGlobalName(existingKind, node.kind)) {
          return err(
            new TuffError(
              `Variable shadowing/redeclaration is not allowed: ${node.name}`,
              node.loc,
              {
                code: "E_RESOLVE_SHADOWING",
                hint: "Rename one of the declarations; shadowing is disallowed in Tuff.",
              },
            ),
          );
        }
      } else {
        const defineResult = globals.define(node.name);
        if (!defineResult.ok) return defineResult;
      }
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
        globalDeclModuleByName.set(node.name, node.__modulePath ?? undefined);
      }
      if (node.kind === "ContractDecl") {
        contractNames.add(node.name);
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

  const visitExpr = (
    expr,
    scope,
    currentModulePath = undefined,
  ): ResolveResult<void> => {
    if (!expr) return ok(undefined);
    switch (expr.kind) {
      case "Identifier":
        if (hasNonGlobalBinding(scope, expr.name)) {
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
              globalDeclModuleByName.get(expr.name) ?? undefined;
            if (declModulePath && declModulePath !== currentModulePath) {
              const imported = moduleImportsByPath.get(currentModulePath);
              if (!(imported instanceof Set) || !imported.has(expr.name)) {
                return err(
                  new TuffError(
                    `Implicit cross-module reference '${expr.name}' is not allowed`,
                    expr.loc ?? undefined,
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

        if (isHostBuiltin(expr.name)) {
          break;
        }

        return err(
          new TuffError(`Unknown identifier '${expr.name}'`, undefined, {
            code: "E_RESOLVE_UNKNOWN_IDENTIFIER",
            hint: "Declare the identifier in scope or import it from a module.",
          }),
        );
      case "BinaryExpr": {
        const leftResult = visitExpr(expr.left, scope, currentModulePath);
        if (!leftResult.ok) return leftResult;
        const rightResult = visitExpr(expr.right, scope, currentModulePath);
        if (!rightResult.ok) return rightResult;
        break;
      }
      case "UnaryExpr":
      case "UnwrapExpr": {
        const result = visitExpr(expr.expr, scope, currentModulePath);
        if (!result.ok) return result;
        break;
      }
      case "CallExpr": {
        if (
          expr.callStyle === "method-sugar" &&
          expr.callee?.kind === "Identifier" &&
          expr.callee.name === "into"
        ) {
          const receiver = expr.args?.[0];
          if (!receiver) {
            return err(
              new TuffError("into conversion requires a receiver", expr.loc, {
                code: "E_RESOLVE_UNKNOWN_IDENTIFIER",
                hint: "Use value.into<Contract>(...) with a receiver value.",
              }),
            );
          }

          const receiverResult = visitExpr(receiver, scope, currentModulePath);
          if (!receiverResult.ok) return receiverResult;

          for (const a of (expr.args ?? []).slice(1)) {
            const argResult = visitExpr(a, scope, currentModulePath);
            if (!argResult.ok) return argResult;
          }

          const typeArgs = expr.typeArgs ?? [];
          const contractType =
            typeArgs.length === 1 && typeArgs[0]?.kind === "NamedType"
              ? typeArgs[0]
              : undefined;
          const contractName = contractType?.name;

          if (!contractName || !contractNames.has(contractName)) {
            return err(
              new TuffError(
                `Unknown contract '${contractName ?? "<missing>"}'`,
                expr.loc ?? undefined,
                {
                  code: "E_RESOLVE_UNKNOWN_IDENTIFIER",
                  hint: "Use value.into<Contract>(...) with a declared contract name.",
                },
              ),
            );
          }

          break;
        }

        if (
          !(
            expr.callStyle === "method-sugar" &&
            expr.callee?.kind === "Identifier"
          )
        ) {
          const calleeResult = visitExpr(expr.callee, scope, currentModulePath);
          if (!calleeResult.ok) return calleeResult;
        }
        for (const a of expr.args) {
          const argResult = visitExpr(a, scope, currentModulePath);
          if (!argResult.ok) return argResult;
        }
        break;
      }
      case "MemberExpr": {
        const objectResult = visitExpr(expr.object, scope, currentModulePath);
        if (!objectResult.ok) return objectResult;
        break;
      }
      case "IndexExpr": {
        const targetResult = visitExpr(expr.target, scope, currentModulePath);
        if (!targetResult.ok) return targetResult;
        const indexResult = visitExpr(expr.index, scope, currentModulePath);
        if (!indexResult.ok) return indexResult;
        break;
      }
      case "StructInit":
        if (!globals.has(expr.name)) {
          return err(
            new TuffError(
              `Unknown struct/type '${expr.name}' in initializer`,
              undefined,
              {
                code: "E_RESOLVE_UNKNOWN_STRUCT",
                hint: "Declare the struct before using it or import the correct module.",
              },
            ),
          );
        }
        for (const f of expr.fields) {
          const fieldResult = visitExpr(f.value, scope, currentModulePath);
          if (!fieldResult.ok) return fieldResult;
        }
        break;
      case "IfExpr": {
        const condResult = visitExpr(expr.condition, scope, currentModulePath);
        if (!condResult.ok) return condResult;
        const thenResult = visitNode(
          expr.thenBranch,
          new Scope(scope),
          currentModulePath,
        );
        if (!thenResult.ok) return thenResult;
        if (expr.elseBranch) {
          const elseResult = visitNode(
            expr.elseBranch,
            new Scope(scope),
            currentModulePath,
          );
          if (!elseResult.ok) return elseResult;
        }
        break;
      }
      case "MatchExpr": {
        const targetResult = visitExpr(expr.target, scope, currentModulePath);
        if (!targetResult.ok) return targetResult;
        for (const c of expr.cases) {
          const matchScope = new Scope(scope);
          if (c.pattern.kind === "StructPattern") {
            for (const field of c.pattern.fields) {
              const defineResult = matchScope.define(field.bind);
              if (!defineResult.ok) return defineResult;
            }
          } else if (c.pattern.kind === "NamePattern") {
            if (!globals.has(c.pattern.name)) {
              const defineResult = matchScope.define(c.pattern.name);
              if (!defineResult.ok) return defineResult;
            }
          }
          const bodyResult = visitNode(c.body, matchScope, currentModulePath);
          if (!bodyResult.ok) return bodyResult;
        }
        break;
      }
      case "IsExpr": {
        const exprResult = visitExpr(expr.expr, scope, currentModulePath);
        if (!exprResult.ok) return exprResult;
        break;
      }
      case "IntoExpr": {
        const valueResult = visitExpr(expr.value, scope, currentModulePath);
        if (!valueResult.ok) return valueResult;
        for (const a of expr.args ?? []) {
          const argResult = visitExpr(a, scope, currentModulePath);
          if (!argResult.ok) return argResult;
        }
        if (!contractNames.has(expr.contractName)) {
          return err(
            new TuffError(
              `Unknown contract '${expr.contractName}'`,
              expr.loc ?? undefined,
              {
                code: "E_RESOLVE_UNKNOWN_IDENTIFIER",
                hint: "Declare the contract before using 'into'.",
              },
            ),
          );
        }
        break;
      }
      case "LambdaExpr": {
        const lambdaScope = new Scope(scope);
        for (const p of expr.params ?? []) {
          const defineResult = lambdaScope.define(p.name);
          if (!defineResult.ok) return defineResult;
        }
        if (expr.body?.kind === "Block") {
          const bodyResult = visitNode(
            expr.body,
            lambdaScope,
            currentModulePath,
          );
          if (!bodyResult.ok) return bodyResult;
        } else {
          const bodyResult = visitExpr(
            expr.body,
            lambdaScope,
            currentModulePath,
          );
          if (!bodyResult.ok) return bodyResult;
        }
        break;
      }
      case "FnExpr": {
        const fnScope = new Scope(scope);
        if (expr.name) {
          const defineSelfResult = fnScope.define(expr.name);
          if (!defineSelfResult.ok) return defineSelfResult;
        }
        for (const p of expr.params ?? []) {
          const defineResult = fnScope.define(p.name);
          if (!defineResult.ok) return defineResult;
        }
        if (expr.body?.kind === "Block") {
          const bodyResult = visitNode(expr.body, fnScope, currentModulePath);
          if (!bodyResult.ok) return bodyResult;
        } else {
          const bodyResult = visitExpr(expr.body, fnScope, currentModulePath);
          if (!bodyResult.ok) return bodyResult;
        }
        break;
      }
      default:
        break;
    }
    return ok(undefined);
  };

  const visitNode = (
    node,
    scope,
    currentModulePath = undefined,
  ): ResolveResult<void> => {
    if (!node) return ok(undefined);
    const modulePath = node.__modulePath ?? currentModulePath;
    switch (node.kind) {
      case "Program":
        for (const n of node.body) {
          const result = visitNode(n, scope, modulePath);
          if (!result.ok) return result;
        }
        break;
      case "Block": {
        const blockScope = new Scope(scope);
        for (const s of node.statements ?? []) {
          if (s.kind === "FnDecl") {
            const defineResult = blockScope.define(s.name, s.loc);
            if (!defineResult.ok) return defineResult;
          }
        }
        for (const s of node.statements) {
          const result = visitNode(s, blockScope, modulePath);
          if (!result.ok) return result;
        }
        break;
      }
      case "FnDecl": {
        if (node.expectDecl === true) {
          break;
        }
        const fnScope = new Scope(scope);
        for (const p of node.params) {
          const defineResult = fnScope.define(p.name);
          if (!defineResult.ok) return defineResult;
        }
        if (node.body?.kind === "Block") {
          const result = visitNode(node.body, fnScope, modulePath);
          if (!result.ok) return result;
        } else {
          const result = visitExpr(node.body, fnScope, modulePath);
          if (!result.ok) return result;
        }
        break;
      }
      case "LetDecl": {
        if (node.value) {
          const valueResult = visitExpr(node.value, scope, modulePath);
          if (!valueResult.ok) return valueResult;
        }
        if (!(scope === globals && globals.bindings.has(node.name))) {
          const defineResult = scope.define(node.name, node.loc);
          if (!defineResult.ok) return defineResult;
        }
        break;
      }
      case "ImportDecl":
        for (const n of node.names) {
          const defineResult = scope.define(n);
          if (!defineResult.ok) return defineResult;
        }
        break;
      case "ExprStmt": {
        const result = visitExpr(node.expr, scope, modulePath);
        if (!result.ok) return result;
        break;
      }
      case "AssignStmt": {
        const targetResult = visitExpr(node.target, scope, modulePath);
        if (!targetResult.ok) return targetResult;
        const valueResult = visitExpr(node.value, scope, modulePath);
        if (!valueResult.ok) return valueResult;
        break;
      }
      case "ReturnStmt": {
        const result = visitExpr(node.value, scope, modulePath);
        if (!result.ok) return result;
        break;
      }
      case "IfStmt": {
        const condResult = visitExpr(node.condition, scope, modulePath);
        if (!condResult.ok) return condResult;
        const thenResult = visitNode(
          node.thenBranch,
          new Scope(scope),
          modulePath,
        );
        if (!thenResult.ok) return thenResult;
        if (node.elseBranch) {
          const elseResult = visitNode(
            node.elseBranch,
            new Scope(scope),
            modulePath,
          );
          if (!elseResult.ok) return elseResult;
        }
        break;
      }
      case "ForStmt": {
        const forScope = new Scope(scope);
        const defineResult = forScope.define(node.iterator);
        if (!defineResult.ok) return defineResult;
        const startResult = visitExpr(node.start, forScope, modulePath);
        if (!startResult.ok) return startResult;
        const endResult = visitExpr(node.end, forScope, modulePath);
        if (!endResult.ok) return endResult;
        const bodyResult = visitNode(node.body, forScope, modulePath);
        if (!bodyResult.ok) return bodyResult;
        break;
      }
      case "LoopStmt": {
        const bodyResult = visitNode(node.body, new Scope(scope), modulePath);
        if (!bodyResult.ok) return bodyResult;
        break;
      }
      case "WhileStmt": {
        const condResult = visitExpr(node.condition, scope, modulePath);
        if (!condResult.ok) return condResult;
        const bodyResult = visitNode(node.body, new Scope(scope), modulePath);
        if (!bodyResult.ok) return bodyResult;
        break;
      }
      case "IntoStmt": {
        if (!contractNames.has(node.contractName)) {
          return err(
            new TuffError(
              `Unknown contract '${node.contractName}'`,
              node.loc ?? undefined,
              {
                code: "E_RESOLVE_UNKNOWN_IDENTIFIER",
                hint: "Declare the contract before using 'into'.",
              },
            ),
          );
        }
        break;
      }
      default:
        break;
    }
    return ok(undefined);
  };

  const visitResult = visitNode(ast, globals);
  if (!visitResult.ok) return visitResult;
  return ok(ast);
}
