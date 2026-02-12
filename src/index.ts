import { Result, ok, err, type DescriptiveError } from "./result";

export type InterpretError = DescriptiveError;

export function interpret(input: string): Result<number, InterpretError> {
  if (input === "") {
    return ok(0);
  }

  // Extract numeric part and type suffix
  const numericMatch = input.match(/^(-?\d+)/);
  if (!numericMatch) {
    return err({
      source: input,
      description: "Failed to parse input as a number",
      reason: "The input string cannot be converted to a valid integer",
      fix: "Provide a valid numeric string (e.g., '42', '100', '-5')",
    });
  }

  const numericPart = numericMatch[1];
  const parsed = parseInt(numericPart, 10);

  // Check for unsigned type suffix with negative value
  const typeSuffix = input.slice(numericPart.length);
  if (parsed < 0 && typeSuffix.match(/^U\d+/i)) {
    return err({
      source: input,
      description: "Negative value with unsigned type",
      reason: `Type suffix ${typeSuffix} is unsigned, but the value is negative`,
      fix: `Use a signed type suffix (e.g., 'I8' instead of 'U8') or remove the negative sign`,
    });
  }

  return ok(parsed);
}
