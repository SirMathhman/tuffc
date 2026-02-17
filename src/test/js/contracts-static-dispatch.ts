// @ts-nocheck
import {
  expectCompileFailCode as expectFailCode,
  expectCompileOk as expectOk,
} from "./compile-test-utils.ts";
import { compileSourceResult } from "../../main/js/compiler.ts";
import { runMainFromJs } from "./js-runtime-test-utils.ts";

expectOk(
  "contracts-static-dispatch-ok",
  [
    "contract HasLen {",
    "  fn len(*this) : I32;",
    "}",
    "struct Car { name : *Str }",
    "fn makeCar(name : *Str) : Car => {",
    "  into HasLen;",
    "  Car { name: name }",
    "}",
    "fn len(this : Car) : I32 => 1;",
    "fn use<T : HasLen>(value : T) : I32 => value.len();",
    'fn main() : I32 => use(makeCar("Roadster"));',
    "",
  ].join("\n"),
  { backend: "stage0" },
);

expectOk(
  "lifetime-keyword-stage0-ok",
  [
    "fn main() : I32 => {",
    "  let seed : I32 = 41;",
    "  lifetime t {",
    "    let bump : I32 = seed + 1;",
    "  }",
    "  seed + 1",
    "}",
    "",
  ].join("\n"),
  { backend: "stage0" },
);

expectOk(
  "lifetimes-remains-identifier-stage0",
  [
    "fn lifetimes(value : I32) : I32 => value + 1;",
    "fn main() : I32 => lifetimes(41);",
    "",
  ].join("\n"),
  { backend: "stage0" },
);

expectFailCode(
  "lifetime-missing-binder-stage0",
  [
    "fn main() : I32 => {",
    "  lifetime {",
    "    1;",
    "  }",
    "  0",
    "}",
    "",
  ].join("\n"),
  "E_PARSE_EXPECTED_TOKEN",
  { backend: "stage0" },
);

expectOk(
  "lifetime-multi-binders-stage0-ok",
  [
    "fn main() : I32 => {",
    "  let seed : I32 = 41;",
    "  let alt : I32 = 5;",
    "  lifetime a, b {",
    "    let p : *a I32 = &seed;",
    "    let q : *b mut I32 = &mut alt;",
    "  }",
    "  seed + 1",
    "}",
    "",
  ].join("\n"),
  { backend: "stage0" },
);

expectFailCode(
  "lifetime-undefined-in-pointer-stage0",
  [
    "fn main() : I32 => {",
    "  let seed : I32 = 41;",
    "  let p : *a I32 = &seed;",
    "  seed",
    "}",
    "",
  ].join("\n"),
  "E_RESOLVE_UNDEFINED_LIFETIME",
  { backend: "stage0" },
);

expectFailCode(
  "lifetime-duplicate-binders-stage0",
  [
    "fn main() : I32 => {",
    "  lifetime a, a {",
    "    1;",
    "  }",
    "  0",
    "}",
    "",
  ].join("\n"),
  "E_RESOLVE_DUPLICATE_LIFETIME",
  { backend: "stage0" },
);

expectFailCode(
  "contracts-static-dispatch-missing-into",
  [
    "contract HasLen {",
    "  fn len(*this) : I32;",
    "}",
    "struct Bike { name : *Str }",
    "fn makeBike(name : *Str) : Bike => Bike { name: name };",
    "fn len(this : Bike) : I32 => 1;",
    "fn use<T : HasLen>(value : T) : I32 => value.len();",
    'fn main() : I32 => use(makeBike("Commuter"));',
    "",
  ].join("\n"),
  "E_TYPE_CONTRACT_NOT_IMPLEMENTED",
  { backend: "stage0" },
);

expectFailCode(
  "contracts-static-dispatch-missing-method",
  [
    "contract HasLen {",
    "  fn len(*this) : I32;",
    "}",
    "struct Truck { name : *Str }",
    "fn makeTruck(name : *Str) : Truck => {",
    "  into HasLen;",
    "  Truck { name: name }",
    "}",
    "fn len(this : *Str) : I32 => 0;",
    "fn use<T : HasLen>(value : T) : I32 => value.len();",
    'fn main() : I32 => use(makeTruck("Hauler"));',
    "",
  ].join("\n"),
  "E_TYPE_CONTRACT_METHOD_MISSING",
  { backend: "stage0" },
);

