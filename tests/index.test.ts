import { compile } from "../src";

function execute(source: string): number {
  const output = compile(source);
  const fn = new Function(`return ${output}`);
  return fn() as number;
}

describe("The compiler can compile", () => {
  it("an empty program", () => {
    const result = execute("");
    expect(result).toBe(0);
  });

  it("a number literal", () => {
    const result = execute("100");
    expect(result).toBe(100);
  });

  it("a number literal with U8 type suffix", () => {
    const result = execute("100U8");
    expect(result).toBe(100);
  });

  it("rejects negative numbers with type suffix", () => {
    expect(() => execute("-100U8")).toThrow();
  });
});
