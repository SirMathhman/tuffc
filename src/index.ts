import { Result, Ok, Err } from "./types/result";

enum CompilationErrorCode {
  UNKNOWN_TYPE = "UNKNOWN_TYPE",
  NEGATIVE_WITH_SUFFIX = "NEGATIVE_WITH_SUFFIX",
  TYPE_MISMATCH = "TYPE_MISMATCH",
  VALUE_OUT_OF_RANGE = "VALUE_OUT_OF_RANGE",
  PARSE_ERROR = "PARSE_ERROR",
  UNDEFINED_VARIABLE = "UNDEFINED_VARIABLE",
  UNDECLARED_VARIABLE = "UNDECLARED_VARIABLE",
  IMMUTABLE_ASSIGNMENT = "IMMUTABLE_ASSIGNMENT",
  UNINITIALIZED_VARIABLE = "UNINITIALIZED_VARIABLE",
  UNSUPPORTED_OPERATION = "UNSUPPORTED_OPERATION",
}

interface CompilationError {
  code: CompilationErrorCode;
  erroneousValue: string;
  message: string;
  reason: string;
  fix: string;
}

interface TypeRange {
  min: number;
  max: number;
}

type BinaryOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "&&"
  | "||"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">=";

type BooleanOperator = "&&" | "||" | "==" | "!=";

const BOOL_TYPE = "BOOL";
const VALID_TYPES = "U8, U16, U32, S8, S16, S32, F64, Bool";
const INVALID_TYPE_MESSAGE =
  "is not a recognized type. Valid types are: " + VALID_TYPES;
const VALID_TYPE_NAMES = new Set<string>([
  "U8",
  "U16",
  "U32",
  "S8",
  "S16",
  "S32",
  "F64",
  BOOL_TYPE,
]);

const TYPE_RANGES = new Map<string, TypeRange>([
  ["U8", { min: 0, max: 255 }],
  ["U16", { min: 0, max: 65535 }],
  ["U32", { min: 0, max: 4294967295 }],
  ["S8", { min: -128, max: 127 }],
  ["S16", { min: -32768, max: 32767 }],
  ["S32", { min: -2147483648, max: 2147483647 }],
  ["F64", { min: -Infinity, max: Infinity }],
]);

const BINARY_OPS: BinaryOperator[] = [
  "&&",
  "||",
  "==",
  "!=",
  "<=",
  ">=",
  "<",
  ">",
  "+",
  "-",
  "*",
  "/",
];

interface OperatorPosition {
  op: BinaryOperator;
  index: number;
  length: number;
}