const dynamicDispatchSource = [
  "contract Vehicle {",
  "  fn drive(*this) : I32;",
  "}",
  "fn Car(name : *Str) {",
  "  fn drive(self : *mut Car) : I32 => 7;",
  "  into Vehicle;",
  "}",
  "fn main() : I32 => {",
  '  let myCar = Car("Roadster");',
  "  let mut carPtr : Car;",
  "  let vehicle = myCar.into<Vehicle>(&mut carPtr);",
  "  vehicle.drive()",
  "}",
  "",
].join("\n");

const dynamicResult = compileSourceResult(
  dynamicDispatchSource,
  "<contracts-dynamic-dispatch-runtime>",
  { backend: "stage0" },
);
if (!dynamicResult.ok) {
  console.error(
    `Expected dynamic dispatch sample to compile, got: ${dynamicResult.error.message}`,
  );
  process.exit(1);
}

const dynamicValue = runMainFromJs(
  dynamicResult.value.js,
  "contracts-dynamic-dispatch-runtime",
);
if (dynamicValue !== 7) {
  console.error(
    `Expected dynamic dispatch runtime result 7, got ${JSON.stringify(dynamicValue)}`,
  );
  process.exit(1);
}

const dynamicConverterValueSource = [
  "contract Vehicle {",
  "  fn drive(*this) : I32;",
  "}",
  "fn Car(name : *Str) {",
  "  fn drive(self : *mut Car) : I32 => 11;",
  "  into Vehicle;",
  "}",
  "fn main() : I32 => {",
  '  let myCar = Car("Roadster");',
  "  let mut carPtr : Car;",
  "  let converter = myCar.into<Vehicle>;",
  "  let vehicle = converter(&mut carPtr);",
  "  vehicle.drive()",
  "}",
  "",
].join("\n");

const dynamicConverterValueResult = compileSourceResult(
  dynamicConverterValueSource,
  "<contracts-dynamic-dispatch-converter-value-runtime>",
  { backend: "stage0" },
);
if (!dynamicConverterValueResult.ok) {
  console.error(
    `Expected converter-value dispatch sample to compile, got: ${dynamicConverterValueResult.error.message}`,
  );
  process.exit(1);
}

const dynamicConverterValue = runMainFromJs(
  dynamicConverterValueResult.value.js,
  "contracts-dynamic-dispatch-converter-value-runtime",
);
if (dynamicConverterValue !== 11) {
  console.error(
    `Expected converter-value dynamic dispatch runtime result 11, got ${JSON.stringify(dynamicConverterValue)}`,
  );
  process.exit(1);
}

expectFailCode(
  "contracts-into-use-after-move",
  [
    "contract Vehicle {",
    "  fn drive(*this) : I32;",
    "}",
    "fn Car(name : *Str) {",
    "  fn drive(self : *mut Car) : I32 => 7;",
    "  into Vehicle;",
    "}",
    "fn main() : I32 => {",
    '  let myCar = Car("Roadster");',
    "  let mut carPtr : Car;",
    "  let _vehicle = myCar.into<Vehicle>(&mut carPtr);",
    "  myCar.drive()",
    "}",
    "",
  ].join("\n"),
  "E_BORROW_USE_AFTER_MOVE",
  { backend: "stage0" },
);

expectFailCode(
  "contracts-into-value-extract-use-after-move",
  [
    "contract Vehicle {",
    "  fn drive(*this) : I32;",
    "}",
    "fn Car(name : *Str) {",
    "  fn drive(self : *mut Car) : I32 => 7;",
    "  into Vehicle;",
    "}",
    "fn main() : I32 => {",
    '  let myCar = Car("Roadster");',
    "  let _converter = myCar.into<Vehicle>;",
    "  myCar.drive()",
    "}",
    "",
  ].join("\n"),
  "E_BORROW_USE_AFTER_MOVE",
  { backend: "stage0" },
);

console.log("Contract static-dispatch checks passed");
