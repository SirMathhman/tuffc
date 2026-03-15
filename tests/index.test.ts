import { compileTuffToJS } from "../src/index";
import { Ok, Err } from "../src/types/result";

function evaluateCompiled(code: string, stdinValue?: string): unknown {
  // eslint-disable-next-line no-new-func
  if (stdinValue !== undefined) {
    return new Function("__stdin", code)(stdinValue);
  }
  // eslint-disable-next-line no-new-func
  return new Function(code)();
}

function assertOk(input: string, expected: unknown, stdinValue?: string) {
  const result = compileTuffToJS(input);
  if (result.isErr()) {
    expect(result.error).toBeUndefined(); // Force test failure if it's an error
  } else {
    const evaluated = evaluateCompiled(result.value, stdinValue);
    expect(evaluated).toBe(expected);
  }
}

function assertErr(input: string, expectedMessage: string) {
  const result = compileTuffToJS(input);
  if (result.isErr()) {
    expect(result.error).toContain(expectedMessage);
  } else {
    expect(result.value).toBeUndefined(); // Force test failure if it's not an error
  }
}

describe("Result", () => {
  it("Ok.isErr returns false", () => {
    const ok = new Ok("value");
    expect(ok.isErr()).toBe(false);
  });

  it("Err.isErr returns true", () => {
    const err = new Err("error");
    expect(err.isErr()).toBe(true);
  });
});

describe("compileTuffToJS", () => {
  it("compiles empty string to JS code that evaluates to 0", () => {
    assertOk("", 0);
  });

  it("compiles '100' to JS code that evaluates to 100", () => {
    assertOk("100", 100);
  });

  it("compiles '100U8' to JS code that evaluates to 100", () => {
    assertOk("100U8", 100);
  });

  it("compiles '42F64' to JS code that evaluates to 42", () => {
    assertOk("42F64", 42);
  });

  it("compiles non-numeric input by returning it as string expression", () => {
    assertOk("abc", "abc");
  });

  it("compiles negative number without type suffix as string", () => {
    assertOk("-100", "-100");
  });

  it("compiles negative text as string", () => {
    assertOk("-abc", "-abc");
  });

  it("returns error for negative numbers with type suffixes", () => {
    assertErr("-100U8", "Negative numbers with type suffixes");
  });

  it("returns error for numbers that exceed their type suffix range", () => {
    assertErr("256U8", "exceeds");
  });

  it("compiles read<U8>() with stdin '100' to 100", () => {
    assertOk("read<U8>()", 100, "100");
  });

  it("returns error for read<> with unknown type", () => {
    assertErr("read<INVALID>()", "Unknown type");
  });

  it("returns error for read<> with non-alphanumeric type", () => {
    assertErr("read<U@8>()", "Unknown type");
  });
});
