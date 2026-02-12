import { describe, it, expect } from "bun:test";
import { CompileError, compileTuffToC } from "../src/index";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

function expectValid(source: string, args: string[], exitCode: number) {
  const cCode = compileTuffToC(source);

  // Write C code to a temp file
  const tmpDir = tmpdir();
  const sourceFile = join(tmpDir, "tuff_test_" + Date.now() + ".c");
  const exeFile = join(
    tmpDir,
    "tuff_test_" + Date.now() + (process.platform === "win32" ? ".exe" : ""),
  );

  try {
    writeFileSync(sourceFile, cCode);

    // Compile with clang
    execSync('clang -o "' + exeFile + '" "' + sourceFile + '"', {
      stdio: "pipe",
    });

    // Run the executable and capture exit code
    let actualExitCode = 0;
    try {
      execSync(
        '"' + exeFile + '" ' + args.map((arg) => '"' + arg + '"').join(" "),
        {
          stdio: "pipe",
        },
      );
    } catch (error: unknown) {
      actualExitCode = (error as any).status || 1;
    }

    expect(actualExitCode).toBe(exitCode);
  } finally {
    // Clean up temp files
    if (existsSync(sourceFile)) unlinkSync(sourceFile);
    if (existsSync(exeFile)) unlinkSync(exeFile);
  }
}

function expectInvalid(source: string) {
  expect(() => compileTuffToC(source)).toThrow(CompileError);
}

describe("The compiler", () => {
  it("compiles an empty program and produces exit code 0", () => {
    expectValid("", [], 0);
  });

  it("compiles a numeric literal and uses it as an exit code", () => {
    expectValid("100", [], 100);
  });

  it("compiles a typed numeric literal and uses it as an exit code", () => {
    expectValid("100U8", [], 100);
  });

  it("fails to compile an undefined value", () => {
    expectInvalid("undefined");
  });

  it("fails to compile a negative U8 literal", () => {
    expectInvalid("-100U8");
  });

  it("fails to compile a U8 literal out of range (256)", () => {
    expectInvalid("256U8");
  });

  it("compiles U16 type", () => {
    expectValid("100U16", [], 100);
  });

  it("compiles U32 type", () => {
    expectValid("100000U32", [], 100000 % 256);
  });

  it("compiles U64 type", () => {
    expectValid("50U64", [], 50);
  });

  it("compiles I8 type with positive value", () => {
    expectValid("100I8", [], 100);
  });

  it("compiles I16 type with positive value", () => {
    expectValid("1000I16", [], 1000 % 256);
  });

  it("compiles I32 type with positive value", () => {
    expectValid("100000I32", [], 100000 % 256);
  });

  it("compiles I64 type with positive value", () => {
    expectValid("50I64", [], 50);
  });

  it("fails to compile lowercase u8 (case sensitivity)", () => {
    expectInvalid("100u8");
  });

  it("fails to compile lowercase i8 (case sensitivity)", () => {
    expectInvalid("100i8");
  });

  it("fails to compile invalid type suffix", () => {
    expectInvalid("100U7");
  });

  it("accesses argument length", () => {
    expectValid("__args__[0].length", ["100"], 3);
  });

  it("adds number to argument length", () => {
    expectValid("__args__[0].length + 3U8", ["100"], 6);
  });
});
