import { Result, ok, err, type DescriptiveError } from "./result";

export type InterpretError = DescriptiveError;

export function interpret(input: string): Result<number, InterpretError> {
  if (input === "") {
    return ok(0);
  }
  const parsed = parseInt(input, 10);
  if (isNaN(parsed)) {
    return err({
      source: input,
      description: "Failed to parse input as a number",
      reason: "The input string cannot be converted to a valid integer",
      fix: "Provide a valid numeric string (e.g., '42', '100', '-5')",
    });
  }
  return ok(parsed);
}
