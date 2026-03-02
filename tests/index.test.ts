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
  if (result.type === "ok") {
    if (typeof stdInOrExpected === "number") {
      // Old signature: assertValid(source, expected)
      const fn = new Function(`return ${result.value}`);
      expect(fn()).toBe(stdInOrExpected);
    } else {
      // New signature: assertValid(source, stdIn, expected)
      const stdIn = stdInOrExpected;
      const values: number[] = [];
      let current = "";
      let i = 0;
      while (i < stdIn.length) {
        const char = stdIn[i];
        if (char === " " || char === "\t" || char === "\n") {
          if (current !== "") {
            values.push(Number(current));
            current = "";
          }
        } else {
          current += char;
        }
        i++;
      }
      if (current !== "") {
        values.push(Number(current));
      }
      let index = 0;
      const read = (): number => {
        const value = values[index];
        index++;
        return value;
      };
      const fn = new Function("read", `return ${result.value}`);
      expect(fn(read)).toBe(expected);
    }
  } else {
    expect(result.error).toBeUndefined();
  }
}

function assertInvalid(source: string): void {
  const result = executeResult(source);
  expect(result.type).toBe("err");
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
    if (result.type === "ok") {
      expect(result.value).toBeUndefined();
    }
  });

  it("rejects U8 values outside valid range", () => {
    const result = executeResult("256U8");
    expect(result.type).toBe("err");
  });

  it("reads a U8 value from input", () => {
    assertValid("read<U8>()", "100", 100);
  });

  it("adds two U8 values from input", () => {
    assertValid("read<U8>() + read<U8>()", "1 2", 3);
  });

  it("declares and uses a variable", () => {
    assertValid("let x : U8 = read<U8>(); x", "1 3", 1);
  });

  it("declares a variable without using it", () => {
    assertValid("let x : U8 = read<U8>();", "1 3", 0);
  });

  it("rejects duplicate variable declarations", () => {
    assertInvalid("let x : U8 = read<U8>(); let x : U8 = read<U8>();");
  });

  it("rejects type mismatch in variable initialization", () => {
    assertInvalid("let x : U8 = read<U16>();");
  });
});
