import { compile } from ".";

const validate = (source: string, expected: number): void => {
  it(source, () => {
    const result = compile(source);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const func = new Function(result.value);
      const actual = func() as number;
      expect(actual).toBe(expected);
    }
  });
};

const invalidate = (source: string) => {
  it(source, () => {
    const result = compile(source);
    expect(result.ok).toBe(false);
  });
};

validate("", 0);
invalidate("x");
validate("100", 100);
validate("100U8", 100);
invalidate("-100U8");
invalidate("256U8");
