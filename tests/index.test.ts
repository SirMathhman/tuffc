import { getGreeting } from "../src/index";

describe("getGreeting", () => {
  it("returns the project greeting", () => {
    expect(getGreeting()).toBe("Hello from TypeScript!");
  });
});
