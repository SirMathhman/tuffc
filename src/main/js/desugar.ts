type ProgramNode = { kind: string; [key: string]: unknown };
type Program = { body: ProgramNode[] };

function namedType(name: string, genericArgs: unknown[] = []): ProgramNode {
  return { kind: "NamedType", name, genericArgs };
}

function ptrType(to: ProgramNode, mutable = false): ProgramNode {
  return { kind: "PointerType", mutable, to };
}

function buildDynTableStruct(contract: ProgramNode): ProgramNode {
  const tableName = `__dyn_${String(contract.name)}Table`;
  const fields = (contract.methods ?? []).map((m: ProgramNode) => ({
    name: m.name,
    type: ptrType(
      {
        kind: "FunctionType",
        params: (m.params ?? []).map((p: ProgramNode, idx: number) => {
          if (p.implicitThis) {
            return ptrType(namedType("AnyValue"), true);
          }
          return p.type ?? namedType(`Arg${idx}`);
        }),
        returnType: m.returnType ?? namedType("Void"),
      },
      false,
    ),
  }));

  return {
    kind: "StructDecl",
    name: tableName,
    generics: [],
    fields,
    isCopy: false,
  };
}

function buildDynWrapperStruct(contract: ProgramNode): ProgramNode {
  const wrapperName = `__dyn_${String(contract.name)}`;
  const tableName = `__dyn_${String(contract.name)}Table`;
  return {
    kind: "StructDecl",
    name: wrapperName,
    generics: ["T"],
    fields: [
      { name: "ref", type: ptrType(namedType("T"), true) },
      {
        name: "table",
        type: namedType(tableName),
      },
    ],
    isCopy: false,
  };
}

function transformIntoInBlock(
  block: ProgramNode,
  fnTypeName: string,
  contractMap: Map<string, ProgramNode>,
): ProgramNode {
  const statements = block.statements ?? [];
  const outStatements: ProgramNode[] = [];
  const insertedHelpers = new Set<string>();
  const localFnNames = new Set<string>();
  for (const stmt of statements) {
    if (stmt.kind === "FnDecl" && typeof stmt.name === "string") {
      localFnNames.add(stmt.name);
    }
  }

  for (const stmt of statements) {
    if (stmt.kind === "IntoStmt") {
      const contractName = String(stmt.contractName ?? "");
      const contract = contractMap.get(contractName);
      if (!contract) {
        outStatements.push(stmt);
        continue;
      }

      const contractMethods = (contract.methods ?? []).map((m: ProgramNode) =>
        String(m.name),
      );
      const canBuildLocalDynamicHelper =
        contractMethods.length > 0 &&
        contractMethods.every((methodName) => localFnNames.has(methodName));

      if (insertedHelpers.has(contractName) || !canBuildLocalDynamicHelper) {
        outStatements.push(stmt);
        continue;
      }

      const helperName = `into${contractName}`;
      const wrapperName = `__dyn_${contractName}`;
      const tableName = `__dyn_${contractName}Table`;
      const ptrParam = "ptr";

      const tableFields = (contract.methods ?? []).map((m: ProgramNode) => ({
        key: m.name,
        value: {
          kind: "UnaryExpr",
          op: "&",
          expr: { kind: "Identifier", name: m.name },
        },
      }));

      const wrapperInit = {
        kind: "StructInit",
        name: wrapperName,
        fields: [
          { key: "ref", value: { kind: "Identifier", name: ptrParam } },
          {
            key: "table",
            value: {
              kind: "StructInit",
              name: tableName,
              fields: tableFields,
            },
          },
        ],
      };

      outStatements.push({
        kind: "FnDecl",
        name: helperName,
        generics: [],
        genericConstraints: {},
        params: [],
        returnType: {
          kind: "FunctionType",
          params: [ptrType(namedType(fnTypeName), true)],
          returnType: namedType(wrapperName, [namedType(fnTypeName)]),
        },
        body: {
          kind: "LambdaExpr",
          params: [
            { name: ptrParam, type: ptrType(namedType(fnTypeName), true) },
          ],
          body: wrapperInit,
        },
      });

      insertedHelpers.add(contractName);
      outStatements.push(stmt);
      continue;
    }

    if (stmt.kind === "Block") {
      outStatements.push(transformIntoInBlock(stmt, fnTypeName, contractMap));
      continue;
    }

    if (stmt.kind === "LifetimeStmt") {
      outStatements.push({
        ...stmt,
        body:
          stmt.body?.kind === "Block"
            ? transformIntoInBlock(stmt.body, fnTypeName, contractMap)
            : stmt.body,
      });
      continue;
    }

    outStatements.push(stmt);
  }

  return { ...block, statements: outStatements };
}

