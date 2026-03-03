import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => {
  return { ok: true, value };
};

export const err = <E>(error: E): Result<never, E> => {
  return { ok: false, error };
};

export function compile(source: string,
  requiresFinalExpression = false): Result<string, string> {
  return err("Compilation is not implemented yet");
}