function getOperatorsWithPositions(input: string): OperatorPosition[] {
  let positions: OperatorPosition[] = [];
  let index = 0;

  while (index < input.length) {
    let matched = false;

    for (const op of BINARY_OPS) {
      if (
        input.substring(index, index + op.length) === op &&
        index > 0 &&
        index + op.length < input.length &&
        input[index - 1] === " " &&
        input[index + op.length] === " "
      ) {
        positions = [...positions, { op, index, length: op.length }];
        index += op.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      index++;
    }
  }

  return positions;
}

function extractOperands(
  input: string,
  operatorsWithPositions: OperatorPosition[],
): string[] {
  let leadingOperands: string[] = [];

  for (let position = 0; position < operatorsWithPositions.length; position++) {
    const index = operatorsWithPositions[position].index;
    const startIndex =
      position === 0
        ? 0
        : operatorsWithPositions[position - 1].index +
          operatorsWithPositions[position - 1].length +
          1;
    leadingOperands = [
      ...leadingOperands,
      input.substring(startIndex, index - 1).trim(),
    ];
  }

  const finalOperandStartIndex =
    operatorsWithPositions[operatorsWithPositions.length - 1].index +
    operatorsWithPositions[operatorsWithPositions.length - 1].length +
    1;
  return [...leadingOperands, input.substring(finalOperandStartIndex).trim()];
}

function isBooleanType(typeName: string): boolean {
  return typeName === BOOL_TYPE;
}

function parseBooleanLiteral(input: string): number | undefined {
  if (input === "true") {
    return 1;
  }
  if (input === "false") {
    return 0;
  }
  return undefined;
}

function generateReadBoolOperandCode(stdinIndex: number): string {
  return "(__stdinValues[" + stdinIndex + '] === "true" ? 1 : 0)';
}

function generateStandaloneReadBoolCode(): string {
  return 'return (__stdin === "true" ? 1 : 0)';
}

function generateReadCodeForType(typeName: string, stdinIndex: number): string {
  return isBooleanType(typeName)
    ? generateReadBoolOperandCode(stdinIndex)
    : generateReadOperandCode(stdinIndex);
}

function compileStandaloneReadExpression(typeName: string): string {
  return isBooleanType(typeName)
    ? generateStandaloneReadBoolCode()
    : "return parseInt(__stdin, 10)";
}

function isArithmeticOperator(operator: BinaryOperator): boolean {
  return (
    operator === "+" || operator === "-" || operator === "*" || operator === "/"
  );
}

function isComparisonOperator(operator: BinaryOperator): boolean {
  return (
    operator === "==" ||
    operator === "!=" ||
    operator === "<" ||
    operator === "<=" ||
    operator === ">" ||
    operator === ">="
  );
}

function isOrderingComparisonOperator(operator: BinaryOperator): boolean {
  return (
    operator === "<" ||
    operator === "<=" ||
    operator === ">" ||
    operator === ">="
  );
}

function hasStandaloneAssignment(input: string): boolean {
  const letPos = input.indexOf("let ");
  const searchEnd = letPos === -1 ? input.length : letPos;
  for (let i = 0; i < searchEnd; i++) {
    if (input[i] === "=") {
      const previous = i > 0 ? input[i - 1] : "";
      const next = i < input.length - 1 ? input[i + 1] : "";
      if (
        previous !== "=" &&
        previous !== "!" &&
        previous !== "<" &&
        previous !== ">" &&
        next !== "="
      ) {
        return true;
      }
    }
  }
  return false;
}

function createChainedComparisonError(input: string): CompilationError {
  return {
    code: CompilationErrorCode.UNSUPPORTED_OPERATION,
    erroneousValue: input,
    message: "Unable to parse input",
    reason: "Chained comparison operators are not supported",
    fix: "Compare one pair of operands at a time",
  };
}

function createNumericComparisonTypeMismatchError(
  input: string,
): CompilationError {
  return {
    code: CompilationErrorCode.TYPE_MISMATCH,
    erroneousValue: input,
    message: "Comparison operands must have the same type",
    reason: "Operators <, <=, >, and >= only support numeric operands",
    fix: "Use numeric operands, or use == / != for Bool values",
  };
}

function createUnsupportedBooleanOperatorError(
  input: string,
): CompilationError {
  return {
    code: CompilationErrorCode.TYPE_MISMATCH,
    erroneousValue: input,
    message: "Unable to parse input",
    reason: "Boolean values only support &&, ||, !, ==, and !=",
    fix: "Use boolean operators instead of arithmetic with Bool values",
  };
}

function getUnsupportedBooleanOperatorError(
  input: string,
  operators: BinaryOperator[],
): CompilationError | undefined {
  for (const operator of operators) {
    if (isArithmeticOperator(operator)) {
      return createUnsupportedBooleanOperatorError(input);
    }
  }

  return undefined;
}

function hasChainedOrderingComparison(operators: BinaryOperator[]): boolean {
  return operators.length > 1 && operators.some(isOrderingComparisonOperator);
}

interface BinaryOperandValue {
  type: string;
  isRead: boolean;
  value?: number;
  jsCode?: string;
}

interface ExpressionOperandValue extends BinaryOperandValue {
  jsCode: string;
  isRuntime: boolean;
}

interface ReadAwareOperand {
  isRead: boolean;
}

function buildOperandCodes<T extends ReadAwareOperand>(
  operands: T[],
  readCodeFactory: (readIndex: number) => string,
  literalCodeFactory: (operand: T) => string,
): string[] {
  let operandCodes: string[] = [];
  let readIndex = 0;

  for (const operand of operands) {
    if (operand.isRead) {
      operandCodes = [...operandCodes, readCodeFactory(readIndex)];
      readIndex++;
    } else {
      operandCodes = [...operandCodes, literalCodeFactory(operand)];
    }
  }

  return operandCodes;
}

function createBooleanOperand(
  value: number,
  isRead: boolean,
): BinaryOperandValue {
  return {
    type: BOOL_TYPE,
    isRead,
    value,
  };
}

function evaluateBooleanChain(
  operators: BooleanOperator[],
  parsedOperands: BinaryOperandValue[],
): number {
  let result = parsedOperands[0].value as number;

  for (let i = 0; i < operators.length; i++) {
    const operator = operators[i];
    const nextValue = parsedOperands[i + 1].value as number;

    if (operator === "&&") {
      result = result !== 0 && nextValue !== 0 ? 1 : 0;
    } else if (operator === "||") {
      result = result !== 0 || nextValue !== 0 ? 1 : 0;
    } else if (operator === "==") {
      result = result === nextValue ? 1 : 0;
    } else if (operator === "!=") {
      result = result !== nextValue ? 1 : 0;
    }
  }

  return result;
}

function stripReturnStatement(code: string): string {
  return code.substring(7);
}

function offsetStdinValueIndexes(code: string, offset: number): string {
  const marker = "__stdinValues[";
  let result = "";
  let index = 0;

  while (index < code.length) {
    if (code.substring(index, index + marker.length) === marker) {
      let digitIndex = index + marker.length;
      let digits = "";

      while (digitIndex < code.length && isDigit(code[digitIndex])) {
        digits += code[digitIndex];
        digitIndex++;
      }

      if (digits && digitIndex < code.length && code[digitIndex] === "]") {
        result += marker + (parseInt(digits, 10) + offset) + "]";
        index = digitIndex + 1;
        continue;
      }
    }

    result += code[index];
    index++;
  }

  return result;
}

function countStdinValueReferences(code: string): number {
  const marker = "__stdinValues[";
  let count = 0;
  let index = 0;

  while (index < code.length) {
    if (code.substring(index, index + marker.length) === marker) {
      count++;
      index += marker.length;
      continue;
    }
    index++;
  }

  return count;
}

interface CompiledComparisonExpression {
  type: string;
  code: string;
  readCount: number;
}

function compileComparisonExpression(
  input: string,
  stdinOffset: number,
): Result<CompiledComparisonExpression, CompilationError> {
  const compileResult = compileExpressionWithVariables(input, {});
  if (compileResult.isErr()) {
    return compileResult;
  }

  const expressionCode = stripReturnStatement(compileResult.value);
  const offsetCode = offsetStdinValueIndexes(expressionCode, stdinOffset);
  return new Ok({
    type: BOOL_TYPE,
    code: offsetCode,
    readCount: countStdinValueReferences(expressionCode),
  });
}

function isReadTypeStart(input: string, index: number): boolean {
  return index >= 4 && input.substring(index - 4, index) === "read";
}

function findStatementTerminator(input: string, startIndex: number): number {
  let depth = 0;
  let index = startIndex;

  while (index < input.length) {
    if (input[index] === "<" && isReadTypeStart(input, index)) {
      depth++;
    } else if (input[index] === ">" && depth > 0) {
      depth--;
    } else if (input[index] === ";" && depth === 0) {
      return index;
    }
    index++;
  }

  return input.length;
}

function validateReadTypeArg(typeArg: string): Result<void, CompilationError> {
  let isValidType = true;
  for (let i = 0; i < typeArg.length; i++) {
    const char = typeArg[i];
    if (!(isDigit(char) || isLetter(char))) {
      isValidType = false;
      break;
    }
  }

  if (!isValidType || !VALID_TYPE_NAMES.has(typeArg)) {
    return new Err(
      createUnknownTypeError(
        typeArg,
        "Unknown type parameter in read<>() expression",
      ),
    );
  }

  return new Ok(void 0);
}

function generateReadOperandCode(stdinIndex: number): string {
  return "parseInt(__stdinValues[" + stdinIndex + "], 10)";
}

function extractReadTypeArg(operand: string): Result<string, CompilationError> {
  if (
    operand.startsWith("read<") &&
    operand.endsWith(">()") &&
    operand.length > "read<>()".length
  ) {
    const typeStart = 5;
    const typeEnd = operand.length - 3;
    const typeArg = operand.substring(typeStart, typeEnd).toUpperCase();

    const validationResult = validateReadTypeArg(typeArg);
    if (validationResult.isErr()) {
      return validationResult;
    }

    return new Ok(typeArg);
  }

  return new Err({
    code: CompilationErrorCode.PARSE_ERROR,
    erroneousValue: operand,
    message: "Invalid read pattern",
    reason: "Does not match read<TYPE>() pattern",
    fix: "Use format: read<TYPE>() where TYPE is one of the valid types",
  });
}

function findMatchingBrace(input: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < input.length; i++) {
    if (input[i] === "{") {
      depth++;
    } else if (input[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function startsWithBinaryOperator(s: string): boolean {
  for (const op of BINARY_OPS) {
    if (s.startsWith(op + " ")) {
      return true;
    }
  }
  return false;
}

function compileBlockAsIIFE(
  blockContent: string,
): Result<string, CompilationError> {
  const result = compileTuffToJS(blockContent);
  if (result.isErr()) {
    return result;
  }
  return new Ok("(function(){ " + result.value + "; })()");
}

function parseOperandForBinaryOp(
  operand: string,
): Result<BinaryOperandValue, CompilationError> {
  if (operand.startsWith("{")) {
    const blockEnd = findMatchingBrace(operand, 0);
    if (blockEnd === operand.length - 1) {
      const blockContent = operand.substring(1, blockEnd).trim();
      const blockResult = compileBlockAsIIFE(blockContent);
      if (blockResult.isErr()) {
        return blockResult;
      }
      return new Ok({ type: "untyped", isRead: false, value: undefined, jsCode: blockResult.value });
    }
  }

  const readTypeResult = extractReadTypeArg(operand);
  if (!readTypeResult.isErr()) {
    const okResult = readTypeResult as Ok<string>;
    return new Ok({ type: okResult.value, isRead: true });
  }

  if (readTypeResult.error.code === CompilationErrorCode.UNKNOWN_TYPE) {
    return readTypeResult;
  }

  const booleanValue = parseBooleanLiteral(operand);
  if (booleanValue !== undefined) {
    return new Ok(createBooleanOperand(booleanValue, false));
  }

  const parseResult = parseTypedNumber(operand);
  if (parseResult.isErr()) {
    if (isIdentifier(operand)) {
      return new Err({
        code: CompilationErrorCode.UNDEFINED_VARIABLE,
        erroneousValue: operand,
        message: "Unable to parse input",
        reason: "Undefined variable '" + operand + "'",
        fix: "Declare the variable before using it",
      });
    }
    return parseResult;
  }

  return new Ok({
    type: parseResult.value.type,
    isRead: false,
    value: parseResult.value.value,
  });
}

function parseExpressionOperand(
  operand: string,
  variableContext: VariableContext,
): Result<ExpressionOperandValue, CompilationError> {
  const binding = variableContext[operand];
  if (binding !== undefined) {
    return new Ok({
      type: binding.type,
      isRead: false,
      value: binding.value,
      jsCode: binding.jsName,
      isRuntime: true,
    });
  }

  const parseResult = parseOperandForBinaryOp(operand);
  if (parseResult.isErr()) {
    return parseResult;
  }

  if (parseResult.value.isRead) {
    return new Ok({
      ...parseResult.value,
      jsCode: "",
      isRuntime: true,
    });
  }

  if (parseResult.value.jsCode !== undefined) {
    return new Ok({
      type: parseResult.value.type,
      isRead: false,
      value: undefined,
      jsCode: parseResult.value.jsCode,
      isRuntime: true,
    });
  }

  return new Ok({
    ...parseResult.value,
    jsCode: (parseResult.value.value as number).toString(),
    isRuntime: false,
  });
}

function createUnknownTypeError(
  typeName: string,
  message: string,
): CompilationError {
  return {
    code: CompilationErrorCode.UNKNOWN_TYPE,
    erroneousValue: typeName,
    message,
    reason: typeName + " " + INVALID_TYPE_MESSAGE,
    fix: "Use one of the valid types: " + VALID_TYPES,
  };
}

function createVariableDeclarationTypeMismatchError(
  input: string,
  name: string,
  expectedType: string,
  actualType: string,
  isReadInitializer: boolean,
): CompilationError {
  const initializerStyle = isReadInitializer ? "uses" : "is type";
  const exampleInitializer = isReadInitializer ? "read<U8>()" : "50U8;";

  return {
    code: CompilationErrorCode.TYPE_MISMATCH,
    erroneousValue: input,
    message: "Variable type mismatch in declaration",
    reason:
      "Variable " +
      name +
      " is declared as type " +
      expectedType +
      " but initializer " +
      initializerStyle +
      " " +
      actualType,
    fix: "Use matching types (e.g., let x : U8 = " + exampleInitializer + ")",
  };
}

function createVariableDeclarationSyntaxError(
  input: string,
  reason: string,
): CompilationError {
  return {
    code: CompilationErrorCode.PARSE_ERROR,
    erroneousValue: input,
    message: "Invalid variable declaration syntax",
    reason,
    fix: "Use format: let varName : Type = initializer;",
  };
}

function createUndefinedVariableError(
  input: string,
  name: string,
  fix: string,
): CompilationError {
  return {
    code: CompilationErrorCode.UNDEFINED_VARIABLE,
    erroneousValue: input,
    message: "Unable to parse input",
    reason: "Undefined variable '" + name + "'",
    fix,
  };
}

function createImmutableAssignmentError(
  input: string,
  name: string,
): CompilationError {
  return {
    code: CompilationErrorCode.IMMUTABLE_ASSIGNMENT,
    erroneousValue: input,
    message: "Unable to parse input",
    reason: "Variable '" + name + "' is immutable and cannot be reassigned",
    fix: "Use 'let mut' for mutable declarations",
  };
}

function getRangeViolationReason(
  typeName: string,
  range: TypeRange,
  context?: string,
): string {
  let reason =
    "Type " +
    typeName +
    " can only represent values between " +
    range.min +
    " and " +
    range.max;
  if (context) {
    reason += ", but " + context;
  }
  return reason;
}

interface ParsedIfExpression {
  condition: string;
  thenExpr: string;
  elseExpr: string;
}

function parseIfExpression(input: string): ParsedIfExpression | undefined {
  let depth = 0;
  let condEnd = -1;
  for (let i = 3; i < input.length; i++) {
    if (input[i] === "(") {
      depth++;
    } else if (input[i] === ")") {
      depth--;
      if (depth === 0) {
        condEnd = i;
        break;
      }
    }
  }

  if (condEnd === -1) {
    return undefined;
  }

  const condition = input.substring(4, condEnd).trim();
  const afterCond = input.substring(condEnd + 1).trim();

  const elseMarker = " else ";
  const elseIndex = afterCond.indexOf(elseMarker);
  if (elseIndex === -1) {
    return undefined;
  }

  const thenExpr = afterCond.substring(0, elseIndex).trim();
  const elseExpr = afterCond.substring(elseIndex + elseMarker.length).trim();

  if (!condition || !thenExpr || !elseExpr) {
    return undefined;
  }

  return { condition, thenExpr, elseExpr };
}

function compileExpressionWithVariables(
  expr: string,
  variableContext: VariableContext,
): Result<string, CompilationError> {
  const trimmed = expr.trim();

  if (!trimmed) {
    return new Ok("return 0");
  }

  if (trimmed.startsWith("if (")) {
    const parsed = parseIfExpression(trimmed);
    if (parsed !== undefined) {
      const { condition, thenExpr, elseExpr } = parsed;

      const condResult = compileExpressionWithVariables(
        condition,
        variableContext,
      );
      if (condResult.isErr()) {
        return condResult;
      }
      const condCode = stripReturnStatement(condResult.value);
      const condReadCount = countStdinValueReferences(condCode);

      const thenResult = compileExpressionWithVariables(
        thenExpr,
        variableContext,
      );
      if (thenResult.isErr()) {
        return thenResult;
      }
      const rawThenCode = stripReturnStatement(thenResult.value);
      const thenCode = offsetStdinValueIndexes(rawThenCode, condReadCount);
      const thenReadCount = countStdinValueReferences(rawThenCode);

      const elseResult = compileExpressionWithVariables(
        elseExpr,
        variableContext,
      );
      if (elseResult.isErr()) {
        return elseResult;
      }
      const rawElseCode = stripReturnStatement(elseResult.value);
      const elseCode = offsetStdinValueIndexes(
        rawElseCode,
        condReadCount + thenReadCount,
      );

      return new Ok(
        "return (" + condCode + " ? " + thenCode + " : " + elseCode + ")",
      );
    }
  }

  if (trimmed.startsWith("!") && !trimmed.startsWith("!=")) {
    const negatedOperand = trimmed.substring(1).trim();
    const operandResult = parseExpressionOperand(
      negatedOperand,
      variableContext,
    );
    if (operandResult.isErr()) {
      return operandResult;
    }
    if (!isBooleanType(operandResult.value.type)) {
      return new Err(createUnsupportedBooleanOperatorError(trimmed));
    }
    if (operandResult.value.isRuntime) {
      return new Ok("return ((" + operandResult.value.jsCode + ") ? 0 : 1)");
    }
    return new Ok("return " + (operandResult.value.value === 0 ? 1 : 0));
  }

  const operatorsWithPositions = getOperatorsWithPositions(trimmed);

  if (operatorsWithPositions.length > 0) {
    const operands = extractOperands(trimmed, operatorsWithPositions);

    let operators: BinaryOperator[] = [];
    let parsedOperands: ExpressionOperandValue[] = [];

    for (const operator of operatorsWithPositions) {
      operators = [...operators, operator.op];
    }

    for (const operand of operands) {
      const operandResult = parseExpressionOperand(operand, variableContext);
      if (operandResult.isErr()) {
        return operandResult;
      }
      parsedOperands = [...parsedOperands, operandResult.value];
    }

    if (hasChainedOrderingComparison(operators)) {
      return new Err(createChainedComparisonError(trimmed));
    }

    const firstType = parsedOperands[0].type;
    for (
      let operandIndex = 1;
      operandIndex < parsedOperands.length;
      operandIndex++
    ) {
      const operandType = parsedOperands[operandIndex].type;
      if (
        operandType !== firstType &&
        operandType !== "untyped" &&
        firstType !== "untyped"
      ) {
        return new Err({
          code: CompilationErrorCode.TYPE_MISMATCH,
          erroneousValue: operands[operandIndex],
          message: "All operands in operations must have the same type",
          reason: "Expected type " + firstType + " but got " + operandType,
          fix: "Use matching types in all operands",
        });
      }
    }

    if (isBooleanType(firstType)) {
      if (operators.some(isOrderingComparisonOperator)) {
        return new Err(createNumericComparisonTypeMismatchError(trimmed));
      }

      const booleanOperatorError = getUnsupportedBooleanOperatorError(
        trimmed,
        operators,
      );
      if (booleanOperatorError) {
        return new Err(booleanOperatorError);
      }

      const hasRuntimeOperand = parsedOperands.some(
        (operand) => operand.isRuntime,
      );
      if (!hasRuntimeOperand) {
        const evaluation = evaluateBooleanChain(
          operators as BooleanOperator[],
          parsedOperands,
        );
        return new Ok("return " + evaluation);
      }

      const operandCodes = buildOperandCodes(
        parsedOperands,
        generateReadBoolOperandCode,
        (operand) => operand.jsCode,
      );
      return new Ok(
        "return " + buildChainedOperationCode(operators, operandCodes),
      );
    }

    if (operators.some(isComparisonOperator)) {
      const operandCodes = buildOperandCodes(
        parsedOperands,
        generateReadOperandCode,
        (operand) => operand.jsCode,
      );
      return new Ok(
        "return " + buildChainedOperationCode(operators, operandCodes),
      );
    }

    const operandCodes = buildOperandCodes(
      parsedOperands,
      generateReadOperandCode,
      (operand) => operand.jsCode,
    );
    return new Ok(
      "return " + buildChainedOperationCode(operators, operandCodes),
    );
  }

  const binding = variableContext[trimmed];
  if (binding !== undefined) {
    return new Ok("return " + binding.jsName);
  }

  const booleanValue = parseBooleanLiteral(trimmed);
  if (booleanValue !== undefined) {
    return new Ok("return " + booleanValue);
  }

  const readTypeResult = extractReadTypeArg(trimmed);
  if (!readTypeResult.isErr()) {
    return new Ok(
      compileStandaloneReadExpression((readTypeResult as Ok<string>).value),
    );
  }

  let cleanedExpr = "";
  let i = 0;
  while (i < trimmed.length) {
    if (isDigit(trimmed[i])) {
      let numEnd = i;
      while (numEnd < trimmed.length && isDigit(trimmed[numEnd])) {
        numEnd++;
      }
      const num = trimmed.substring(i, numEnd);
      cleanedExpr += num;
      i = numEnd;

      let suffixEnd = i;
      while (suffixEnd < trimmed.length && isLetter(trimmed[suffixEnd])) {
        suffixEnd++;
      }
      if (suffixEnd > i) {
        while (suffixEnd < trimmed.length && isDigit(trimmed[suffixEnd])) {
          suffixEnd++;
        }
        i = suffixEnd;
      }
    } else {
      cleanedExpr += trimmed[i];
      i++;
    }
  }

  return new Ok("return " + cleanedExpr);
}

function parseAllDeclarations(
  currentInput: string,
): Result<ParseAllDeclsResult, CompilationError> {
  interface DeclParseState {
    decls: ParsedVariableDeclaration[];
    remaining: string;
    error: CompilationError | undefined;
  }

  const result: DeclParseState = {
    decls: [],
    remaining: currentInput,
    error: undefined,
  };
  let state = result;

  while (state.remaining.startsWith("let ") && !state.error) {
    const declResult = parseVariableDeclaration(state.remaining);
    if (declResult.isErr()) {
      state = { ...state, error: declResult.error };
      break;
    }
    state = {
      decls: [...state.decls, declResult.value],
      remaining: declResult.value.remaining,
      error: undefined,
    };
  }

  if (state.error) {
    return new Err(state.error);
  }

  return new Ok({ decls: state.decls, remaining: state.remaining });
}

function getVariableBindingName(nextBindingIdx: number): string {
  return "__tuffVar" + nextBindingIdx;
}

function blockAwareLiteralCode(operand: BinaryOperandValue): string {
  return operand.jsCode !== undefined
    ? operand.jsCode
    : (operand.value as number).toString();
}

function firstOutOfScopeIdent(
  input: string,
  outOfScopeVars: Set<string>,
): string | undefined {
  let i = 0;
  while (i < input.length) {
    if (isLetter(input[i])) {
      let j = i;
      while (j < input.length && (isLetter(input[j]) || isDigit(input[j]))) {
        j++;
      }
      const ident = input.substring(i, j);
      if (outOfScopeVars.has(ident)) {
        return ident;
      }
      i = j;
    } else {
      i++;
    }
  }
  return undefined;
}

function buildChainedOperationCode(
  operators: BinaryOperator[],
  operandCodes: string[],
): string {
  let code = operandCodes[0];

  for (let index = 0; index < operators.length; index++) {
    const op = operators[index];
    const nextOperandCode = operandCodes[index + 1];
    if (op === "/") {
      code = "Math.floor(" + code + " / " + nextOperandCode + ")";
    } else if (op === "&&" || op === "||") {
      code = "(" + code + " " + op + " " + nextOperandCode + ")";
    } else if (op === "<" || op === "<=" || op === ">" || op === ">=") {
      code = "((" + code + " " + op + " " + nextOperandCode + ") ? 1 : 0)";
    } else if (op === "==") {
      code = "((" + code + " == " + nextOperandCode + ") ? 1 : 0)";
    } else if (op === "!=") {
      code = "((" + code + " != " + nextOperandCode + ") ? 1 : 0)";
    } else {
      code = "(" + code + " " + op + " " + nextOperandCode + ")";
    }
  }

  return code;
}

export function compileTuffToJS(
  input: string,
): Result<string, CompilationError> {
  // Handle variable declarations - parse all declarations immutably
  const variableContext: VariableContext = {};
  let currentInput = input.trim();

  // Handle leading block statements: { ... } followed by non-operator content
  const outOfScopeVars = new Set<string>();
  while (currentInput.startsWith("{")) {
    const blockEnd = findMatchingBrace(currentInput, 0);
    if (blockEnd === -1) {
      break;
    }
    const blockContent = currentInput.substring(1, blockEnd).trim();
    const afterBlock = currentInput.substring(blockEnd + 1).trim();

    if (afterBlock.length === 0) {
      return compileTuffToJS(blockContent);
    }

    if (startsWithBinaryOperator(afterBlock)) {
      break;
    }

    // Block statement: compile in isolation (vars don't escape)
    const blockResult = compileTuffToJS(blockContent);
    if (blockResult.isErr()) {
      return blockResult;
    }

    const blockDeclResult = parseAllDeclarations(blockContent);
    if (!blockDeclResult.isErr()) {
      for (const decl of blockDeclResult.value.decls) {
        outOfScopeVars.add(decl.name);
      }
    }

    currentInput = afterBlock;
  }

  if (outOfScopeVars.size > 0) {
    const outOfScopeIdent = firstOutOfScopeIdent(currentInput, outOfScopeVars);
    if (outOfScopeIdent !== undefined) {
      return new Err({
        code: CompilationErrorCode.UNDECLARED_VARIABLE,
        erroneousValue: currentInput,
        message: "Variable out of scope",
        reason:
          "Variable '" +
          outOfScopeIdent +
          "' was declared in a block that has already ended",
        fix:
          "Declare '" +
          outOfScopeIdent +
          "' in the current scope or move the reference inside the block",
      });
    }
  }

  input = currentInput;

  const declParseResult = parseAllDeclarations(currentInput);
  if (declParseResult.isErr()) {
    return declParseResult;
  }

  const { decls: declTexts, remaining: exprInput } = declParseResult.value;
  const hasLetDeclarations = declTexts.length > 0;
  currentInput = exprInput;

  // Process all declarations immutably using reduce
  interface ProcessState {
    varDecls: VariableDeclaration[];
    varCtx: VariableContext;
    stdinIdx: number;
    nextBindingIdx: number;
    error: CompilationError | undefined;
  }

  let processState: ProcessState = {
    varDecls: [],
    varCtx: {},
    stdinIdx: 0,
    nextBindingIdx: 0,
    error: undefined,
  };

  const createInitializedLiteralProcessState = (
    state: ProcessState,
    name: string,
    isMutable: boolean,
    resolvedType: string,
    literalValue: number,
    jsName: string,
  ): ProcessState => ({
    varDecls: [
      ...state.varDecls,
      {
        name,
        isMutable,
        type: resolvedType,
        initCode: literalValue.toString(),
        jsName,
      },
    ],
    varCtx: {
      ...state.varCtx,
      [name]: {
        type: resolvedType,
        isRead: false,
        isInitialized: true,
        isMutable,
        value: literalValue,
        jsName,
      },
    },
    stdinIdx: state.stdinIdx,
    nextBindingIdx: state.nextBindingIdx + 1,
    error: undefined,
  });

  const createRuntimeInitializerProcessState = (
    state: ProcessState,
    name: string,
    isMutable: boolean,
    resolvedType: string,
    initCode: string,
    jsName: string,
  ): ProcessState => ({
    varDecls: [
      ...state.varDecls,
      { name, isMutable, type: resolvedType, initCode, jsName },
    ],
    varCtx: {
      ...state.varCtx,
      [name]: {
        type: resolvedType,
        isRead: false,
        isInitialized: true,
        isMutable,
        value: undefined,
        jsName,
      },
    },
    stdinIdx: state.stdinIdx,
    nextBindingIdx: state.nextBindingIdx + 1,
    error: undefined,
  });

  const createLiteralInitializerProcessState = (
    state: ProcessState,
    variableName: string,
    mutable: boolean,
    declaredType: string | undefined,
    parsedType: string,
    resolvedType: string,
    literalValue: number,
    jsBindingName: string,
  ): ProcessState =>
    declaredType !== undefined &&
    parsedType !== declaredType &&
    parsedType !== "untyped"
      ? {
          ...state,
          error: createVariableDeclarationTypeMismatchError(
            input,
            variableName,
            declaredType,
            parsedType,
            false,
          ),
        }
      : createInitializedLiteralProcessState(
          state,
          variableName,
          mutable,
          resolvedType,
          literalValue,
          jsBindingName,
        );

  for (const { name, isMutable, type, initializer } of declTexts) {
    if (processState.error) {
      break;
    }

    const jsName = getVariableBindingName(processState.nextBindingIdx);

    if (initializer === undefined) {
      const shouldEmitMutableDeclaration = isMutable;

      processState = {
        varDecls: shouldEmitMutableDeclaration
          ? [
              ...processState.varDecls,
              {
                name,
                isMutable,
                type: type as string,
                initCode: undefined,
                jsName,
              },
            ]
          : processState.varDecls,
        varCtx: {
          ...processState.varCtx,
          [name]: {
            type: type as string,
            isRead: false,
            isInitialized: false,
            isMutable,
            value: undefined,
            jsName,
          },
        },
        stdinIdx: processState.stdinIdx,
        nextBindingIdx: processState.nextBindingIdx + 1,
        error: undefined,
      };
      continue;
    }

    if (initializer.startsWith("{")) {
      const blockEnd = findMatchingBrace(initializer, 0);
      if (blockEnd === initializer.length - 1) {
        const blockContent = initializer.substring(1, blockEnd).trim();
        const blockResult = compileBlockAsIIFE(blockContent);
        if (blockResult.isErr()) {
          processState = { ...processState, error: blockResult.error };
          continue;
        }
        const resolvedType = type ?? "untyped";
        processState = createRuntimeInitializerProcessState(
          processState,
          name,
          isMutable,
          resolvedType,
          blockResult.value,
          jsName,
        );
        continue;
      }
    }

    if (initializer.startsWith("if (")) {
      const exprResult = compileExpressionWithVariables(
        initializer,
        processState.varCtx,
      );
      if (exprResult.isErr()) {
        processState = { ...processState, error: exprResult.error };
        continue;
      }
      const rawCode = stripReturnStatement(exprResult.value);
      const readCount = countStdinValueReferences(rawCode);
      const offsetCode = offsetStdinValueIndexes(
        rawCode,
        processState.stdinIdx,
      );
      const resolvedType = type ?? "untyped";
      processState = {
        varDecls: [
          ...processState.varDecls,
          { name, isMutable, type: resolvedType, initCode: offsetCode, jsName },
        ],
        varCtx: {
          ...processState.varCtx,
          [name]: {
            type: resolvedType,
            isRead: readCount > 0,
            isInitialized: true,
            isMutable,
            value: undefined,
            jsName,
          },
        },
        stdinIdx: processState.stdinIdx + readCount,
        nextBindingIdx: processState.nextBindingIdx + 1,
        error: undefined,
      };
      continue;
    }

    const readTypeResult = extractReadTypeArg(initializer);
    if (!readTypeResult.isErr()) {
      const okResult = readTypeResult as Ok<string>;
      const resolvedType = type ?? okResult.value;

      if (type !== undefined && okResult.value !== type) {
        processState = {
          ...processState,
          error: createVariableDeclarationTypeMismatchError(
            input,
            name,
            type,
            okResult.value,
            true,
          ),
        };
        continue;
      }

      const initCode = generateReadCodeForType(
        resolvedType,
        processState.stdinIdx,
      );
      processState = {
        varDecls: [
          ...processState.varDecls,
          {
            name,
            isMutable,
            type: resolvedType,
            initCode,
            jsName,
          },
        ],
        varCtx: {
          ...processState.varCtx,
          [name]: {
            type: resolvedType,
            isRead: true,
            isInitialized: true,
            isMutable,
            value: undefined,
            jsName,
          },
        },
        stdinIdx: processState.stdinIdx + 1,
        nextBindingIdx: processState.nextBindingIdx + 1,
        error: undefined,
      };
      continue;
    }

    const booleanValue = parseBooleanLiteral(initializer);
    if (booleanValue !== undefined) {
      const parsedType = BOOL_TYPE;
      const resolvedType = type ?? parsedType;
      processState = createLiteralInitializerProcessState(
        processState,
        name,
        isMutable,
        type,
        parsedType,
        resolvedType,
        booleanValue,
        jsName,
      );
      continue;
    }

    const initializerOperators = getOperatorsWithPositions(initializer);
    if (
      initializerOperators.some((operator) => isComparisonOperator(operator.op))
    ) {
      const comparisonResult = compileComparisonExpression(
        initializer,
        processState.stdinIdx,
      );
      if (comparisonResult.isErr()) {
        processState = { ...processState, error: comparisonResult.error };
        continue;
      }

      const resolvedType = type ?? comparisonResult.value.type;
      processState = {
        varDecls: [
          ...processState.varDecls,
          {
            name,
            isMutable,
            type: resolvedType,
            initCode: comparisonResult.value.code,
            jsName,
          },
        ],
        varCtx: {
          ...processState.varCtx,
          [name]: {
            type: resolvedType,
            isRead: comparisonResult.value.readCount > 0,
            isInitialized: true,
            isMutable,
            value: undefined,
            jsName,
          },
        },
        stdinIdx: processState.stdinIdx + comparisonResult.value.readCount,
        nextBindingIdx: processState.nextBindingIdx + 1,
        error:
          type !== undefined && type !== comparisonResult.value.type
            ? createVariableDeclarationTypeMismatchError(
                input,
                name,
                type,
                comparisonResult.value.type,
                comparisonResult.value.readCount > 0,
              )
            : undefined,
      };
      continue;
    }

    const parseResult = parseTypedNumber(initializer);
    if (parseResult.isErr()) {
      processState = { ...processState, error: parseResult.error };
      continue;
    }

    const { type: parsedType, value } = parseResult.value;
    const resolvedType = type ?? parsedType;
    processState = createLiteralInitializerProcessState(
      processState,
      name,
      isMutable,
      type,
      parsedType,
      resolvedType,
      value,
      jsName,
    );
  }

  if (processState.error) {
    return new Err(processState.error);
  }

  const varDeclarations = processState.varDecls;
  Object.assign(variableContext, processState.varCtx);

  // If we had variable declarations, handle special code generation
  if (hasLetDeclarations) {
    let remainingExpression = currentInput;
    let assignmentReadCount = 0;
    let assignmentCodes: string[] = [];

    // Process leading assignment statements: x = value;
    while (remainingExpression.length > 0) {
      const trimmed = remainingExpression.trim();
      if (!trimmed || !isLetter(trimmed[0])) {
        remainingExpression = trimmed;
        break;
      }

      let identEnd = 0;
      while (
        identEnd < trimmed.length &&
        (isLetter(trimmed[identEnd]) || isDigit(trimmed[identEnd]))
      ) {
        identEnd++;
      }
      const name = trimmed.substring(0, identEnd);

      let assignCursor = identEnd;
      while (assignCursor < trimmed.length && trimmed[assignCursor] === " ") {
        assignCursor++;
      }

      if (assignCursor >= trimmed.length || trimmed[assignCursor] !== "=") {
        remainingExpression = trimmed;
        break;
      }

      const binding = variableContext[name];
      if (!binding) {
        return new Err(
          createUndefinedVariableError(
            input,
            name,
            "Declare the variable before assigning to it",
          ),
        );
      }

      if (!binding.isMutable) {
        return new Err(createImmutableAssignmentError(input, name));
      }

      assignCursor++;
      while (assignCursor < trimmed.length && trimmed[assignCursor] === " ") {
        assignCursor++;
      }

      const semicolonPos = findStatementTerminator(trimmed, assignCursor);

      if (semicolonPos >= trimmed.length || trimmed[semicolonPos] !== ";") {
        return new Err({
          code: CompilationErrorCode.PARSE_ERROR,
          erroneousValue: input,
          message: "Unable to parse input",
          reason: "Expected ';' to end assignment statement",
          fix: "Use format: x = value;",
        });
      }

      const assignmentValue = trimmed
        .substring(assignCursor, semicolonPos)
        .trim();
      if (!assignmentValue) {
        return new Err({
          code: CompilationErrorCode.PARSE_ERROR,
          erroneousValue: input,
          message: "Unable to parse input",
          reason: "Expected assignment value after '='",
          fix: "Use format: x = value;",
        });
      }

      let assignedType = "";
      let assignedCode = "";

      const readTypeResult = extractReadTypeArg(assignmentValue);
      if (!readTypeResult.isErr()) {
        const readType = (readTypeResult as Ok<string>).value;
        assignedType = readType;
        assignedCode = generateReadCodeForType(
          readType,
          processState.stdinIdx + assignmentReadCount,
        );
        assignmentReadCount++;
      } else if (
        readTypeResult.error.code === CompilationErrorCode.UNKNOWN_TYPE
      ) {
        return readTypeResult;
      } else {
        const assignmentOperators = getOperatorsWithPositions(assignmentValue);
        if (
          assignmentOperators.some((operator) =>
            isComparisonOperator(operator.op),
          )
        ) {
          const comparisonResult = compileComparisonExpression(
            assignmentValue,
            processState.stdinIdx + assignmentReadCount,
          );
          if (comparisonResult.isErr()) {
            return comparisonResult;
          }
          assignedType = comparisonResult.value.type;
          assignedCode = comparisonResult.value.code;
          assignmentReadCount += comparisonResult.value.readCount;
        } else {
          const assignedBoolean = parseBooleanLiteral(assignmentValue);
          if (assignedBoolean !== undefined) {
            assignedType = BOOL_TYPE;
            assignedCode = assignedBoolean.toString();
          } else {
            const typedValue = parseTypedNumber(assignmentValue);
            if (typedValue.isErr()) {
              return typedValue;
            }
            assignedType = typedValue.value.type;
            assignedCode = typedValue.value.value.toString();
          }
        }
      }

      if (assignedType !== binding.type && assignedType !== "untyped") {
        return new Err({
          code: CompilationErrorCode.TYPE_MISMATCH,
          erroneousValue: input,
          message: "Variable type mismatch in assignment",
          reason:
            "Variable " +
            name +
            " is type " +
            binding.type +
            " but assigned value is type " +
            assignedType,
          fix: "Assign values that match variable type " + binding.type,
        });
      }

      variableContext[name] = {
        ...binding,
        isInitialized: true,
      };
      assignmentCodes = [
        ...assignmentCodes,
        binding.jsName + " = " + assignedCode + ";",
      ];
      remainingExpression = trimmed.substring(semicolonPos + 1).trim();
    }

    currentInput = remainingExpression;

    // Validate all variable references are defined
    let i = 0;
    while (i < currentInput.length) {
      // Skip block contents (they have their own scope)
      if (currentInput[i] === "{") {
        const blockEnd = findMatchingBrace(currentInput, i);
        if (blockEnd !== -1) {
          i = blockEnd + 1;
          continue;
        }
      }

      if (isLetter(currentInput[i])) {
        let j = i;
        while (
          j < currentInput.length &&
          (isLetter(currentInput[j]) || isDigit(currentInput[j]))
        ) {
          j++;
        }
        const ident = currentInput.substring(i, j);

        // Skip if it's part of a read<> pattern
        if (currentInput.substring(i, i + 5) === "read<") {
          let endParen = currentInput.indexOf(">", i + 5);
          if (endParen !== -1) {
            i = endParen + 3;
            continue;
          }
        }

        const binding = variableContext[ident];

        // Check if it's an undefined variable (and not part of a type suffix)
        if (
          binding === undefined &&
          j < currentInput.length &&
          !isDigit(currentInput[j])
        ) {
          if (parseBooleanLiteral(ident) !== undefined) {
            i = j;
            continue;
          }
          if (ident === "if" || ident === "else") {
            i = j;
            continue;
          }
          // This might be a type suffix like "U8" or "U16"
          if (!VALID_TYPE_NAMES.has(ident)) {
            return new Err(
              createUndefinedVariableError(
                input,
                ident,
                "Declare the variable before using it",
              ),
            );
          }
        } else if (binding && !binding.isInitialized) {
          return new Err({
            code: CompilationErrorCode.UNINITIALIZED_VARIABLE,
            erroneousValue: input,
            message: "Unable to parse input",
            reason: "Variable '" + ident + "' is declared but not initialized",
            fix:
              "Initialize '" + ident + "' at declaration time before using it",
          });
        }
        i = j;
      } else {
        i++;
      }
    }

    // Compile the final expression (may now contain variable references)
    const exprCompileResult = compileExpressionWithVariables(
      currentInput,
      variableContext,
    );
    if (exprCompileResult.isErr()) {
      return exprCompileResult;
    }

    // Check if we need stdin handling
    const hasReadVars = varDeclarations.some(
      (v) => variableContext[v.name].isRead,
    );
    const hasReadInExpr = currentInput.includes("read<");

    let code =
      hasReadVars || hasReadInExpr || assignmentReadCount > 0
        ? "const __stdinValues = __stdin.split(' ');\n"
        : "";

    // Add variable declarations
    for (const decl of varDeclarations) {
      if (decl.initCode === undefined) {
        code += "let " + decl.jsName + ";\n";
      } else {
        code +=
          (decl.isMutable ? "let" : "const") +
          " " +
          decl.jsName +
          " = " +
          decl.initCode +
          ";\n";
      }
    }

    for (const assignmentCode of assignmentCodes) {
      code += assignmentCode + "\n";
    }

    code += exprCompileResult.value;
    return new Ok(code);
  }

  if (input.trim().startsWith("if (")) {
    return compileExpressionWithVariables(input.trim(), {});
  }

  if (hasStandaloneAssignment(input)) {
    const trimmed = input.trim();
    let nameEnd = 0;
    while (
      nameEnd < trimmed.length &&
      (isLetter(trimmed[nameEnd]) || isDigit(trimmed[nameEnd]))
    ) {
      nameEnd++;
    }
    const assignTarget = trimmed.substring(0, nameEnd).trim();
    const afterName = trimmed.substring(nameEnd).trimStart();
    if (
      assignTarget &&
      isIdentifier(assignTarget) &&
      afterName.startsWith("=") &&
      afterName.length > 1
    ) {
      return new Err(
        createUndefinedVariableError(
          input,
          assignTarget,
          "Declare the variable before assigning to it",
        ),
      );
    }
    return new Err({
      code: CompilationErrorCode.PARSE_ERROR,
      erroneousValue: input,
      message: "Unable to parse input",
      reason:
        "Assignment requires a prior declaration in the same statement context",
      fix: "Declare variables first using let/let mut before assigning",
    });
  }

  // Check for chained operations (e.g., "100U8 + 50U8 + 30U8")
  // Find all operators in the input
  const operatorsWithPositions = getOperatorsWithPositions(input);

  if (operatorsWithPositions.length > 0) {
    // Parse all operands
    const operands = extractOperands(input, operatorsWithPositions);

    // Parse each operand
    const operators: BinaryOperator[] = operatorsWithPositions.map(
      (o) => o.op as BinaryOperator,
    );
    let parsedOperands: BinaryOperandValue[] = [];

    for (const operand of operands) {
      const result = parseOperandForBinaryOp(operand);
      if (result.isErr()) {
        return result;
      }
      parsedOperands = [...parsedOperands, result.value];
    }

    if (hasChainedOrderingComparison(operators)) {
      return new Err(createChainedComparisonError(input));
    }

    // Validate all operands have the same type
    const firstType = parsedOperands[0].type;
    for (let i = 1; i < parsedOperands.length; i++) {
      if (
        parsedOperands[i].type !== firstType &&
        parsedOperands[i].type !== "untyped" &&
        firstType !== "untyped"
      ) {
        return new Err({
          code: CompilationErrorCode.TYPE_MISMATCH,
          erroneousValue: input,
          message: "All operands in chained operations must have the same type",
          reason:
            "Operand at position " +
            i +
            " has type " +
            parsedOperands[i].type +
            ", but expected " +
            firstType,
          fix: "Make all operands the same type by adding or removing type suffixes",
        });
      }
    }

    const hasBlockOperand = parsedOperands.some(
      (op) => op.jsCode !== undefined,
    );

    const effectiveFirstType =
      firstType === "untyped"
        ? (parsedOperands.find((op) => op.type !== "untyped")?.type ?? "untyped")
        : firstType;

    if (isBooleanType(effectiveFirstType)) {
      if (operators.some(isOrderingComparisonOperator)) {
        return new Err(createNumericComparisonTypeMismatchError(input));
      }

      const booleanOperatorError = getUnsupportedBooleanOperatorError(
        input,
        operators,
      );
      if (booleanOperatorError) {
        return new Err(booleanOperatorError);
      }

      const hasReadOperand = parsedOperands.some((op) => op.isRead);
      if (hasReadOperand) {
        const operandCodes = buildOperandCodes(
          parsedOperands,
          generateReadBoolOperandCode,
          (operand) => (operand.value as number).toString(),
        );

        return new Ok(
          "const __stdinValues = __stdin.split(' ');\nreturn " +
            buildChainedOperationCode(operators, operandCodes),
        );
      }

      const evaluation = evaluateBooleanChain(
        operators as BooleanOperator[],
        parsedOperands,
      );
      return new Ok("return " + evaluation);
    }

    if (operators.some(isComparisonOperator)) {
      const hasReadOperand = parsedOperands.some((op) => op.isRead);
      const operandCodes = buildOperandCodes(
        parsedOperands,
        generateReadOperandCode,
        blockAwareLiteralCode,
      );

      if (hasReadOperand) {
        return new Ok(
          "const __stdinValues = __stdin.split(' ');\nreturn " +
            buildChainedOperationCode(operators, operandCodes),
        );
      }

      return new Ok(
        "return " + buildChainedOperationCode(operators, operandCodes),
      );
    }

    // Check if any operand is a read pattern or block
    const hasReadOperand = parsedOperands.some((op) => op.isRead);

    if (hasReadOperand || hasBlockOperand) {
      // Generate code with runtime values
      const operandCodes = buildOperandCodes(
        parsedOperands,
        generateReadOperandCode,
        blockAwareLiteralCode,
      );

      // Build the chained operation
      const operationCode = buildChainedOperationCode(operators, operandCodes);

      const code = hasReadOperand
        ? "const __stdinValues = __stdin.split(' ');\nreturn " + operationCode
        : "return " + operationCode;
      return new Ok(code);
    }

    // All are literal values - evaluate at compile time
    let result = parsedOperands[0].value as number;
    const range = TYPE_RANGES.get(firstType);

    for (let i = 0; i < operators.length; i++) {
      const op = operators[i];
      const nextValue = parsedOperands[i + 1].value as number;

      if (op === "+") {
        result = result + nextValue;
      } else if (op === "-") {
        result = result - nextValue;
      } else if (op === "*") {
        result = result * nextValue;
      } else {
        // op === "/"
        result = Math.floor(result / nextValue);
      }

      // Validate result after each operation
      if (range && (result < range.min || result > range.max)) {
        return new Err({
          code: CompilationErrorCode.VALUE_OUT_OF_RANGE,
          erroneousValue: input,
          message:
            "Result " + result + " exceeds the range for type " + firstType,
          reason: getRangeViolationReason(
            firstType,
            range,
            "the operation produced " + result,
          ),
          fix: "Use a larger type (e.g., U16 instead of U8) or change the operands to produce a smaller result.",
        });
      }
    }

    return new Ok("return " + result);
  }

  // Check for read<TYPE>() pattern without regex
  const readTypeResult = extractReadTypeArg(input);
  if (!readTypeResult.isErr()) {
    return new Ok(
      compileStandaloneReadExpression((readTypeResult as Ok<string>).value),
    );
  }

  // If it's a validation error (invalid type), return it
  if (readTypeResult.error.code !== CompilationErrorCode.PARSE_ERROR) {
    return readTypeResult;
  }

  // Reject negative numbers with type suffixes (e.g., "-100U8")
  if (input.startsWith("-")) {
    const { hasDigits, hasLetters } = scanForAlphanumeric(input, 1);
    if (hasDigits && hasLetters) {
      return new Err({
        code: CompilationErrorCode.NEGATIVE_WITH_SUFFIX,
        erroneousValue: input,
        message: "Negative numbers with type suffixes are not supported",
        reason:
          "Negative values cannot be used with explicit type suffixes like U8, S32, etc.",
        fix: "Remove the type suffix (e.g., use -100 instead of -100U8) or use a positive value with the type suffix.",
      });
    }
  }

  if (input === "") {
    return new Ok("return 0");
  }

  if (input.startsWith("!") && !input.startsWith("!=")) {
    const negatedValue = parseBooleanLiteral(input.substring(1).trim());
    if (negatedValue !== undefined) {
      return new Ok("return " + (negatedValue === 0 ? 1 : 0));
    }
  }

  const booleanValue = parseBooleanLiteral(input);
  if (booleanValue !== undefined) {
    return new Ok("return " + booleanValue);
  }

  // Try to parse as a single typed number
  const parseResult = parseTypedNumber(input);
  if (parseResult.isErr()) {
    // If parsing completely failed, treat it as a string literal
    // But only if it's not a typed number that failed validation
    if (!containsTypeSuffix(input)) {
      return new Ok('return "' + input + '"');
    }
    // If it has a type suffix but failed parsing, return the error
    return parseResult;
  }

  return new Ok("return " + parseResult.value.value);
}

function containsTypeSuffix(input: string): boolean {
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (!isDigit(char) && !isLetter(char)) {
      return false; // Has non-alphanumeric, not just number + type
    }
  }
  const { hasDigits, hasLetters } = scanForAlphanumeric(input, 0);
  return hasDigits && hasLetters;
}

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function isLetter(char: string): boolean {
  return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
}

function isIdentifier(input: string): boolean {
  if (input.length === 0 || !isLetter(input[0])) {
    return false;
  }
  for (let i = 1; i < input.length; i++) {
    if (!isLetter(input[i]) && !isDigit(input[i])) {
      return false;
    }
  }
  return true;
}

interface AlphanumericScan {
  hasDigits: boolean;
  hasLetters: boolean;
}

function scanForAlphanumeric(
  input: string,
  startIndex: number,
): AlphanumericScan {
  let hasDigits = false;
  let hasLetters = false;
  for (let i = startIndex; i < input.length; i++) {
    const char = input[i];
    if (isDigit(char)) {
      hasDigits = true;
    } else if (isLetter(char)) {
      hasLetters = true;
    }
  }
  return { hasDigits, hasLetters };
}

interface ParsedTypedNumber {
  value: number;
  type: string;
}

function parseTypedNumber(
  input: string,
): Result<ParsedTypedNumber, CompilationError> {
  // Extract the numeric part and type suffix
  let numericValue = "";
  let suffixStart = -1;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (isDigit(char)) {
      numericValue += char;
    } else {
      suffixStart = i;
      break;
    }
  }

  // If we found a numeric value, check type constraints
  if (numericValue) {
    if (suffixStart !== -1) {
      const suffix = input.substring(suffixStart).toUpperCase();
      const range = TYPE_RANGES.get(suffix);
      if (range) {
        const value = parseInt(numericValue, 10);
        if (value < range.min || value > range.max) {
          return new Err({
            code: CompilationErrorCode.VALUE_OUT_OF_RANGE,
            erroneousValue: input,
            message: "Value " + value + " exceeds the range for type " + suffix,
            reason: getRangeViolationReason(suffix, range),
            fix: "Use a different type with a larger range (e.g., U16 instead of U8) or provide a value within the valid range.",
          });
        }
        return new Ok({ value, type: suffix });
      }
    }
    const value = parseInt(numericValue, 10);
    return new Ok({ value, type: "untyped" });
  }

  return new Err({
    code: CompilationErrorCode.PARSE_ERROR,
    erroneousValue: input,
    message: "Unable to parse input",
    reason:
      "The input does not match any valid format (numeric literal, typed number, or function call)",
    fix: "Ensure the input is either a number (e.g., 100), a typed number (e.g., 100U8), or a function call (e.g., read<U8>()).",
  });
}

interface VariableBinding {
  type: string;
  value?: number;
  isRead: boolean;
  isInitialized: boolean;
  isMutable: boolean;
  jsName: string;
}

interface VariableContext {
  [name: string]: VariableBinding;
}

interface VariableDeclaration {
  name: string;
  isMutable: boolean;
  type: string;
  initCode: string | undefined;
  jsName: string;
}

interface ParsedVariableDeclaration {
  name: string;
  isMutable: boolean;
  type: string | undefined;
  initializer: string | undefined;
  remaining: string;
}

interface ParseAllDeclsResult {
  decls: ParsedVariableDeclaration[];
  remaining: string;
}

function parseVariableDeclaration(
  input: string,
): Result<ParsedVariableDeclaration, CompilationError> {
  // Parse optional mutability keyword and find the variable name
  let cursorAfterLet = 4; // skip "let "
  while (cursorAfterLet < input.length && input[cursorAfterLet] === " ") {
    cursorAfterLet++;
  }

  let isMutable = false;
  if (
    input.substring(cursorAfterLet, cursorAfterLet + 3) === "mut" &&
    input[cursorAfterLet + 3] === " "
  ) {
    isMutable = true;
    cursorAfterLet += 3;
    while (cursorAfterLet < input.length && input[cursorAfterLet] === " ") {
      cursorAfterLet++;
    }
  }

  let nameEnd = cursorAfterLet;
  while (
    nameEnd < input.length &&
    input[nameEnd] !== " " &&
    input[nameEnd] !== ":" &&
    input[nameEnd] !== "=" &&
    input[nameEnd] !== ";"
  ) {
    nameEnd++;
  }
  const name = input.substring(cursorAfterLet, nameEnd);

  // Validate variable name is alphanumeric
  for (let i = 0; i < name.length; i++) {
    if (!(isDigit(name[i]) || isLetter(name[i]))) {
      return new Err({
        code: CompilationErrorCode.PARSE_ERROR,
        erroneousValue: input,
        message: "Invalid variable name",
        reason: "Variable name must contain only letters and digits",
        fix: "Use a name like 'x' or 'var1'",
      });
    }
  }

  // Parse optional type and optional initializer
  let cursor = nameEnd;
  while (cursor < input.length && input[cursor] === " ") {
    cursor++;
  }

  let varType: string | undefined = undefined;
  if (cursor < input.length && input[cursor] === ":") {
    cursor++; // skip ':'
    while (cursor < input.length && input[cursor] === " ") {
      cursor++;
    }

    let typeEnd = cursor;
    while (
      typeEnd < input.length &&
      (isLetter(input[typeEnd]) || isDigit(input[typeEnd]))
    ) {
      typeEnd++;
    }

    varType = input.substring(cursor, typeEnd).toUpperCase();

    // Validate type
    if (!VALID_TYPE_NAMES.has(varType)) {
      return new Err(
        createUnknownTypeError(
          varType,
          "Unknown type parameter in variable declaration",
        ),
      );
    }

    cursor = typeEnd;
    while (cursor < input.length && input[cursor] === " ") {
      cursor++;
    }
  }

  const hasInitializer = cursor < input.length && input[cursor] === "=";

  // Find the semicolon that ends this declaration
  const semicolonPos = findStatementTerminator(
    input,
    hasInitializer ? cursor + 1 : cursor,
  );

  if (semicolonPos >= input.length || input[semicolonPos] !== ";") {
    return new Err(
      createVariableDeclarationSyntaxError(
        input,
        "Expected ';' to end variable declaration",
      ),
    );
  }

  if (!hasInitializer && varType === undefined) {
    return new Err(
      createVariableDeclarationSyntaxError(
        input,
        "Expected ':' or '=' after variable name",
      ),
    );
  }

  if (!hasInitializer && varType !== undefined && input[cursor] !== ";") {
    return new Err(
      createVariableDeclarationSyntaxError(input, "Expected '=' after type"),
    );
  }

  let initializer: string | undefined = undefined;
  if (hasInitializer) {
    let initStart = cursor + 1;
    while (initStart < input.length && input[initStart] === " ") {
      initStart++;
    }

    initializer = input.substring(initStart, semicolonPos).trim();
    if (!initializer) {
      return new Err(
        createVariableDeclarationSyntaxError(
          input,
          "Expected initializer after '='",
        ),
      );
    }
  }

  const remaining = input.substring(semicolonPos + 1).trim();

  return new Ok({
    name,
    isMutable,
    type: varType,
    initializer,
    remaining,
  });
}
