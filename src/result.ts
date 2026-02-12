export interface DescriptiveError {
  /** The thing that caused the error */
  source: string;
  /** The actual error description */
  description: string;
  /** The reason why it's an error */
  reason: string;
  /** The way to fix the error */
  fix: string;
}

export type Result<T, E> = Ok<T> | Err<E>;

export class Ok<T> {
  constructor(readonly value: T) {}

  isSuccess(): this is Ok<T> {
    return true;
  }

  isFailure(): this is Err<never> {
    return false;
  }

  map<U>(fn: (value: T) => U): Result<U, never> {
    return new Ok(fn(this.value));
  }

  mapError<F>(_fn: (error: never) => F): Result<T, F> {
    return this;
  }
}

export class Err<E> {
  constructor(readonly error: E) {}

  isSuccess(): this is Ok<never> {
    return false;
  }

  isFailure(): this is Err<E> {
    return true;
  }

  mapValue<U>(_fn: (value: never) => U): Result<U, E> {
    return this;
  }

  mapError<F>(fn: (error: E) => F): Result<never, F> {
    return new Err(fn(this.error));
  }
}

export function ok<T>(value: T): Result<T, never> {
  return new Ok(value);
}

export function err<E>(error: E): Result<never, E> {
  return new Err(error);
}
