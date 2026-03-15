import { Result, Ok, Err } from "./types/result";

enum CompilationErrorCode {
  UNKNOWN_TYPE = "UNKNOWN_TYPE",
  NEGATIVE_WITH_SUFFIX = "NEGATIVE_WITH_SUFFIX",
  TYPE_MISMATCH = "TYPE_MISMATCH",
  VALUE_OUT_OF_RANGE = "VALUE_OUT_OF_RANGE",
  PARSE_ERROR = "PARSE_ERROR",
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

const VALID_TYPES = "U8, U16, U32, S8, S16, S32, F64";
const INVALID_TYPE_MESSAGE = `is not a recognized type. Valid types are: ${VALID_TYPES}`;

const TYPE_RANGES = new Map<string, TypeRange>([
  ["U8", { min: 0, max: 255 }],
  ["U16", { min: 0, max: 65535 }],
  ["U32", { min: 0, max: 4294967295 }],
  ["S8", { min: -128, max: 127 }],
  ["S16", { min: -32768, max: 32767 }],
  ["S32", { min: -2147483648, max: 2147483647 }],
  ["F64", { min: -Infinity, max: Infinity }],
]);

function getRangeViolationReason(
  typeName: string,
  range: TypeRange,
  context?: string,
): string {
  let reason = `Type ${typeName} can only represent values between ${range.min} and ${range.max}`;
  if (context) {
    reason += `, but ${context}`;
  }
  return reason;
}

function validateReadTypeArg(typeArg: string): Result<void, CompilationError> {
  // Validate type contains only alphanumeric characters
  let isValidType = true;
  for (let i = 0; i < typeArg.length; i++) {
    const char = typeArg[i];
    if (!(isDigit(char) || isLetter(char))) {
      isValidType = false;
      break;
    }
  }

  if (!isValidType || !TYPE_RANGES.has(typeArg)) {
    return new Err({
      code: CompilationErrorCode.UNKNOWN_TYPE,
      erroneousValue: typeArg,
      message: `Unknown type parameter in read<>() expression`,
      reason: `${typeArg} ${INVALID_TYPE_MESSAGE}`,
      fix: `Use one of the valid types: ${VALID_TYPES}`,
    });
  }

  return new Ok(void 0);
}

function generateReadOperandCode(stdinIndex: number): string {
  return `parseInt(__stdinValues[${stdinIndex}], 10)`;
}

interface OperatorPosition {
  op: string;
  index: number;
}

function extractReadTypeArg(operand: string): Result<string, CompilationError> {
  if (
    operand.startsWith("read<") &&
    operand.endsWith(">()") &&
    operand.length > "read<>()".length
  ) {
    const typeStart = 5; // "read<" length
    const typeEnd = operand.length - 3; // ">()" length
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

interface BinaryOperandValue {
  type: string;
  isRead: boolean;
  value?: number; // Only set if not a read pattern
}

function parseOperandForBinaryOp(
  operand: string,
): Result<BinaryOperandValue, CompilationError> {
  // Check if operand is a read<TYPE>() pattern
  const readTypeResult = extractReadTypeArg(operand);
  if (!readTypeResult.isErr()) {
    // For Ok case, we need to unwrap it properly
    // Since Result doesn't have a direct value accessor for Ok, we'll check and cast
    const okResult = readTypeResult as Ok<string>;
    return new Ok({ type: okResult.value, isRead: true });
  }

  // If it's a validation error (UNKNOWN_TYPE), propagate it
  if (readTypeResult.error.code === CompilationErrorCode.UNKNOWN_TYPE) {
    return readTypeResult;
  }

  // Try to parse as typed number
  const parseResult = parseTypedNumber(operand);
  if (parseResult.isErr()) {
    return parseResult;
  }

  return new Ok({
    type: parseResult.value.type,
    isRead: false,
    value: parseResult.value.value,
  });
}

export function compileTuffToJS(
  input: string,
): Result<string, CompilationError> {
  // Check for chained operations (e.g., "100U8 + 50U8 + 30U8")
  const binaryOps = ["+", "-", "*", "/"];

  // Find all operators in the input
  const operatorsWithPositions: OperatorPosition[] = [];
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (
      binaryOps.includes(char) &&
      i > 0 &&
      i < input.length - 1 &&
      input[i - 1] === " " &&
      input[i + 1] === " "
    ) {
      operatorsWithPositions.push({ op: char, index: i });
    }
  }

  if (operatorsWithPositions.length > 0) {
    // Parse all operands
    const operands: string[] = [];
    let lastIndex = 0;
    for (const { index } of operatorsWithPositions) {
      operands.push(input.substring(lastIndex, index - 1).trim());
      lastIndex = index + 2;
    }
    operands.push(input.substring(lastIndex).trim());

    // Parse each operand
    const operators = operatorsWithPositions.map((o) => o.op);
    const parsedOperands: BinaryOperandValue[] = [];

    for (const operand of operands) {
      const result = parseOperandForBinaryOp(operand);
      if (result.isErr()) {
        return result;
      }
      parsedOperands.push(result.value);
    }

    // Validate all operands have the same type
    const firstType = parsedOperands[0].type;
    for (let i = 1; i < parsedOperands.length; i++) {
      if (parsedOperands[i].type !== firstType) {
        return new Err({
          code: CompilationErrorCode.TYPE_MISMATCH,
          erroneousValue: input,
          message: "All operands in chained operations must have the same type",
          reason: `Operand at position ${i} has type ${parsedOperands[i].type}, but expected ${firstType}`,
          fix: "Make all operands the same type by adding or removing type suffixes",
        });
      }
    }

    // Check if any operand is a read pattern
    const hasReadOperand = parsedOperands.some((op) => op.isRead);

    if (hasReadOperand) {
      // Generate code with stdin values
      const operandCodes: string[] = [];
      let readIndex = 0;

      for (const operand of parsedOperands) {
        if (operand.isRead) {
          operandCodes.push(generateReadOperandCode(readIndex));
          readIndex++;
        } else {
          operandCodes.push((operand.value as number).toString());
        }
      }

      // Build the chained operation
      let operationCode = operandCodes[0];
      for (let i = 0; i < operators.length; i++) {
        const op = operators[i];
        if (op === "+") {
          operationCode += ` + ${operandCodes[i + 1]}`;
        } else if (op === "-") {
          operationCode += ` - ${operandCodes[i + 1]}`;
        } else if (op === "*") {
          operationCode += ` * ${operandCodes[i + 1]}`;
        } else {
          // op === "/"
          operationCode += ` / ${operandCodes[i + 1]}`;
        }
      }

      const code = `const __stdinValues = __stdin.split(' ');\nreturn ${operationCode}`;
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
          message: `Result ${result} exceeds the range for type ${firstType}`,
          reason: getRangeViolationReason(
            firstType,
            range,
            `the operation produced ${result}`,
          ),
          fix: `Use a larger type (e.g., U16 instead of U8) or change the operands to produce a smaller result.`,
        });
      }
    }

