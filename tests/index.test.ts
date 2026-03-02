import { compile } from "../src";

function executeResult(source: string): ReturnType<typeof compile> {
  return compile(source);
}

function expectSuccess(source: string, expected: number): void {
  const result = executeResult(source);
  expect(result.type).toBe("ok");
  if (result.type === "ok") {
    const fn = new Function(`return ${result.value}`);
    expect(fn()).toBe(expected);
  }
}

describe("The compiler can compile", () => {
  it("an empty program", () => {
    expectSuccess("", 0);
  });

  it("a number literal", () => {
    expectSuccess("100", 100);
  });

  it("a number literal with U8 type suffix", () => {
    expectSuccess("100U8", 100);
  });

  it("rejects negative numbers with type suffix", () => {
    const result = executeResult("-100U8");
    expect(result.type).toBe("err");
  });
});
