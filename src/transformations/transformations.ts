export {
  skipTypeAnnotation,
  stripTypeAnnotations,
  stripNumericTypeSuffixes,
} from "./transformations-type-stripping";
export { transformReadPatterns, transformThisAccess } from "./transformations-read-patterns";
export {
  transformAddressOf,
  transformDereference,
} from "./transformations-pointer";
export { wrapBlockExpressionInInit } from "./transformations-block";
export { transformIfElseToTernary } from "./transformations-if-expr";
export { transformComparisonOperators } from "./transformations-comparison";
export { transformWhileLoops } from "./transformations-while";
export { transformFnDeclarations } from "./transformations-fn";
export {
  transformObjectDeclarations,
  transformNamespaceAccess,
} from "./transformations-object";
export { transformMethodCalls } from "./transformations-method-calls";
