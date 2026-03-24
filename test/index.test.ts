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

test("1U8 + 2U8 compiles to exit code 3", () => {
  expectValid("1U8 + 2U8", 3);
});

test("let x : U8 = 1U8 + 2U8; x compiles to exit code 3", () => {
  expectValid("let x : U8 = 1U8 + 2U8; x", 3);
});

test("unsupported let initializer falls back to empty output", () => {
  expect(compileTuffToTS("let x : U8 = foo; x")).toBe("");
});

test("unsupported compiled let initializer falls back to empty output", () => {
  expect(compileTSToTuff("const x = foo; return x;")).toBe("");
});
