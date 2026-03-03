import { compile } from ".";

function validate(source: string, expected: number): void {
  it(source, () => {
    const func = new Function(compile(source));
    const actual = func() as number;
    expect(actual).toBe(expected);
  });
}

function invalidate(source: string) {
  it(source, () => {
    expect(() => compile(source)).toThrow();
  });
}

validate("", 0);
invalidate("x");
