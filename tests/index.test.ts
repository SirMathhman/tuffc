import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { compileTuffToTS, compileTSToJS } from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function executeTuffCode(tuffSourceCode: string): Promise<number> {
  const tsCode = compileTuffToTS(tuffSourceCode);

  const eslint = new ESLint({ cwd: path.resolve(__dirname, "..") });
  const results = await eslint.lintText(tsCode, { filePath: "generated.ts" });
  const errors = results.flatMap((r) =>
    r.messages.filter((m) => m.severity === 2),
  );
  if (errors.length > 0) {
    throw new Error(
      `ESLint errors in generated code:\n${errors.map((e) => `${e.line}:${e.column} ${e.message}`).join("\n")}`,
    );
  }

  const jsCode = compileTSToJS(tsCode);
  return new Function(`return ${jsCode}`)() as number;
}

test("executeTuffCode('100') returns 100", async () => {
  assert.equal(await executeTuffCode("100"), 100);
});
