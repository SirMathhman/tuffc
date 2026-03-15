export type Result<T, E> = Ok<T> | Err<E>;

export class Ok<T> {
  constructor(readonly value: T) {}

  isErr(): this is Err<never> {
    return false;
  }
}

export class Err<E> {
  constructor(readonly error: E) {}

  isErr(): this is Err<E> {
    return true;
  }
}
