import assert from "node:assert/strict";
import test from "node:test";

import { compileTuffAndExecute } from "./compiler";

test("compileTuffAndExecute returns 0 for an empty program", () => {
  assert.strictEqual(compileTuffAndExecute(""), 0);
});
