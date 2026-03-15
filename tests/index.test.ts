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

function assertOkEvaluatesCompiled(
  input: string,
  expected: unknown,
  stdinValue?: string,
) {
  const result = compileTuffToJS(input);
  expect(result.isErr()).toBe(false);
  if (!result.isErr()) {
    const evaluated = evaluateCompiled(result.value, stdinValue);
    expect(evaluated).toBe(expected);
  }
}

function assertOkEvaluatesTo(input: string, expected: unknown) {
  assertOkEvaluatesCompiled(input, expected);
}

function assertOkEvaluatesToWithStdin(
  input: string,
  stdinValue: string,
  expected: unknown,
) {
  assertOkEvaluatesCompiled(input, expected, stdinValue);
}

function assertErrorContains(input: string, expectedMessage: string) {
  const result = compileTuffToJS(input);
  expect(result.isErr()).toBe(true);
  if (result.isErr()) {
    expect(result.error).toContain(expectedMessage);
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
    assertOkEvaluatesTo("", 0);
  });

  it("compiles '100' to JS code that evaluates to 100", () => {
    assertOkEvaluatesTo("100", 100);
  });

  it("compiles '100U8' to JS code that evaluates to 100", () => {
    assertOkEvaluatesTo("100U8", 100);
  });

  it("compiles '42F64' to JS code that evaluates to 42", () => {
    assertOkEvaluatesTo("42F64", 42);
  });

  it("compiles non-numeric input by returning it as string expression", () => {
    assertOkEvaluatesTo("abc", "abc");
  });

  it("compiles negative number without type suffix as string", () => {
    assertOkEvaluatesTo("-100", "-100");
  });

  it("compiles negative text as string", () => {
    assertOkEvaluatesTo("-abc", "-abc");
  });

  it("returns error for negative numbers with type suffixes", () => {
    assertErrorContains("-100U8", "Negative numbers with type suffixes");
  });

  it("returns error for numbers that exceed their type suffix range", () => {
    assertErrorContains("256U8", "exceeds");
  });

  it("compiles read<U8>() with stdin '100' to 100", () => {
    assertOkEvaluatesToWithStdin("read<U8>()", "100", 100);
  });

  it("returns error for read<> with unknown type", () => {
    assertErrorContains("read<INVALID>()", "Unknown type");
  });

  it("returns error for read<> with non-alphanumeric type", () => {
    assertErrorContains("read<U@8>()", "Unknown type");
  });
});
