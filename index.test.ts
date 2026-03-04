import { compile } from ".";

function validate(source: string, stdin: string = "", expected: number): void {
  it(source, () => {
    const compiled = compile(source);
    const tokens = stdin
      .split(" ")
      .flatMap((part) => part.split("\n"))
      .flatMap((part) => part.split("\t"))
      .filter((part) => part.length > 0);
    let tokenIndex = 0;
    const readFunc = () => {
      const part = tokens[tokenIndex++] ?? "0";
      if (part === "true") return 1;
      if (part === "false") return 0;
      return parseInt(part, 10);
    };

    if (new Function("read", compiled)(readFunc) == expected) {
      return;
    } else {
      expect("Failed to execute: ```" + compiled + "```").toBeUndefined();
    }
  });
}

// Test cases for validate() function

// Basic read tests
validate("read<U8>()", "100", 100);
validate("read<U8>()", "0", 0);
validate("read<U8>()", "255", 255);

// Multiple reads
validate("read<U8>() + read<U8>()", "10 20", 30);
validate("read<U8>() * read<U8>()", "5 6", 30);

// Edge cases with whitespace/newlines
validate("read<U8>()", "100\n", 100);
validate("read<U8>()", "100\t", 100);
validate("read<U8>()", "\n100", 100);

// Multiple tokens with various separators
validate("read<U8>() + read<U8>() + read<U8>()", "1 2 3", 6);
validate("read<U8>() + read<U8>() + read<U8>()", "1\n2\n3", 6);
validate("read<U8>() + read<U8>() + read<U8>()", "1\t2\t3", 6);

// Boolean conversion
validate("read()", "true", 1);
validate("read()", "false", 0);

// Default value (no input)
validate("read()", "", 0);
validate("read<U8>()", "", 0);
