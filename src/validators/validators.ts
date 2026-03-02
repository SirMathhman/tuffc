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
export { checkLogicalOperatorTypes } from "./validators-logical-checks";
export { checkArithmeticOperatorTypes } from "./validators-arithmetic-checks";
