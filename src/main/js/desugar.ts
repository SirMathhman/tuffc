type ProgramNode = { kind: string; [key: string]: unknown };
type Program = { body: ProgramNode[] };

export function desugar(ast: Program): {
  kind: "Program";
  body: ProgramNode[];
} {
  const out: ProgramNode[] = [];

  for (const node of ast.body) {
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
                    type: null,
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
