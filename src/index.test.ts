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
testSuccess(
  "(1U8 + 256U16) is U16",
  1,
  'interpret("(1U8 + 256U16) is U16") => 1',
);
testSuccess("struct Ok {}", 0, 'interpret("struct Ok {}") => 0');
testFailure(
  "struct Wrapper {}\nstruct Wrapper {}",
  "interpret duplicate struct declarations => Err",
  "struct Wrapper {}\nstruct Wrapper {}",
  "duplicate",
);
testFailure(
  "struct Wrapper {\n    x : I32;\n    x : I32;\n}",
  "interpret duplicate struct fields => Err",
  "struct Wrapper {\n    x : I32;\n    x : I32;\n}",
  "duplicate",
);
testFailure(
  "struct Wrapper {\n    x : UnknownType;\n}",
  "interpret invalid field type => Err",
  "struct Wrapper {\n    x : UnknownType;\n}",
  "unknown",
);
testSuccess(
  "struct Wrapper<T> {\n    x : T;\n}",
  0,
  "interpret generic struct => 0",
);
testSuccess("let x = 0;\nx", 0, "interpret variable binding => 0");
testFailure(
  "let x = 0;\nlet x = 0;\nx",
  "interpret duplicate variable declarations => Err",
  "let x = 0;\nlet x = 0;\nx",
  "duplicate",
);
testSuccess(
  "let x : U8 = 100;\nx",
  100,
  "interpret typed variable binding => 100",
);
testFailure(
  "let x : U8 = 100U16;\nx",
  "interpret type mismatch in variable assignment => Err",
  "let x : U8 = 100U16;\nx",
  "type",
);
testFailure(
  "let x = 100U16;\nlet y : U8 = x;\ny",
  "interpret type mismatch assigning variable to typed variable => Err",
  "let x = 100U16;\nlet y : U8 = x;\ny",
  "type",
);
testSuccess("1U8 + 2U8 + 3U8", 6, 'interpret("1U8 + 2U8 + 3U8") => 6');
testSuccess("1U8 + 255 + 1U16", 257, 'interpret("1U8 + 255 + 1U16") => 257');
testFailure(
  "100U16 + 200U16 + 1U8",
  'interpret("100U16 + 200U16 + 1U8") => Err',
  "100U16 + 200U16 + 1U8",
  "type",
);
testSuccess(
  "type Temp = I32;\nlet temp : Temp = 100;\ntemp",
  100,
  "interpret type alias => 100",
);
testSuccess(
  "fn get() : I32 => 100;\nget()",
  100,
  "interpret function definition and call => 100",
);
testSuccess(
  "let mut x = 0;\nx = 1;\nx",
  1,
  "interpret mutable variable and reassignment => 1",
);
testSuccess(
  "let mut x : U8 = 0;\nx = 100;\nx",
  100,
  "interpret typed mutable variable and reassignment => 100",
);
testSuccess(
  '"test".length',
  4,
  'interpret string length access => 4',
);
testSuccess(
  'let x : *Str = "test";\nx.length',
  4,
  'interpret string variable property access => 4',
);
