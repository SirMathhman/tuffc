interface OkResult<T> {
  ok: true;
  value: T;
}

interface ErrResult<E> {
  ok: false;
  error: E;
}

export type Result<T, E> = OkResult<T> | ErrResult<E>;

export function ok<T, E>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function err<T, E>(error: E): Result<T, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is OkResult<T> {
  return result.ok === true;
}

export function isErr<T, E>(result: Result<T, E>): result is ErrResult<E> {
  return result.ok === false;
}
