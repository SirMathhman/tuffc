export type OkResult<T> = { ok: true; value: T };
export type ErrResult<E> = { ok: false; error: E };
export type Result<T, E> = OkResult<T> | ErrResult<E>;

export function ok<T>(value: T): OkResult<T> {
  return { ok: true, value };
}

export function err<E>(error: E): ErrResult<E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is OkResult<T> {
  return result.ok === true;
}

export function isErr<T, E>(result: Result<T, E>): result is ErrResult<E> {
  return result.ok === false;
}

export function map<T, E, U>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  if (isErr(result)) {
    return err(result.error);
  }
  return err(new Error("Unreachable Result state") as unknown as E);
}

export function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> {
  if (result.ok) {
    return ok(result.value);
  }
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return err(new Error("Unreachable Result state") as unknown as F);
}
