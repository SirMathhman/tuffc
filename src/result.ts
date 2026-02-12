export type Result<T, E> = Success<T> | Failure<E>;

export class Success<T> {
  constructor(readonly value: T) {}

  isSuccess(): this is Success<T> {
    return true;
  }

  isFailure(): this is Failure<never> {
    return false;
  }

  map<U>(fn: (value: T) => U): Result<U, never> {
    return new Success(fn(this.value));
  }

  mapError<F>(_fn: (error: never) => F): Result<T, F> {
    return this;
  }

  getOrThrow(): T {
    return this.value;
  }
}

export class Failure<E> {
  constructor(readonly error: E) {}

  isSuccess(): this is Success<never> {
    return false;
  }

  isFailure(): this is Failure<E> {
    return true;
  }

  map<U>(_fn: (value: never) => U): Result<U, E> {
    return this;
  }

  mapError<F>(fn: (error: E) => F): Result<never, F> {
    return new Failure(fn(this.error));
  }

  getOrThrow(): never {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error(String(this.error));
  }
}

export function ok<T>(value: T): Result<T, never> {
  return new Success(value);
}

export function err<E>(error: E): Result<never, E> {
  return new Failure(error);
}
