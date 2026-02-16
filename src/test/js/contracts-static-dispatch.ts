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
  "  let vehicle = myCar into Vehicle(&mut carPtr);",
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

console.log("Contract static-dispatch checks passed");
