import { Result, ok, err, type DescriptiveError } from "./result";

export type InterpretError = DescriptiveError;

function extractNumericPart(input: string): string | undefined {
  let i = 0;
  if (input[i] === "-") {
    i++;
  }
  if (i >= input.length || !isDigit(input[i])) {
    return undefined;
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

function getUnsignedTypeRange(
  suffix: string,
): { min: number; max: number } | undefined {
  if (!isUnsignedTypeSuffix(suffix)) {
    return undefined;
  }
  const bitSize = parseInt(suffix.slice(1), 10);
  return {
    min: 0,
    max: Math.pow(2, bitSize) - 1,
  };
}

function parseNumericPartOrError(
  input: string,
  numericPart: string | undefined,
): Result<number, InterpretError> {
  if (numericPart === undefined) {
    return err({
      source: input,
      description: "Failed to parse input as a number",
      reason: "The input string cannot be converted to a valid integer",
      fix: "Provide a valid numeric string (e.g., '42', '100', '-5')",
    });
  }
  return ok(parseInt(numericPart, 10));
}

function parseTypedValue(
  input: string,
): Result<{ value: number; suffix: string }, InterpretError> {
  const numericPart = extractNumericPart(input);
  if (numericPart === undefined) {
    return err({
      source: input,
      description: "Failed to parse input as a number",
      reason: "The input string cannot be converted to a valid integer",
      fix: "Provide a valid numeric string (e.g., '42', '100', '-5')",
    });
  }

  const value = parseInt(numericPart, 10);
  const suffix = input.slice(numericPart.length);

  return ok({ value, suffix });
}

export function interpret(input: string): Result<number, InterpretError> {
  if (input === "") {
    return ok(0);
  }

  // Handle parenthesized expressions
  if (input[0] === "(" && input[input.length - 1] === ")") {
    // Recursively evaluate the inner expression
    return interpret(input.slice(1, -1));
  }

  // Check for addition operator
  const plusIndex = input.indexOf(" + ");
  if (plusIndex !== -1) {
    const leftStr = input.slice(0, plusIndex);
    const rightStr = input.slice(plusIndex + 3);

    // Parse left operand
    const leftResult = parseTypedValue(leftStr);
    if (leftResult.isFailure()) {
      return leftResult;
    }
    const leftValue = leftResult.value.value;

    // Parse right operand
    const rightResult = parseTypedValue(rightStr);
    if (rightResult.isFailure()) {
      return rightResult;
    }
    const rightValue = rightResult.value.value;

    // Return the sum
    return ok(leftValue + rightValue);
  }

  // Check for type compatibility check syntax: "<value><suffix> is <target_suffix>"
  const isKeywordIndex = input.indexOf(" is ");
  if (isKeywordIndex !== -1) {
    const valueWithSuffix = input.slice(0, isKeywordIndex);
    const targetTypeSuffix = input.slice(isKeywordIndex + 4);

    // Parse the value with its suffix
    const numericPart = extractNumericPart(valueWithSuffix);
    const parseResult = parseNumericPartOrError(input, numericPart);
    if (parseResult.isFailure()) {
      return parseResult;
    }

    // Extract the original type suffix from the value
    const originalTypeSuffix =
      numericPart !== undefined
        ? valueWithSuffix.slice(numericPart.length)
        : "";

    // Determine the effective type suffix (use I32 as implicit default if no suffix)
    const effectiveTypeSuffix =
      originalTypeSuffix.length > 0 ? originalTypeSuffix : "I32";

    // Check if effective type matches target type
    const typeMatches = effectiveTypeSuffix === targetTypeSuffix;
    return ok(typeMatches ? 1 : 0);
  }

  // Extract numeric part and type suffix
  const numericPart = extractNumericPart(input);
  const parseResult = parseNumericPartOrError(input, numericPart);
  if (parseResult.isFailure()) {
    return parseResult;
  }
  const parsed = parseResult.value;

  // Check for unsigned type suffix with negative value
  const typeSuffix = input.slice(numericPart!.length);
  if (parsed < 0 && isUnsignedTypeSuffix(typeSuffix)) {
    return err({
      source: input,
      description: "Negative value with unsigned type",
      reason: `Type suffix ${typeSuffix} is unsigned, but the value is negative`,
      fix: `Use a signed type suffix (e.g., 'I8' instead of 'U8') or remove the negative sign`,
    });
  }

  // Check if value is within the range of the type suffix
  if (typeSuffix.length > 0) {
    const range = getUnsignedTypeRange(typeSuffix);
    if (range !== undefined && (parsed < range.min || parsed > range.max)) {
      return err({
        source: input,
        description: `Value out of range for type ${typeSuffix}`,
        reason: `The value ${parsed} is out of range for type ${typeSuffix}. Valid range is [${range.min}, ${range.max}]`,
        fix: `Use a value within the range [${range.min}, ${range.max}] or use a larger type suffix`,
      });
    }
  }

  return ok(parsed);
}
