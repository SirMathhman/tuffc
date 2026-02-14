/**
 * @template T
 * @typedef {{ ok: true, value: T }} OkResult
 */

/**
 * @template E
 * @typedef {{ ok: false, error: E }} ErrResult
 */

/**
 * @template T, E
 * @typedef {OkResult<T> | ErrResult<E>} Result
 */

/** @template T */
export function ok(value) {
  return { ok: true, value };
}

/** @template E */
export function err(error) {
  return { ok: false, error };
}

/** @template T, E */
export function isOk(result) {
  return result.ok === true;
}

/** @template T, E */
export function isErr(result) {
  return result.ok === false;
}

/**
 * @template T, E
 * @template U
 * @param {Result<T, E>} result
 * @param {(value: T) => U} fn
 * @returns {Result<U, E>}
 */
export function map(result, fn) {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * @template T, E
 * @template F
 * @param {Result<T, E>} result
 * @param {(error: E) => F} fn
 * @returns {Result<T, F>}
 */
export function mapError(result, fn) {
  if (result.ok) {
    return result;
  }
  return err(fn(result.error));
}
