import { transformIfElseToTernary } from "./src/transformations/transformations-if-expr";
import { wrapBlockExpressionInInit } from "./src/transformations/transformations-block";
import {
  stripTypeAnnotations,
  transformReadPatterns,
  transformAddressOf,
  transformDereference,
  stripNumericTypeSuffixes,
} from "./src/transformations/transformations";

const test1 = "let x = if (true) 3 else 5; x";

console.log("Input:", test1);
const step1 = wrapBlockExpressionInInit(test1);
console.log("After wrapBlockExpressionInInit:", step1);
const step2 = transformIfElseToTernary(step1);
console.log("After transformIfElseToTernary:", step2);
const step3 = transformReadPatterns(step2);
console.log("After transformReadPatterns:", step3);
const step4 = stripTypeAnnotations(step3);
console.log("After stripTypeAnnotations:", step4);
const step5 = transformAddressOf(step4);
console.log("After transformAddressOf:", step5);
const step6 = transformDereference(step5);
console.log("After transformDereference:", step6);
const step7 = stripNumericTypeSuffixes(step6);
console.log("After stripNumericTypeSuffixes:", step7);
