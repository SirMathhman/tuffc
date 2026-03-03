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
validate("let x = 100;", "", 0);
validate("let x : I32 = 100;", "", 0);
invalidate("let x = 0; let x = 0;");
invalidate("let x : U8 = 100U16; x");
validate("let x : U16 = 100U8; x", "", 100);
invalidate("let x = read<U16>(); let y : U8 = x; y");
validate("let x = read<I32>(); let y = x; y", "100", 100);
invalidate("let x = read<U8>(); x = read<U8>(); x");
validate("let mut x = read<U8>(); x = read<U8>(); x", "3 4", 4);
invalidate("let mut x = read<U8>(); x = read<U16>(); x");
