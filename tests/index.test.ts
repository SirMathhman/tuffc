import { main, compileTuffToJS } from "../src/index";

describe("main", () => {
  it("is a function", () => {
    expect(typeof main).toBe("function");
  });
});

describe("compileTuffToJS", () => {
  it("compiles empty string to JS code that evaluates to 0", () => {
    const result = compileTuffToJS("");
    const evaluated = new Function(result)();
    expect(evaluated).toBe(0);
  });
});
