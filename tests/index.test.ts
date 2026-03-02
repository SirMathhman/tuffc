import { compile } from "../src";

function executeResult(source: string): ReturnType<typeof compile> {
  return compile(source);
}

function assertValid(
  source: string,
  stdInOrExpected: string | number,
  expected?: number,
): void {
  const result = executeResult(source);
  expect(result.type).toBe("ok");
  if (result.type === "ok") {
    if (typeof stdInOrExpected === "number") {
      // Old signature: assertValid(source, expected)
      const fn = new Function(`return ${result.value}`);
      expect(fn()).toBe(stdInOrExpected);
    } else {
      // New signature: assertValid(source, stdIn, expected)
      const stdIn = stdInOrExpected;
      const read = (): number => Number(stdIn);
      const fn = new Function("read", `return ${result.value}`);
      expect(fn(read)).toBe(expected);
    }
  }
}

describe("The compiler can compile", () => {
  it("an empty program", () => {
    assertValid("", 0);
  });

  it("a number literal", () => {
    assertValid("100", 100);
  });

  it("a number literal with U8 type suffix", () => {
    assertValid("100U8", 100);
  });

  it("rejects negative numbers with type suffix", () => {
    const result = executeResult("-100U8");
    expect(result.type).toBe("err");
  });

  it("rejects U8 values outside valid range", () => {
    const result = executeResult("256U8");
    expect(result.type).toBe("err");
  });

  it("reads a U8 value from input", () => {
    assertValid("read<U8>()", "100", 100);
  });
});
