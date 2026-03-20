import { expect, test } from "bun:test";
import { parseSource } from "../src/parser";

test("parses a function declaration", () => {
  const result = parseSource("fn main() => 1 + 2;");

  expect(result.diagnostics).toEqual([]);
  expect(result.program).toBeDefined();
  expect(result.program?.functions).toHaveLength(1);
  expect(result.program?.functions[0]).toMatchObject({
    kind: "FunctionDeclaration",
    name: "main",
    body: {
      kind: "BinaryExpression",
      operator: "+",
    },
  });
});

test("parses blocks and if expressions", () => {
  const result = parseSource(`fn main() => {\n  let mut value = 1;\n  if (value > 0) { value } else { 0 }\n};`);

  expect(result.diagnostics).toEqual([]);
  expect(result.program?.functions[0].body.kind).toBe("BlockExpression");
});