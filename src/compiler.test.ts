import assert from "node:assert/strict";
import test from "node:test";

import { compileTuffAndExecute } from "./compiler";

test("compileTuffAndExecute returns 0 for an empty program", () => {
  assert.strictEqual(compileTuffAndExecute(""), 0);
});

test("compileTuffAndExecute returns 100 for a U8 literal", () => {
  assert.strictEqual(compileTuffAndExecute("100U8"), 100);
});

test("compileTuffAndExecute returns stdin for read U8", () => {
  assert.strictEqual(compileTuffAndExecute("read<U8>()", "100"), 100);
});
