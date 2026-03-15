import { Result, Ok, Err } from "./types/result";

interface TypeRange {
  min: number;
  max: number;
}

const TYPE_RANGES = new Map<string, TypeRange>([
  ["U8", { min: 0, max: 255 }],
  ["U16", { min: 0, max: 65535 }],
  ["U32", { min: 0, max: 4294967295 }],
  ["S8", { min: -128, max: 127 }],
  ["S16", { min: -32768, max: 32767 }],
  ["S32", { min: -2147483648, max: 2147483647 }],
  ["F64", { min: -Infinity, max: Infinity }],
]);

export function compileTuffToJS(input: string): Result<string, string> {
  // Check for read<TYPE>() pattern without regex
  if (
    input.startsWith("read<") &&
    input.endsWith(">()") &&
    input.length > "read<>()".length
  ) {
    const typeStart = 5; // "read<" length
    const typeEnd = input.length - 3; // ">()" length
    const typeArg = input.substring(typeStart, typeEnd).toUpperCase();

    // Validate type contains only alphanumeric characters
    let isValidType = true;
    for (let i = 0; i < typeArg.length; i++) {
      const char = typeArg[i];
      if (!((char >= "0" && char <= "9") || (char >= "A" && char <= "Z"))) {
        isValidType = false;
        break;
      }
    }

    if (!isValidType || !TYPE_RANGES.has(typeArg)) {
      return new Err(`Unknown type in read<${typeArg}>(): ${typeArg}`);
    }
    return new Ok(`return parseInt(__stdin, 10)`);
  }

  // Reject negative numbers with type suffixes (e.g., "-100U8")
  if (input.startsWith("-")) {
    let hasDigits = false;
    let hasLetters = false;
    for (let i = 1; i < input.length; i++) {
      const char = input[i];
      if (char >= "0" && char <= "9") {
        hasDigits = true;
      } else if ((char >= "a" && char <= "z") || (char >= "A" && char <= "Z")) {
        hasLetters = true;
      }
    }
    if (hasDigits && hasLetters) {
      return new Err(
        `Negative numbers with type suffixes are not supported: ${input}`,
      );
    }
  }

  if (input === "") {
    return new Ok("return 0");
  }
  // Extract the numeric part and type suffix
  let numericValue = "";
  let suffixStart = -1;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char >= "0" && char <= "9") {
      numericValue += char;
    } else {
      suffixStart = i;
      break;
    }
  }
  // If we found a numeric value, check type constraints
  if (numericValue) {
    if (suffixStart !== -1) {
      const suffix = input.substring(suffixStart).toUpperCase();
      const range = TYPE_RANGES.get(suffix);
      if (range) {
        const value = parseInt(numericValue, 10);
        if (value < range.min || value > range.max) {
          return new Err(
            `Number ${value} exceeds the range for type ${suffix} (${range.min}-${range.max})`,
          );
        }
      }
    }
    return new Ok(`return ${numericValue}`);
  }
  return new Ok(`return "${input}"`);
}
