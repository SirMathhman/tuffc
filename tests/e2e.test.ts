import { expect, test } from "bun:test";
import { executeCompiledCode } from "./e2e/helpers";

const fixtures = [
  { name: "hello", expected: "Hello, World!" },
  { name: "math", expected: "7" },
  { name: "control-flow", expected: "ok" },
  { name: "functions", expected: "7" },
];

for (const fixture of fixtures) {
  test(`runs e2e fixture: ${fixture.name}`, async () => {
    const source = await Bun.file(`tests/e2e/${fixture.name}.tuff`).text();
    const output = await executeCompiledCode(source);

    expect(output).toBe(fixture.expected);
  });
}

test("rejects a type error in e2e", () => {
  const result = Bun.spawnSync({
    cmd: ["bun", "run", "src/main.ts", "tests/e2e/invalid.tuff", "-o", "tests/e2e/invalid.ts"],
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).not.toBe(0);
  const stderr = new TextDecoder().decode(result.stderr);
  expect(stderr).toContain("Cannot assign");
});