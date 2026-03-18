import { getGreeting, interpretTuff } from "../src/index";

describe("getGreeting", () => {
  it("returns the project greeting", () => {
    expect(getGreeting()).toBe("Hello from TypeScript!");
  });
});

describe("interpretTuff", () => {
  it.each([
    ["100U8", 100],
    ["0U8", 0],
    ["255U8", 255],
  ])("returns %i for %s", (input, expected) => {
    expect(interpretTuff(input)).toBe(expected);
  });

  it.each(["", "foo", "100U9", "U8", "-1U8"])(
    "throws for invalid input %s",
    (input) => {
      expect(() => interpretTuff(input)).toThrow();
    },
  );
});
