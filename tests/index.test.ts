import { main, compileTuffToJS } from "../src/index";

describe("main", () => {
  it("is a function", () => {
    expect(typeof main).toBe("function");
  });

  it("executes without error", () => {
    expect(() => main()).not.toThrow();
  });
});

describe("compileTuffToJS", () => {
  it("compiles empty string to JS code that evaluates to 0", () => {
    const result = compileTuffToJS("");
    const evaluated = new Function(result)();
    expect(evaluated).toBe(0);
  });

  it("compiles '100' to JS code that evaluates to 100", () => {
    const result = compileTuffToJS("100");
    const evaluated = new Function(result)();
    expect(evaluated).toBe(100);
  });

  it("compiles '100U8' to JS code that evaluates to 100", () => {
    const result = compileTuffToJS("100U8");
    const evaluated = new Function(result)();
    expect(evaluated).toBe(100);
  });

  it("compiles '42F64' to JS code that evaluates to 42", () => {
    const result = compileTuffToJS("42F64");
    const evaluated = new Function(result)();
    expect(evaluated).toBe(42);
  });

  it("compiles non-numeric input by returning it as string expression", () => {
    const result = compileTuffToJS("abc");
    const evaluated = new Function(result)();
    expect(evaluated).toBe("abc");
  });

  it("compiles negative number without type suffix as string", () => {
    const result = compileTuffToJS("-100");
    const evaluated = new Function(result)();
    expect(evaluated).toBe("-100");
  });

  it("compiles negative text as string", () => {
    const result = compileTuffToJS("-abc");
    const evaluated = new Function(result)();
    expect(evaluated).toBe("-abc");
  });

  it("throws error for negative numbers with type suffixes", () => {
    expect(() => compileTuffToJS("-100U8")).toThrow();
  });
});
