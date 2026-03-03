import { compile } from ".";

const validate = (
  source: string,
  stdin: string = "",
  expected: number,
): void => {
  it(source, () => {
    const result = compile(source);
    if (result.ok) {
      const parts = stdin
        .split(" ")
        .flatMap((part) => part.split("\n"))
        .flatMap((part) => part.split("\t"))
        .filter((part) => part.length > 0);

      const readFunc = () => {
        const part = parts.shift()!;
        if (part === "true") return 1;
        if (part === "false") return 0;
        return parseInt(part, 10);
      };

      if (new Function("read", result.value)(readFunc) == expected) {
        return;
      } else {
        expect("Failed to execute: ```" + result.value + "```").toBeUndefined();
      }
    } else {
      expect(result.error).toBeUndefined();
    }
  });
};

const invalidate = (source: string) => {
  it(source, () => {
    const result = compile(source);
    if (result.ok) {
      expect(
        "Expected to fail, but succeeded: ```" + result.value + "```",
      ).toBeUndefined();
    }
  });
};

validate("", "", 0);
invalidate("x");
validate("100", "", 100);
validate("100U8", "", 100);
invalidate("-100U8");
invalidate("256U8");
validate("read<I32>()", "100", 100);
validate("read<I32>() + read<I32>()", "1 2", 3);
validate("let x : I32 = read<I32>(); x + x", "1 3", 2);
validate("let x = 100;", "", 0);
validate("let x : I32 = 100;", "", 0);
invalidate("let x = 0; let x = 0;");
invalidate("let x : U8 = 100U16; x");
validate("let x : U16 = 100U8; x", "", 100);
invalidate("let x = read<U16>(); let y : U8 = x; y");
validate("let x = read<I32>(); let y = x; y", "100", 100);
invalidate("let x = read<U8>(); x = read<U8>(); x");
validate("let mut x = read<U8>(); x = read<U8>(); x", "3 4", 4);
invalidate("let mut x = read<U8>(); x = read<U16>(); x");
validate("let mut x = read<I32>(); x += read<I32>(); x", "1 3", 4);
invalidate("let x = read<I32>(); x += read<I32>(); x");
invalidate("let mut x = true; x += read<I32>(); x");
invalidate("let mut x = 100; x += true || false; x");
invalidate("x += read<I32>(); x");
validate("let x = read<I32>(); let y : *I32 = &x; *y", "100", 100);
invalidate("let x = read<I32>(); let y : *U8 = &x; *y");
invalidate("let x = read<I32>(); *x");
invalidate("let x = read<I32>(); let y = &x; let z : U8 = *y;");
validate("let x : Bool = true; x", "", 1);
validate("let x : Bool = false; x", "", 0);
invalidate("let x = true; let y = false; x + y");
validate("let x = true; let y = false; x || y", "", 1);
validate("let x = true; let y = false; x && y", "", 0);
invalidate("let x = 0; let y = 1; x || y");
validate("let x = read<I32>(); let y = read<I32>(); x < y", "3 4", 1);
validate("let x = read<Bool>(); x", "true", 1);
validate("let x = if (true) 3 else 5; x", "", 3);
invalidate("let x = if (100) 3 else 5; x");
invalidate("let x = if (true) 3 else true; x");
invalidate("let x : Bool = if (true) 3 else 5; x");
validate("let x = if (false) 2 else if (false) 3 else 4; x", "", 4);
validate("let x = { let y = 100; y }; x", "", 100);
invalidate("let x = { let y = 100; }; x");
invalidate("let x = { let y = 100; y }; y");
validate("let x : I64 = { let y : I64 = 100; y }; x", "", 100);
invalidate("let x : U8 = { let y : I64 = 100; y }; x");
validate("{}", "", 0);
validate("{} read<I32>()", "100", 100);
validate("let x = read<I32>(); {} x", "100", 100);
validate("let mut x = read<I32>(); { x = read<I32>(); } x", "1 2", 2);
invalidate("{ let mut x = read<I32>(); } x = read<I32>(); x");
validate(
  "let mut i = 0; let max = read<I32>(); let mut sum = 0; while (i < max) { sum += i; i += 1; }; sum",
  "10",
  45,
);
validate(
  "type MyAlias = I32; let temp : MyAlias = read<I32>(); temp",
  "100",
  100,
);
invalidate(
  "type MyAlias = I32; type MyAlias = I32; let temp : MyAlias = read<I32>(); temp",
);
invalidate("type I32 = U64;");
validate(
  "let mut x = 0; let y : *mut I32 = &mut x; *y = read<I32>(); x",
  "100",
  100,
);
validate("fn empty() => {}", "", 0);
invalidate("fn empty() => {} fn empty() => {}");
invalidate("fn add(first : I32, first : I32) => {}");
invalidate("let x = 0; fn doSomething(x : I32) => {}");
invalidate("let doSomething = 0; fn doSomething() => {}");
validate(
  "fn add(first : I32, second : I32) : I32 => { return first + second; } add(read<I32>(), read<I32>())",
  "3 4",
  7,
);
validate(
  "fn add(first : I32, second : I32) : I32 => first + second; add(read<I32>(), read<I32>())",
  "3 4",
  7,
);
validate(
  "fn sumFromInput(times : I32) : I32 => { return times < 1 ? 0 : read<I32>() + sumFromInput(times - 1); } sumFromInput(read<I32>())",
  "3 10 20 30",
  60,
);
validate("let x = read<I32>(); this.x", "100", 100);
validate("fn get() => 100; this.get()", "", 100);
validate("fn Wrapper(value : I32) => this; Wrapper(100).value", "", 100);
invalidate("undefinedFunction()");
invalidate("fn pass(value : I32) => value; pass()");
invalidate("fn pass(value : I32) => value; pass(true)");
validate(
  "fn Wrapper(value : I32) => this; let test : Wrapper = Wrapper(100); test.value",
  "",
  100,
);
validate("struct Empty {}", "", 0);
validate("struct MyStruct { x : I32; y : I32; }", "", 0); // struct with fields should compile

// invalid struct field syntax examples
invalidate("struct Bad { x I32; }"); // missing colon
invalidate("struct Bad { x : Foo; }"); // invalid type

invalidate("struct Empty {} struct Empty");
// ensure duplicate struct with braces also errors
invalidate("struct MyStruct {} struct MyStruct {}");
validate(
  "fn add(x : I32, y : I32) => x + y; fn multiply(x : I32, y : I32) => x * y; let func : (I32, I32) => I32 = if (read<Bool>()) add else multiply; func(3, 4)",
  "false",
  12,
);
