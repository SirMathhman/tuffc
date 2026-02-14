export function desugar(ast) {
  const out = [];
  for (const node of ast.body) {
    if (node.kind === "ClassFunctionDecl") {
      out.push({
        kind: "StructDecl",
        name: node.name,
        generics: [],
        fields: [],
      });
      out.push({
        kind: "FnDecl",
        name: node.name,
        generics: node.generics,
        params: node.params,
        returnType: node.returnType,
        body:
          node.body.kind === "Block"
            ? {
                kind: "Block",
                statements: [
                  {
                    kind: "LetDecl",
                    name: "this",
                    type: null,
                    value: { kind: "StructInit", name: node.name, fields: [] },
                  },
                  ...node.body.statements,
                  {
                    kind: "ExprStmt",
                    expr: { kind: "Identifier", name: "this" },
                  },
                ],
              }
            : node.body,
      });
    } else {
      out.push(node);
    }
  }
  return { kind: "Program", body: out };
}
