import { main } from "../src/index";

describe("main", () => {
  it("is a function", () => {
    expect(typeof main).toBe("function");
  });

  it("temporary failing hook check", () => {
    expect(1).toBe(2);
  });
});