function blockContainsInto(node: ProgramNode | undefined): boolean {
  if (!node) return false;
  if (node.kind === "IntoStmt") return true;
  if (node.kind === "Block") {
    return (node.statements ?? []).some((s: ProgramNode) =>
      blockContainsInto(s),
    );
  }
  if (node.kind === "IfStmt") {
    return (
      blockContainsInto(node.thenBranch as ProgramNode) ||
      blockContainsInto(node.elseBranch as ProgramNode)
    );
  }
  if (
    node.kind === "ForStmt" ||
    node.kind === "WhileStmt" ||
    node.kind === "LoopStmt"
  ) {
    return blockContainsInto(node.body as ProgramNode);
  }
  if (node.kind === "LifetimeStmt") {
    return blockContainsInto(node.body as ProgramNode);
  }
  return false;
}

function cloneScopeMap(scope: Map<string, string>): Map<string, string> {
  return new Map(scope);
}

function isDropCallExpr(expr: ProgramNode | undefined): boolean {
  return (
    !!expr &&
    expr.kind === "CallExpr" &&
    expr.callee?.kind === "Identifier" &&
    expr.callee?.name === "drop" &&
    (expr.args?.length ?? 0) === 1
  );
}

function transformBlockWithDrops(
  block: ProgramNode,
  aliasDestructorByName: Map<string, string>,
  scopeDestructorByName: Map<string, string>,
): ProgramNode {
  const inScope = cloneScopeMap(scopeDestructorByName);
  const localsInOrder: string[] = [];
  const droppedLocals = new Set<string>();
  const outStatements: ProgramNode[] = [];

  const emitLiveLocalDrops = (loc: unknown = undefined): ProgramNode[] => {
    const drops: ProgramNode[] = [];
    for (let i = localsInOrder.length - 1; i >= 0; i -= 1) {
      const name = localsInOrder[i];
      if (droppedLocals.has(name)) continue;
      drops.push({
        kind: "DropStmt",
        target: { kind: "Identifier", name },
        destructorName: inScope.get(name),
        loc,
      });
      droppedLocals.add(name);
    }
    return drops;
  };

  const registerMaybeDestructorLocal = (stmt: ProgramNode) => {
    // Register local type aliases with destructors into the shared map
    if (
      stmt.kind === "TypeAlias" &&
      typeof (stmt as any).destructorName === "string" &&
      (stmt as any).destructorName.length > 0
    ) {
      aliasDestructorByName.set(
        String((stmt as any).name),
        String((stmt as any).destructorName),
      );
      return;
    }
    if (stmt.kind !== "LetDecl") return;
    const typeName =
      stmt.type?.kind === "NamedType" ? String(stmt.type?.name) : undefined;
    if (!typeName) return;
    const dtor = aliasDestructorByName.get(typeName);
    if (!dtor) return;
    const localName = String(stmt.name);
    inScope.set(localName, dtor);
    localsInOrder.push(localName);
    droppedLocals.delete(localName);
  };

  let terminated = false;
  for (const stmt of block.statements ?? []) {
    if (terminated) break;

    if (stmt.kind === "ExprStmt" && isDropCallExpr(stmt.expr)) {
      const target = stmt.expr.args[0];
      const targetName =
        target?.kind === "Identifier" ? String(target.name) : undefined;
      const destructorName = targetName ? inScope.get(targetName) : undefined;
      outStatements.push({
        kind: "DropStmt",
        target,
        destructorName,
        loc: stmt.loc,
      });
      if (targetName && destructorName) {
        droppedLocals.add(targetName);
      }
      continue;
    }

    if (stmt.kind === "AssignStmt" && stmt.target?.kind === "Identifier") {
      const targetName = String(stmt.target.name);
      const destructorName = inScope.get(targetName);
      if (destructorName && !droppedLocals.has(targetName)) {
        outStatements.push({
          kind: "DropStmt",
          target: stmt.target,
          destructorName,
          loc: stmt.loc,
        });
      }
      outStatements.push(stmt);
      if (destructorName) {
        droppedLocals.delete(targetName);
      }
      continue;
    }

    if (
      stmt.kind === "ReturnStmt" ||
      stmt.kind === "BreakStmt" ||
      stmt.kind === "ContinueStmt"
    ) {
      outStatements.push(...emitLiveLocalDrops(stmt.loc));
      outStatements.push(stmt);
      terminated = true;
      continue;
    }

    if (stmt.kind === "Block") {
      outStatements.push(
        transformBlockWithDrops(stmt, aliasDestructorByName, inScope),
      );
      continue;
    }

    if (stmt.kind === "IfStmt") {
      outStatements.push({
        ...stmt,
        thenBranch:
          stmt.thenBranch?.kind === "Block"
            ? transformBlockWithDrops(
                stmt.thenBranch,
                aliasDestructorByName,
                inScope,
              )
            : stmt.thenBranch,
        elseBranch:
          stmt.elseBranch?.kind === "Block"
            ? transformBlockWithDrops(
                stmt.elseBranch,
                aliasDestructorByName,
                inScope,
              )
            : stmt.elseBranch,
      });
      continue;
    }

    if (
      stmt.kind === "ForStmt" ||
      stmt.kind === "WhileStmt" ||
      stmt.kind === "LoopStmt"
    ) {
      outStatements.push({
        ...stmt,
        body:
          stmt.body?.kind === "Block"
            ? transformBlockWithDrops(stmt.body, aliasDestructorByName, inScope)
            : stmt.body,
      });
      continue;
    }

    if (stmt.kind === "LifetimeStmt") {
      outStatements.push({
        ...stmt,
        body:
          stmt.body?.kind === "Block"
            ? transformBlockWithDrops(stmt.body, aliasDestructorByName, inScope)
            : stmt.body,
      });
      continue;
    }

    outStatements.push(stmt);
    registerMaybeDestructorLocal(stmt);
  }

  if (!terminated) {
    outStatements.push(...emitLiveLocalDrops());
  }

  return { ...block, statements: outStatements };
}

