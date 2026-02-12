import { Result, ok, err } from "./result";

export function interpret(input: string): Result<number, string> {
  if (input === "") {
    return ok(0);
  }
  const parsed = parseInt(input, 10);
  if (isNaN(parsed)) {
    return err("Not implemented");
  }
  return ok(parsed);
}
