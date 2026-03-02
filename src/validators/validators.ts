export {
  validateTypeSuffix,
  validateReassignment,
  checkAssignmentTypeMatch,
} from "./validators-type-checks";
export {
  checkVariableDuplicates,
  checkUndefinedVariables,
  checkReassignments,
} from "./validators-variable-checks";
export {
  checkBlockScopes,
  checkBlockExpressions,
  checkBlockExpressionType,
} from "./validators-block-checks";
export { checkPointerOperators } from "./validators-pointer-checks";
export { checkLogicalOperatorTypes } from "./operators/validators-logical-checks";
export { checkArithmeticOperatorTypes } from "./operators/validators-arithmetic-checks";
export { checkIfConditionTypes } from "./operators/validators-if-checks";
export { checkComparisonOperatorTypes } from "./operators/validators-comparison-checks";
