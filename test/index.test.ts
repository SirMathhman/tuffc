import { expect, test } from "bun:test";
import { compileTSToTuff, compileTuffToTS } from "../src/index";

const transpiler = new Bun.Transpiler();

function expectValid(tuffSource: string, expectedExitCode: number) {
  const tsSource = compileTuffToTS(tuffSource);
  const jsSource = transpiler.transformSync(tsSource);
  const actualExitCode = new Function(jsSource)();
  expect(actualExitCode).toBe(expectedExitCode);

  const tuffSourceRoundTrip = compileTSToTuff(tsSource);
  expect(tuffSourceRoundTrip).toBe(tuffSource);
}

test("empty string compiles to exit code 0", () => {
  expectValid("", 0);
});

test("non-empty input falls back to empty output", () => {
  expect(compileTuffToTS("x")).toBe("");
  expect(compileTSToTuff("x")).toBe("");
});

test("100U8 compiles to exit code 100", () => {
  expectValid("100U8", 100);
});

test("10U8 compiles to exit code 10", () => {
  expectValid("10U8", 10);
});
