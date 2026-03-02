import { compile } from "../src";

function execute(source: string): number {
  const output = compile(source);
  const evaled = eval(output);
  return evaled as number;
}

describe("The compiler can compile", () => {
  it("an empty program", () => {
    const result = execute("");
    expect(result).toBe(0);
  });
});
