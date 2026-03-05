import { compile } from "./src/compile";

const test = "let x : I32 = if (false) 1 else if (true) 2 else 3; x";
const result = compile(test);
console.log("Input:", test);
console.log("Result:", JSON.stringify(result, null, 2));
