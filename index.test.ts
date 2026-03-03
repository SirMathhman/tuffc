import { compile, CompileErrorType } from ".";

function validate(source: string, stdin: string = "", expected: number): void {
  it(source, () => {
    const result = compile(source);
    if (result.ok) {
      const readFunc = () => {
        const part = stdin
          .split(" ")
          .flatMap((part) => part.split("\n"))
          .flatMap((part) => part.split("\t"))
          .filter((part) => part.length > 0)
          .shift()!;
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
}

validate("", "", 0);
validate("100", "", 100);
validate("read<I32>()", "100", 100);
validate("read<I32>() + read<I32>()", "1 2", 3);
validate("100U8", "", 100);

// negative unsigned value should be rejected
function invalidate(source: string, expectedType: CompileErrorType) {
  it(source, () => {
    const result = compile(source);
    if (result.ok) {
      expect(
        "Expected to fail, but succeeded: ```" + result.value + "```",
      ).toBeUndefined();
    } else {
      expect(result.error.type).toBe(expectedType);
    }
  });
}

invalidate("-100U8", CompileErrorType.NegativeUnsigned);
invalidate("256U8", CompileErrorType.UnsignedOverflow);
