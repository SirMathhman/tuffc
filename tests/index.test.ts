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

function assertErrCode(input: string, expectedCode: string) {
  const result = compileTuffToJS(input);
  if (result.isErr()) {
    expect(result.error.code).toBe(expectedCode);
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
    assertErrCode("-100U8", "NEGATIVE_WITH_SUFFIX");
  });

  it("returns error for numbers that exceed their type suffix range", () => {
    assertErrCode("256U8", "VALUE_OUT_OF_RANGE");
  });

  it("compiles read<U8>() with stdin '100' to 100", () => {
    assertOk("read<U8>()", 100, "100");
  });

  it("returns error for read<> with unknown type", () => {
    assertErrCode("read<INVALID>()", "UNKNOWN_TYPE");
  });

  it("returns error for read<> with non-alphanumeric type", () => {
    assertErrCode("read<U@8>()", "UNKNOWN_TYPE");
  });

  it("compiles '100U8 + 50U8' to JS code that evaluates to 150", () => {
    assertOk("100U8 + 50U8", 150);
  });

  it("returns error when addition result exceeds type range", () => {
    assertErrCode("200U8 + 100U8", "VALUE_OUT_OF_RANGE");
  });

  it("compiles '100U8 - 30U8' to JS code that evaluates to 70", () => {
    assertOk("100U8 - 30U8", 70);
  });

  it("compiles '10U8 * 5U8' to JS code that evaluates to 50", () => {
    assertOk("10U8 * 5U8", 50);
  });

  it("compiles '100U8 / 4U8' to JS code that evaluates to 25", () => {
    assertOk("100U8 / 4U8", 25);
  });

  it("returns error when operands have different types", () => {
    assertErrCode("100U8 + 50U16", "TYPE_MISMATCH");
  });

  it("returns error when left operand exceeds type range in binary operation", () => {
    assertErrCode("256U8 + 50U8", "VALUE_OUT_OF_RANGE");
  });

  it("returns error when right operand exceeds type range in binary operation", () => {
    assertErrCode("100U8 + 260U8", "VALUE_OUT_OF_RANGE");
  });

  it("compiles input with special characters as string", () => {
    assertOk("hello@world", "hello@world");
  });

  it("treats unrecognized type suffix as numeric only", () => {
    assertOk("100U9", 100);
  });
});
