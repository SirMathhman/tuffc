import { compile } from ".";

function itIsValid(source: string, expected: number): void {
  it(source, () => {
    const actual = eval(compile(source)) as number;
    expect(actual).toBe(expected);
  });
}

describe("Compiler test cases", () => {
  itIsValid("1 + 2", 3);
});
