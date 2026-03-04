interface CompileSuccess {
  value: string;
}

interface CompileError {
  error: string;
}

type Result = CompileSuccess | CompileError;

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function isLetter(char: string): boolean {
  return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
}

function hasTypeSuffix(source: string, i: number): boolean {
  return i < source.length && (isLetter(source[i]) || isDigit(source[i]));
}

export function compile(source: string): Result {
  // Remove type annotations like <U8>, <I32>, etc. and literal suffixes like 100U8
  let transformed = "";
  let i = 0;
  while (i < source.length) {
    if (source[i] === "<") {
      // Skip until closing >
      while (i < source.length && source[i] !== ">") {
        i++;
      }
      i++; // skip the closing >
    } else if (
      source[i] === "-" &&
      i + 1 < source.length &&
      isDigit(source[i + 1])
    ) {
      // Check for negative literals (e.g., -100U8)
      let j = i + 1;
      while (j < source.length && isDigit(source[j])) {
        j++;
      }
      // Check if digits are followed by a type suffix
      if (hasTypeSuffix(source, j)) {
        return { error: "Negative literals are not allowed" };
      }
      transformed += source[i];
      i++;
    } else if (isDigit(source[i])) {
      // Consume all digits and track them
      let numStr = "";
      while (i < source.length && isDigit(source[i])) {
        numStr += source[i];
        transformed += source[i];
        i++;
      }
      // Check for type suffix (letters and digits that follow, like U8, I32, etc.)
      if (hasTypeSuffix(source, i)) {
        let typeEnd = i;
        while (
          typeEnd < source.length &&
          (isLetter(source[typeEnd]) || isDigit(source[typeEnd]))
        ) {
          typeEnd++;
        }
        const typeSuffix = source.substring(i, typeEnd);
        const numValue = parseInt(numStr, 10);
        switch (typeSuffix) {
          case "U8":
            if (numValue > 255) {
              return { error: "Value 256 is out of range for U8 (0-255)" };
            }
            break;
          case "U16":
            if (numValue > 65535) {
              return { error: "Value is out of range for U16 (0-65535)" };
            }
            break;
          case "U32":
            if (numValue > 4294967295) {
              return { error: "Value is out of range for U32 (0-4294967295)" };
            }
            break;
          case "I8":
            if (numValue > 127) {
              return {
                error: "Value 128 is out of range for I8 (-128 to 127)",
              };
            }
            break;
          case "I16":
            if (numValue > 32767) {
              return {
                error: "Value is out of range for I16 (-32768 to 32767)",
              };
            }
            break;
          case "I32":
            if (numValue > 2147483647) {
              return {
                error:
                  "Value is out of range for I32 (-2147483648 to 2147483647)",
              };
            }
            break;
        }
        i = typeEnd;
      }
    } else {
      transformed += source[i];
      i++;
    }
  }
  // Wrap in a return statement
  return { value: `return ${transformed};` };
}
