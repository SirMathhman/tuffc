// @ts-nocheck
import { compileSourceResult } from "../../main/js/compiler.ts";

function fail(message, payload) {
  console.error(message);
  if (payload !== undefined) {
    console.error(JSON.stringify(payload, null, 2));
  }
  process.exit(1);
}

const source = `
fn id<T>(x: T): T => x;
fn first<A, B>(a: A, b: B): A => a;

fn main(): I32 {
  let x: I32 = id<I32>(10);
  let y: I32 = id(20);
  let z: I32 = first<I32, Bool>(x, true);
  x + y + z
}
`;

const result = compileSourceResult(source, "<monomorphization-plan>", {
  backend: "selfhost",
  target: "js",
});

if (!result.ok) {
  fail("Monomorphization plan test compile failed", {
    message: result.error?.message,
  });
}

const plan = result.value?.monomorphizationPlan;
if (!plan?.available) {
  fail(
    "Expected monomorphization plan to be available for stage0 compile",
    plan,
  );
}

const specializations = plan.specializations ?? [];
const idI32 = specializations.filter(
  (entry) =>
    entry?.functionName === "id" &&
    Array.isArray(entry?.typeArgs) &&
    entry.typeArgs.join(",") === "I32",
);

if (idI32.length !== 1) {
  fail(
    "Expected exactly one deduplicated id<I32> specialization",
    specializations,
  );
}

const firstI32Bool = specializations.find(
  (entry) =>
    entry?.functionName === "first" &&
    Array.isArray(entry?.typeArgs) &&
    entry.typeArgs.join(",") === "I32,Bool",
);

if (!firstI32Bool) {
  fail("Expected first<I32,Bool> specialization", specializations);
}

if (
  typeof firstI32Bool.mangledName !== "string" ||
  !firstI32Bool.mangledName.includes("first")
) {
  fail(
    "Expected mangled name for first<I32,Bool> specialization",
    firstI32Bool,
  );
}

console.log("Monomorphization plan metadata checks passed");
