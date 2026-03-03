import { compile } from ".";

const validate = (
  source: string,
  stdin: string = "",
  expected: number,
): void => {
  it(source, () => {
    const result = compile(source);
    if (result.ok) {
      const parts = stdin
        .split(" ")
        .flatMap((part) => part.split("\n"))
        .flatMap((part) => part.split("\t"))
        .filter((part) => part.length > 0);

      const readFunc = () => {
        const part = parts.shift()!;
        if (part === "true") return 1;
        if (part === "false") return 0;
        return parseInt(part, 10);
      };

      if (new Function("read", result.value)(readFunc) == expected) {
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
    const result = compile(source);
    if (result.ok) {
      expect(
        "Expected to fail, but succeeded: ```" + result.value + "```",
      ).toBeUndefined();
    }
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
validate("let mut x = read<I32>(); x += read<I32>(); x", "1 3", 4);
invalidate("x += read<I32>(); x");
validate("let x = read<I32>(); let y : *I32 = &x; *y", "100", 100);
invalidate("let x = read<I32>(); let y : *U8 = &x; *y");
invalidate("let x = read<I32>(); *x");
invalidate("let x = read<I32>(); let y = &x; let z : U8 = *y;");
validate("let x : Bool = true; x", "", 1);
validate("let x : Bool = false; x", "", 0);
invalidate("let x = true; let y = false; x + y");
validate("let x = true; let y = false; x || y", "", 1);
validate("let x = true; let y = false; x && y", "", 0);
invalidate("let x = 0; let y = 1; x || y");
validate("let x = read<I32>(); let y = read<I32>(); x < y", "3 4", 1);
validate("let x = read<Bool>(); x", "true", 1);
validate("let x = if (true) 3 else 5; x", "", 3);
invalidate("let x = if (100) 3 else 5; x");
invalidate("let x = if (true) 3 else true; x");
invalidate("let x : Bool = if (true) 3 else 5; x");
validate("let x = if (false) 2 else if (false) 3 else 4; x", "", 4);
validate("let x = { let y = 100; y }; x", "", 100);
invalidate("let x = { let y = 100; }; x");
invalidate("let x = { let y = 100; y }; y");
validate("let x : I64 = { let y : I64 = 100; y }; x", "", 100);
invalidate("let x : U8 = { let y : I64 = 100; y }; x");
validate("{}", "", 0);
validate("{} read<I32>()", "100", 100);
validate("let x = read<I32>(); {} x", "100", 100);
validate("let mut x = read<I32>(); { x = read<I32>(); } x", "1 2", 2);
invalidate("{ let mut x = read<I32>(); } x = read<I32>(); x");
