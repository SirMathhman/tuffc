import { compile } from ".";

const validate = (
  source: string,
  stdin: string = "",
  expected: number,
): void => {
  it(source, () => {
    const result = compile(source);
    if (result.ok) {
      const parts: string[] = [];
      let current = "";
      for (let i = 0; i < stdin.length; i++) {
        if (stdin[i] === " " || stdin[i] === "\n" || stdin[i] === "\t") {
          if (current.length > 0) {
            parts.push(current);
            current = "";
          }
        } else {
          current += stdin[i];
        }
      }
      if (current.length > 0) {
        parts.push(current);
      }
      if (
        new Function("read", result.value)(() =>
          parseInt(parts.shift()!, 10),
        ) == expected
      ) {
        return;
      } else {
        expect("Failed to execute: ```" + result.value + "```").toBeUndefined();
      }
    } else {
      expect(result.error).toBeUndefined();
    }
  });
};

const invalidate = (source: string) => {
  it(source, () => {
    expect(compile(source).ok).toBe(false);
  });
};

validate("", "", 0);
invalidate("x");
validate("100", "", 100);
validate("100U8", "", 100);
invalidate("-100U8");
invalidate("256U8");
validate("read<I32>()", "100", 100);
validate("read<I32>() + read<I32>()", "1 2", 3);
validate("let x : I32 = read<I32>(); x + x", "1 3", 2);
