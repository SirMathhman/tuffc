import { expect, test } from "bun:test";
import { compile } from "../src/compiler";
import { main } from "../src/main";

test("compiler scaffold echoes source", () => {
  expect(compile("fn main() => 1;")).toEqual({
    output: "fn main() => 1;",
    diagnostics: [],
  });
});

test("cli scaffold is wired", () => {
  expect(main()).toBe("Tuffc scaffold is ready.");
});
