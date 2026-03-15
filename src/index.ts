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
  // Check for binary operations (e.g., "100U8 + 50U8")
  const binaryOps = ["+", "-", "*", "/"];
  for (const op of binaryOps) {
    const opIndex = input.indexOf(` ${op} `);
    if (opIndex !== -1) {
      const leftStr = input.substring(0, opIndex);
      const rightStr = input.substring(opIndex + 3); // Skip " op "

      // Parse left operand
      const leftResult = parseTypedNumber(leftStr);
      if (leftResult.isErr()) {
        return leftResult;
      }
      const { value: leftValue, type: leftType } = leftResult.value;

      // Parse right operand
      const rightResult = parseTypedNumber(rightStr);
      if (rightResult.isErr()) {
        return rightResult;
      }
      const { value: rightValue, type: rightType } = rightResult.value;

      // For now, require both sides to be the same type
      if (leftType !== rightType) {
        return new Err(
          `Binary operation requires both operands to have the same type, got ${leftType} and ${rightType}`,
        );
      }

      // Evaluate the operation
      let result: number;
      if (op === "+") {
        result = leftValue + rightValue;
      } else if (op === "-") {
        result = leftValue - rightValue;
      } else if (op === "*") {
        result = leftValue * rightValue;
      } else {
        // op === "/"
        result = Math.floor(leftValue / rightValue);
      }

      // Validate result against type constraints
      const range = TYPE_RANGES.get(leftType);
      if (range && (result < range.min || result > range.max)) {
        return new Err(
          `Result ${result} of operation exceeds the range for type ${leftType} (${range.min}-${range.max})`,
        );
      }

      return new Ok(`return ${result}`);
    }
  }

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
      if (!(isDigit(char) || isLetter(char))) {
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
    const { hasDigits, hasLetters } = scanForAlphanumeric(input, 1);
    if (hasDigits && hasLetters) {
      return new Err(
        `Negative numbers with type suffixes are not supported: ${input}`,
      );
    }
  }

  if (input === "") {
    return new Ok("return 0");
  }

  // Try to parse as a single typed number
  const parseResult = parseTypedNumber(input);
  if (parseResult.isErr()) {
    // If parsing completely failed, treat it as a string literal
    // But only if it's not a typed number that failed validation
    if (!containsTypeSuffix(input)) {
      return new Ok(`return "${input}"`);
    }
    // If it has a type suffix but failed parsing, return the error
    return parseResult;
  }

  return new Ok(`return ${parseResult.value.value}`);
}

function containsTypeSuffix(input: string): boolean {
  if (!input) return false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (!isDigit(char) && !isLetter(char)) {
      return false; // Has non-alphanumeric, not just number + type
    }
  }
  const { hasDigits, hasLetters } = scanForAlphanumeric(input, 0);
  return hasDigits && hasLetters;
}

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function isLetter(char: string): boolean {
  return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
}

interface AlphanumericScan {
  hasDigits: boolean;
  hasLetters: boolean;
}

function scanForAlphanumeric(
  input: string,
  startIndex: number,
): AlphanumericScan {
  let hasDigits = false;
  let hasLetters = false;
  for (let i = startIndex; i < input.length; i++) {
    const char = input[i];
    if (isDigit(char)) {
      hasDigits = true;
    } else if (isLetter(char)) {
      hasLetters = true;
    }
  }
  return { hasDigits, hasLetters };
}

interface ParsedTypedNumber {
  value: number;
  type: string;
}

function parseTypedNumber(input: string): Result<ParsedTypedNumber, string> {
  // Extract the numeric part and type suffix
  let numericValue = "";
  let suffixStart = -1;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (isDigit(char)) {
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
        return new Ok({ value, type: suffix });
      }
    }
    const value = parseInt(numericValue, 10);
    return new Ok({ value, type: "untyped" });
  }

  return new Err(`Unable to parse: ${input}`);
}
