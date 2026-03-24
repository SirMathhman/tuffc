import { expect } from "bun:test";
import { compileTSToTuff, compileTuffToTS } from "../src/index";

const transpiler = new Bun.Transpiler();

function assertValid(tuffSource: string, expectedExitCode: number) {
  const tsSource = compileTuffToTS(tuffSource);
  const jsSource = transpiler.transformSync(tsSource);
  const actualExitCode = new Function(jsSource)();
  expect(actualExitCode).toBe(expectedExitCode);

  const tuffSourceRoundTrip = compileTSToTuff(tsSource);
  expect(tuffSourceRoundTrip).toBe(tuffSource);
}
