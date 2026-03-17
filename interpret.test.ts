import { interpret } from "./interpret";

describe("interpret", () => {
  it("should return 0 for empty string", () => {
    const result = interpret("");
    if (result !== 0) {
      throw new Error(`Expected 0, but got ${result}`);
    }
  });
});
