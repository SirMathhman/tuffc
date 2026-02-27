/** Shared assertion helpers for test scripts. */

function _failAssert(label: string, expected: unknown, actual: unknown): never {
  console.error(
    `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
  process.exit(1);
}

export function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    _failAssert(label, expected, actual);
  }
}

/** Like assertEq but serialises both sides with JSON.stringify before comparing. */
export function assertEqual(
  actual: unknown,
  expected: unknown,
  label: string,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    _failAssert(label, expected, actual);
  }
}

export function assertTrue(cond: boolean, label: string): void {
  if (!cond) {
    console.error(`${label}: assertion failed`);
    process.exit(1);
  }
}