export function desugar(ast: Program): {
  kind: "Program";
  body: ProgramNode[];
} {
  const out: ProgramNode[] = [];
  const contracts = new Map<string, ProgramNode>();
  const aliasDestructorByName = new Map<string, string>();
  const declaredStructs = new Set<string>();

  for (const node of ast.body) {
    if (node.kind === "ContractDecl") {
      contracts.set(String(node.name), node);
    }
    if (node.kind === "StructDecl") {
      declaredStructs.add(String(node.name));
    }
    if (
      node.kind === "TypeAlias" &&
      typeof node.destructorName === "string" &&
      node.destructorName.length > 0
    ) {
      aliasDestructorByName.set(String(node.name), String(node.destructorName));
    }
  }

  for (const contract of contracts.values()) {
    out.push(buildDynTableStruct(contract));
    out.push(buildDynWrapperStruct(contract));
  }

  for (const node of ast.body) {
    if (node.kind === "FnDecl" && node.body?.kind === "Block") {
      const fnTypeName =
        (node.returnType?.kind === "NamedType" && node.returnType?.name) ||
        String(node.name);
      const hasInto = blockContainsInto(node.body);
      const explicitReturnName =
        node.returnType?.kind === "NamedType"
          ? node.returnType?.name
          : undefined;
      const isConstructorShape =
        !node.returnType || explicitReturnName === String(node.name);
      const useConstructorDesugar = hasInto && isConstructorShape;

      if (useConstructorDesugar && !declaredStructs.has(String(node.name))) {
        out.push({
          kind: "StructDecl",
          name: node.name,
          generics: [],
          fields: (node.params ?? []).map((p: ProgramNode) => ({
            name: p.name,
            type: p.type ?? namedType("Unknown"),
          })),
          isCopy: false,
        });
        declaredStructs.add(String(node.name));
      }

      const transformedBody = transformIntoInBlock(
        node.body,
        fnTypeName,
        contracts,
      );
      const transformedWithDrops = transformBlockWithDrops(
        transformedBody,
        aliasDestructorByName,
        new Map(),
      );

      if (useConstructorDesugar) {
        const ctorFields = (node.params ?? []).map((p: ProgramNode) => ({
          key: p.name,
          value: { kind: "Identifier", name: p.name },
        }));
        out.push({
          ...node,
          returnType: node.returnType ?? namedType(String(node.name)),
          body: {
            kind: "Block",
            statements: [
              {
                kind: "LetDecl",
                name: "__this",
                type: namedType(String(node.name)),
                value: {
                  kind: "StructInit",
                  name: String(node.name),
                  fields: ctorFields,
                },
              },
              ...transformedWithDrops.statements,
              {
                kind: "ExprStmt",
                expr: { kind: "Identifier", name: "__this" },
              },
            ],
          },
        });
        continue;
      }

      out.push({
        ...node,
        body: transformedWithDrops,
      });
      continue;
    }

    if (node.kind === "ClassFunctionDecl") {
      const classNode = node as ProgramNode & {
        name: unknown;
        generics: unknown;
        params: unknown;
        returnType: unknown;
        body: ProgramNode & { statements?: ProgramNode[] };
      };

      out.push({
        kind: "StructDecl",
        name: classNode.name,
        generics: [],
        fields: [],
        isCopy: false,
      });

      out.push({
        kind: "FnDecl",
        name: classNode.name,
        generics: classNode.generics,
        params: classNode.params,
        returnType: classNode.returnType,
        body:
          classNode.body.kind === "Block"
            ? {
                kind: "Block",
                statements: [
                  {
                    kind: "LetDecl",
                    name: "this",
                    type: undefined,
                    value: {
                      kind: "StructInit",
                      name: classNode.name,
                      fields: [],
                    },
                  },
                  ...(classNode.body.statements ?? []),
                  {
                    kind: "ExprStmt",
                    expr: { kind: "Identifier", name: "this" },
                  },
                ],
              }
            : classNode.body,
      });
      continue;
    }

    out.push(node);
  }

  return { kind: "Program", body: out };
}