    return new Ok(`return ${result}`);
  }

  // Check for read<TYPE>() pattern without regex
  const readTypeResult = extractReadTypeArg(input);
  if (!readTypeResult.isErr()) {
    return new Ok(`return parseInt(__stdin, 10)`);
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
        reason: `Negative values cannot be used with explicit type suffixes like U8, S32, etc.`,
        fix: `Remove the type suffix (e.g., use -100 instead of -100U8) or use a positive value with the type suffix.`,
      });
    }
  }

  if (input === "") {
    return new Ok("return 0");
  }

  // Try to parse as a single typed number
  const parseResult = parseTypedNumber(input);
  if (parseResult.isErr()) {
    // If parsing completely failed, treat it as a string literal
    // But only if it's not a typed number that failed validation
    if (!containsTypeSuffix(input)) {
      return new Ok(`return "${input}"`);
    }
    // If it has a type suffix but failed parsing, return the error
    return parseResult;
  }

  return new Ok(`return ${parseResult.value.value}`);
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
            message: `Value ${value} exceeds the range for type ${suffix}`,
            reason: getRangeViolationReason(suffix, range),
            fix: `Use a different type with a larger range (e.g., U16 instead of U8) or provide a value within the valid range.`,
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
    reason: `The input does not match any valid format (numeric literal, typed number, or function call)`,
    fix: `Ensure the input is either a number (e.g., 100), a typed number (e.g., 100U8), or a function call (e.g., read<U8>()).`,
  });
}
