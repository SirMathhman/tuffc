import { expect, test } from "bun:test";
import { interpret } from "./index";

const INDEX_TUFF_INPUT = `struct DescriptiveError {
    source : *Str;
    description : *Str;
    reason : *Str;
    fix : *Str;
}

fn Wrapper(field : I32) : Wrapper => {
    fn get() => field;

    this
}

let temp : Wrapper = Wrapper(100);
temp.get()`;

function testSuccess(input: string, expected: number, description: string) {
  test(description, () => {
    const result = interpret(input);
    if (result.isSuccess()) {
      expect(result.value).toBe(expected);
    } else {
      expect(result.error).toBeUndefined();
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
testFailure(
  "contract Equatable {}\ncontract Equatable {}",
  "interpret duplicate contract declarations => Err",
  "contract Equatable {}\ncontract Equatable {}",
  "duplicate",
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
testSuccess('"test".length', 4, "interpret string length access => 4");
testSuccess(
  'let x : *Str = "test";\nx.length',
  4,
  "interpret string variable property access => 4",
);
testSuccess(
  "fn Success<T>() : I32 => 0;",
  0,
  "interpret generic function definition => 0",
);

testSuccess(
  "fn pass<T>(value : T) => value;\npass(100)",
  100,
  "interpret generic function call with concrete argument => 100",
);

testSuccess(
  "fn pass<T>(value : T) => value;\npass<I32>(100)",
  100,
  "interpret generic function call with explicit type parameter => 100",
);

testSuccess(
  "fn pass<T>(value : T) => this;\npass<I32>(100).value",
  100,
  "interpret generic function call with explicit type parameter and property access => 100",
);

testSuccess(
  "struct DescriptiveError {\n    source : *Str;\n    description : *Str;\n    reason : *Str;\n    fix : *Str;\n}\n\nfn Success<T>() => {\n}",
  0,
  "interpret index.tuff struct and function definitions with optional return type => 0",
);

testFailure(
  "fn Success<T>() : UnknownType => {}",
  "interpret function with unknown return type => Err",
  "fn Success<T>() : UnknownType => {}",
  "unknown return type",
);

testSuccess(
  "let x = 100;\nthis.x",
  100,
  "interpret this.x property access for variable => 100",
);

testSuccess(
  "fn wrapper() => {\n    fn inner() => 0;\n    0\n}",
  0,
  "interpret function with nested function definition => 0",
);

testSuccess(
  "fn Ok() => {\n    fn isSuccess() => true;\n    0\n}\nfn Err() => {\n    fn isSuccess() => false;\n    0\n}",
  0,
  "interpret multiple functions with same nested function names => 0",
);

testSuccess(
  "type Result<T, X> = Ok<T, X> | Err<T, X>;",
  0,
  "interpret generic type alias definition => 0",
);

testSuccess(
  "fn Ok<T, X>(value : T) => {\n    this\n}\n\ntype Result<T, X> = Ok<T, X>;\nlet result : Result<I32, I32> = Ok<I32, I32>(100);",
  0,
  "interpret generic function with parametrized type alias in variable declaration => 0",
);

testSuccess(
  "fn Ok<T>(value : T) => {\n    this\n}\nlet result = Ok<I32>(100);\nresult is Ok",
  1,
  "interpret type check on variable with is operator (no parameters) => 1",
);

testSuccess(
  "fn Ok<T, X>(value : T) => {\n    this\n}\nlet result = Ok<I32, I32>(100);\nresult is Ok<I32, I32>",
  1,
  "interpret parametrized type check with is operator => 1",
);

testSuccess(
  "fn Ok<T, X>(value : T) => {\n    this\n}\nlet result = Ok<I32, I32>(100);\nresult is Ok",
  1,
  "interpret parametrized function call check with base name => 1",
);

testSuccess(
  "fn Ok() => this;\nlet result = Ok();\nresult is Ok",
  1,
  "interpret simple function call check with is operator => 1",
);

testSuccess(
  "fn Ok<T, X>(value : T) => {\n    this\n}\n\ntype Result<T, X> = Ok<T, X>;\nlet result : Result<I32, I32> = Ok<I32, I32>(100);\nresult is Ok<I32, I32>",
  1,
  "interpret parametrized type check with concrete type annotation => 1",
);

testSuccess(
  "fn Ok<T, X>(value : T) => {\n    this\n}\n\ntype Result<T, X> = Ok<T, X>;\nlet result : Result<T, X> = Ok<I32, I32>(100);\nresult is Ok<I32, I32>",
  1,
  "interpret parametrized type check with generic type annotation => 1",
);

testFailure(
  "fn empty() => {}\nfn empty() => {}",
  "interpret duplicate function definitions => Err",
  "fn empty() => {}\nfn empty() => {}",
  "declared multiple times",
);

testSuccess(
  INDEX_TUFF_INPUT,
  100,
  "interpret actual index.tuff content => 100",
);

testFailure(
  "fn pass(x : I32, x : I32) => {}",
  "interpret duplicate function parameters => Err",
  "fn pass(x : I32, x : I32) => {}",
  "declared multiple times",
);

testFailure(
  "fn pass(x : UnknownType) => {}",
  "interpret function with unknown parameter type => Err",
  "fn pass(x : UnknownType) => {}",
  "unknown",
);

testSuccess(
  "fn pass(x : I32) => x;\npass(100)",
  100,
  "interpret function with parameter and function call => 100",
);

testSuccess(
  "fn pass(x : I32, y : I32) => x + y;\npass(25, 75)",
  100,
  "interpret function with multiple parameters and addition => 100",
);

testFailure(
  "fn pass(x : I32, y : I32) => x + y;\npass(25)",
  "interpret function call with missing argument => Err",
  "y",
  "not defined",
);

testFailure(
  "fn pass(x : U16) => x;\npass(100I64)",
  "interpret function call with type mismatch (I64 to U16) => Err",
  "pass(100I64)",
  "type mismatch",
);

testSuccess(
  "fn get() => 100;\nthis.get()",
  100,
  "interpret function call with this. prefix => 100",
);

testSuccess(
  "fn pass(field : I32) => this;\npass(100).field",
  100,
  "interpret function returning this and accessing parameter property => 100",
);

testSuccess(
  "fn pass(field : I32) => {\n    this\n};\npass(100).field",
  100,
  "interpret function returning this inside block and accessing property => 100",
);

testSuccess(
  "fn pass(field : I32) => {\n    fn get() => field;\n    this\n};\npass(100).get()",
  100,
  "interpret function returning this with nested function call => 100",
);

testSuccess(
  "fn Wrapper(field : I32) => {\n    fn get() => field;\n    this\n};\nlet temp = Wrapper(100);\ntemp.get()",
  100,
  "interpret variable storing this context and calling nested function => 100",
);

testSuccess(
  "struct Wrapper {}\nfn Wrapper(field : I32) : Wrapper => {\n    fn get() => field;\n    this\n};\nlet temp : Wrapper = Wrapper(100);\ntemp.get()",
  100,
  "interpret function with struct return type and typed variable assignment => 100",
);

testSuccess(
  "fn Wrapper(field : I32) : Wrapper => {\n    fn get() => field;\n    this\n};\nlet temp : Wrapper = Wrapper(100);\ntemp.get()",
  100,
  "interpret function with inferred type from function name => 100",
);

testSuccess(
  "fn Ok<T, X>(value : T) => {\n    fn isSuccess() => true;\n    fn isFailure() => false;\n    this\n}\n\nfn Err<T, X>(error : X) => {\n    fn isSuccess() => false;\n    fn isFailure() => true;\n    this\n}",
  0,
  "interpret Result type with nested isSuccess and isFailure methods => 0",
);

testSuccess(
  "struct Param {\n    name : *Str;\n}\n\nstruct Func {\n    params : *[Param];\n}",
  0,
  "interpret struct with array field type => 0",
);

testSuccess(
  "fn Ok<T, X>(value : T) => this;\nfn Err<T, X>(error : X) => this;\n\ntype Result<T, X> = Ok<T, X> | Err<T, X>;\ntype Error = Err<I32, *Str>;",
  0,
  "interpret type alias with union syntax => 0",
);

testSuccess(
  "type Result<T, X> = Ok<T, X> | Err<T, X>;\n// Let's see what happens here!",
  0,
  "interpret type declarations with trailing comment => 0",
);

testSuccess(
  "extern fn createSlice<T>() : *[T];\nextern fn getSlice(slice : *[T], index : USize) : T;\nlet slice : *[I32] = createSlice<I32>();",
  0,
  "interpret extern function declarations and generic function call => 0",
);

testSuccess(
  "fn addOnce(this : I32) => this + 1;\n100.addOnce()",
  101,
  "interpret function with this parameter called using dot notation => 101",
);

testSuccess(
  "extern fn createSlice<T>() : *[T];\nextern fn addSlice(this : *[T], element : T) : *[T];\nextern fn getSlice(this : *[T], index : USize) : T;\ncreateSlice<I32>().addSlice(100).getSlice(0)",
  100,
  "interpret chained extern function calls with method notation => 100",
);

testSuccess(
  "contract Equatable<T> {\n    fn isEqualTo(*this, other : T) : Bool;\n}",
  0,
  "interpret contract with generic type parameter => 0",
);

testSuccess(
  "fn Map<K, V>() => {}",
  0,
  "interpret function with multiple generic parameters => 0",
);

testSuccess(
  "fn test() => {\n    let mut slice : *[I32] = 0;\n}",
  0,
  "interpret mutable variable declaration with mut keyword => 0",
);

testSuccess(
  "extern fn createSlice<T>() : *mut [T];\nfn test<T>() => {\n    let mut slice : *mut [T] = createSlice<T>();\n}",
  0,
  "interpret function with mutable slice type and generic parameter => 0",
);

testSuccess(
  "let counter = 0;\nfn empty() => counter += 1;\ncounter",
  1,
  "interpret index.tuff counter increments to 1",
);

testSuccess(
  "/* multi-line comment */\n100",
  100,
  "interpret code with multi-line comment => 100",
);
