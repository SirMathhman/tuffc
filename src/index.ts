import { Result, ok, err, type DescriptiveError } from "./result";

export type InterpretError = DescriptiveError;

function extractNumericPart(input: string): string | null {
  let i = 0;
  if (input[i] === "-") {
    i++;
  }
  if (i >= input.length || !isDigit(input[i])) {
    return null;
  }
  while (i < input.length && isDigit(input[i])) {
    i++;
  }
  return input.slice(0, i);
}

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function isUnsignedTypeSuffix(suffix: string): boolean {
  if (suffix.length < 2 || suffix[0] !== "U") {
    return false;
  }
  const typeSizeStr = suffix.slice(1);
  if (typeSizeStr.length === 0) {
    return false;
  }
  for (let i = 0; i < typeSizeStr.length; i++) {
    if (!isDigit(typeSizeStr[i])) {
      return false;
    }
  }
  return true;
}

export function interpret(input: string): Result<number, InterpretError> {
  if (input === "") {
    return ok(0);
  }

  // Extract numeric part and type suffix
  const numericPart = extractNumericPart(input);
  if (numericPart === null) {
    return err({
      source: input,
      description: "Failed to parse input as a number",
      reason: "The input string cannot be converted to a valid integer",
      fix: "Provide a valid numeric string (e.g., '42', '100', '-5')",
    });
  }

  const parsed = parseInt(numericPart, 10);

  // Check for unsigned type suffix with negative value
  const typeSuffix = input.slice(numericPart.length);
  if (parsed < 0 && isUnsignedTypeSuffix(typeSuffix)) {
    return err({
      source: input,
      description: "Negative value with unsigned type",
      reason: `Type suffix ${typeSuffix} is unsigned, but the value is negative`,
      fix: `Use a signed type suffix (e.g., 'I8' instead of 'U8') or remove the negative sign`,
    });
  }

  return ok(parsed);
}
