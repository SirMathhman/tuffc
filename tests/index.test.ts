import { compileTuffToJS } from "../src/index";
import { Ok, Err } from "../src/types/result";

function assertOkEvaluatesTo(input: string, expected: unknown) {
  const result = compileTuffToJS(input);
  expect(result.isErr()).toBe(false);
  if (!result.isErr()) {
    const evaluated = new Function(result.value)();
    expect(evaluated).toBe(expected);
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
    const result = compileTuffToJS("-100U8");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toContain("Negative numbers with type suffixes");
    }
  });
});
