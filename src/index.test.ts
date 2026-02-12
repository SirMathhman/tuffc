import { expect, test } from "bun:test";
import { interpret } from "./index";

function testSuccess(input: string, expected: number, description: string) {
  test(description, () => {
    const result = interpret(input);
    expect(result.isSuccess()).toBe(true);
    if (result.isSuccess()) {
      expect(result.value).toBe(expected);
    }
  });
}

function testFailure(
  input: string,
  description: string,
  sourceCheck: string,
  reasonCheck: string,
) {
  test(description, () => {
    const result = interpret(input);
    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) {
      const error = result.error;
      expect(error.source).toBe(sourceCheck);
      expect(error.reason).toContain(reasonCheck);
    }
  });
}

testSuccess("", 0, "interpret(empty string) => 0");
testSuccess("100", 100, 'interpret("100") => 100');
testSuccess("100U8", 100, 'interpret("100U8") => 100');

testFailure("-100U8", 'interpret("-100U8") => Err', "-100U8", "unsigned");
testFailure("256U8", 'interpret("256U8") => Err', "256U8", "out of range");
testFailure(
  "not a number",
  "interpret invalid input returns descriptive error",
  "not a number",
  "cannot be converted",
);

testSuccess("100U8 is U8", 1, 'interpret("100U8 is U8") => 1');
testSuccess("100U8 is U16", 0, 'interpret("100U8 is U16") => 0');
testSuccess("100U16 is U8", 0, 'interpret("100U16 is U8") => 0');
testSuccess("100 is I32", 1, 'interpret("100 is I32") => 1');
testSuccess("100 is U8", 0, 'interpret("100 is U8") => 0');
testSuccess("1U8 + 2U8", 3, 'interpret("1U8 + 2U8") => 3');
testSuccess("(1U8 + 2U8)", 3, 'interpret("(1U8 + 2U8)") => 3');
testFailure(
  "1U8 + 255U8",
  'interpret("1U8 + 255U8") => Err',
  "1U8 + 255U8",
  "overflow",
);
testFailure("1U8 + 255", 'interpret("1U8 + 255") => Err', "1U8 + 255", "type");
testSuccess("1U8 + 255U16", 256, 'interpret("1U8 + 255U16") => 256');
