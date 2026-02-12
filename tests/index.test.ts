import { CompileError, compileTuffToC } from "../src/index";

function expectValid(source: string, args: string[], exitCode: number) {
  const cCode = compileTuffToC(source);

  /*
    TODO:

    Write the C code to a temp file,
    Compile it with the C compiler,
    Run the resulting executable with the provided args,
    Check that the exit code matches the expected exit code.
    */
}

function expectInvalid(source: string) {
  expect(() => compileTuffToC(source)).toThrow(CompileError);
}

describe("The compiler", () => {
  it("compiles an empty program", () => {
    expect(() => compileTuffToC("")).not.toThrow();
  });

  it("fails to compile an undefined value", () => {
    expectInvalid("undefined");
  });
});
