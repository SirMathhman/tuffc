import { expect, test } from "bun:test";
import { checkProgram } from "../src/checker";
import { parseSource } from "../src/parser";

test("accepts a valid program", () => {
  const parsed = parseSource(`fn add(a: I32, b: I32) => a + b;\nfn main() => {\n  let mut value = 1;\n  value = add(value, 2);\n  print(value);\n};`);

  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.program).toBeDefined();

  const checked = checkProgram(parsed.program!);
  expect(checked.diagnostics).toEqual([]);
  expect(checked.functions.get("add")?.type.returnType).toMatchObject({ kind: "PrimitiveType", name: "I32" });
});

test("rejects type mismatches", () => {
  const parsed = parseSource(`fn main() => {\n  let value: I32 = true;\n};`);
  const checked = checkProgram(parsed.program!);

  expect(checked.diagnostics.length).toBeGreaterThan(0);
  expect(checked.diagnostics[0]?.message).toContain("Cannot assign");
});