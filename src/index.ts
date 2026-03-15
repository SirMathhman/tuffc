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

type BinaryOperator = "+" | "-" | "*" | "/";

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

const BINARY_OPS: BinaryOperator[] = ["+", "-", "*", "/"];

function getOperatorsWithPositions(input: string): OperatorPosition[] {
  return Array.from(input).reduce<OperatorPosition[]>(
    (positions, char, index) => {
      if (
        BINARY_OPS.includes(char as BinaryOperator) &&
        index > 0 &&
        index < input.length - 1 &&
        input[index - 1] === " " &&
        input[index + 1] === " "
      ) {
        return [...positions, { op: char, index }];
      }
      return positions;
    },
    [],
  );
}

function extractOperands(
  input: string,
  operatorsWithPositions: OperatorPosition[],
): string[] {
  const leadingOperands = operatorsWithPositions.map(({ index }, position) => {
    const startIndex =
      position === 0 ? 0 : operatorsWithPositions[position - 1].index + 2;
    return input.substring(startIndex, index - 1).trim();
  });
  const finalOperandStartIndex =
    operatorsWithPositions[operatorsWithPositions.length - 1].index + 2;
  return [...leadingOperands, input.substring(finalOperandStartIndex).trim()];
}

function createUnknownTypeError(
  typeName: string,
  message: string,
): CompilationError {
  return {
    code: CompilationErrorCode.UNKNOWN_TYPE,
    erroneousValue: typeName,
    message,
    reason: `${typeName} ${INVALID_TYPE_MESSAGE}`,
    fix: `Use one of the valid types: ${VALID_TYPES}`,
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
    reason: `Variable ${name} is declared as type ${expectedType} but initializer ${initializerStyle} ${actualType}`,
    fix: `Use matching types (e.g., let x : U8 = ${exampleInitializer})`,
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

function compileExpressionWithVariables(
  expr: string,
  variableContext: VariableContext,
): Result<string, CompilationError> {
  // Compile an expression that may contain variable references
  // Validate type compatibility first

  const trimmed = expr.trim();

  if (!trimmed) {
    return new Ok("return 0");
  }

  // Parse the expression to check for type mismatches
  const operatorsWithPositions = getOperatorsWithPositions(trimmed);

  if (operatorsWithPositions.length > 0) {
    // Parse operands and check types
    const operands = extractOperands(trimmed, operatorsWithPositions);

    // Check types of all operands
    let firstType: string | null = null;

    for (const operand of operands) {
      let operandType: string | null = null;

      // Check if it's a variable reference
      if (variableContext[operand] !== undefined) {
        operandType = variableContext[operand].type;
      } else {
        // Try to parse as typed number
        const parseResult = parseTypedNumber(operand);
        if (parseResult.isErr()) {
          // Not a typed number, might be an issue
          continue;
        }
        operandType = parseResult.value.type;
      }

      if (firstType === null) {
        firstType = operandType;
      } else if (
        operandType &&
        firstType !== operandType &&
        operandType !== "untyped"
      ) {
        return new Err({
          code: CompilationErrorCode.TYPE_MISMATCH,
          erroneousValue: operand,
          message: "All operands in operations must have the same type",
          reason: `Expected type ${firstType} but got ${operandType}`,
          fix: "Use matching types in all operands",
        });
      }
    }
  }

  // Remove type suffixes from literals for JavaScript compatibility
  let cleanedExpr = "";
  let i = 0;
  while (i < trimmed.length) {
    if (isDigit(trimmed[i])) {
      // Found a number, collect all digits
      let numEnd = i;
      while (numEnd < trimmed.length && isDigit(trimmed[numEnd])) {
        numEnd++;
      }
      const num = trimmed.substring(i, numEnd);
      cleanedExpr += num;
      i = numEnd;

      // Skip any following type suffix (letters followed by digits, like U8, U16, S32, F64)
      let suffixEnd = i;
      while (suffixEnd < trimmed.length && isLetter(trimmed[suffixEnd])) {
        suffixEnd++;
      }
      // If we found letters, skip any following digits too
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

  // Replace variable names with generated JS-safe bindings
  let expressionWithBindings = "";
  let cursor = 0;
  while (cursor < cleanedExpr.length) {
    if (isLetter(cleanedExpr[cursor])) {
      let identEnd = cursor;
      while (
        identEnd < cleanedExpr.length &&
        (isLetter(cleanedExpr[identEnd]) || isDigit(cleanedExpr[identEnd]))
      ) {
        identEnd++;
      }

      const ident = cleanedExpr.substring(cursor, identEnd);
      const binding = variableContext[ident];
      expressionWithBindings += binding ? binding.jsName : ident;
      cursor = identEnd;
    } else {
      expressionWithBindings += cleanedExpr[cursor];
      cursor++;
    }
  }

  // Just return it as a return statement
  // The variables are already defined by the caller
  return new Ok(`return ${expressionWithBindings}`);
}

export function compileTuffToJS(
  input: string,
): Result<string, CompilationError> {
  // Handle variable declarations - parse all declarations immutably
  const variableContext: VariableContext = {};
  let currentInput = input.trim();

  interface DeclParseState {
    decls: ParsedVariableDeclaration[];
    remaining: string;
    error: CompilationError | null;
  }

  // Recursively parse declarations immutably
  const parseAllDeclarations = (): Result<
    ParseAllDeclsResult,
    CompilationError
  > => {
    const result: DeclParseState = {
      decls: [],
      remaining: currentInput,
      error: null,
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
        error: null,
      };
    }

    if (state.error) {
      return new Err(state.error);
    }

    return new Ok({ decls: state.decls, remaining: state.remaining });
  };

  const declParseResult = parseAllDeclarations();
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
    error: CompilationError | null;
  }

  const processState: ProcessState = declTexts.reduce<ProcessState>(
    (state, { name, type, initializer }) => {
      if (state.error) return state;

      const jsName = `__tuffVar${state.nextBindingIdx}`;

      if (initializer === null) {
        return {
          varDecls: state.varDecls,
          varCtx: {
            ...state.varCtx,
            [name]: {
              type: type as string,
              isRead: false,
              isInitialized: false,
              value: undefined,
              jsName,
            },
          },
          stdinIdx: state.stdinIdx,
          nextBindingIdx: state.nextBindingIdx + 1,
          error: null,
        };
      }

      // Special handling for read<TYPE>() patterns
      const readTypeResult = extractReadTypeArg(initializer);
      if (!readTypeResult.isErr()) {
        const okResult = readTypeResult as Ok<string>;
        const resolvedType = type ?? okResult.value;

        if (type !== null && okResult.value !== type) {
          return {
            ...state,
            error: createVariableDeclarationTypeMismatchError(
              input,
              name,
              type,
              okResult.value,
              true,
            ),
          };
        }

        // Generate code to read from stdin
        const initCode = generateReadOperandCode(state.stdinIdx);
        return {
          varDecls: [
            ...state.varDecls,
            { name, type: resolvedType, initCode, jsName },
          ],
          varCtx: {
            ...state.varCtx,
            [name]: {
              type: resolvedType,
              isRead: true,
              isInitialized: true,
              value: undefined,
              jsName,
            },
          },
          stdinIdx: state.stdinIdx + 1,
          nextBindingIdx: state.nextBindingIdx + 1,
          error: null,
        };
      } else {
        // Not a read pattern - parse as literal
        const parseResult = parseTypedNumber(initializer);
        if (parseResult.isErr()) {
          return { ...state, error: parseResult.error };
        }

        const { type: parsedType, value } = parseResult.value;
        const resolvedType = type ?? parsedType;

        // Validate the parsed type matches declaration
        if (type !== null && parsedType !== type && parsedType !== "untyped") {
          return {
            ...state,
            error: createVariableDeclarationTypeMismatchError(
              input,
              name,
              type,
              parsedType,
              false,
            ),
          };
        }

        return {
          varDecls: [
            ...state.varDecls,
            {
              name,
              type: resolvedType,
              initCode: value.toString(),
              jsName,
            },
          ],
          varCtx: {
            ...state.varCtx,
            [name]: {
              type: resolvedType,
              isRead: false,
              isInitialized: true,
              value,
              jsName,
            },
          },
          stdinIdx: state.stdinIdx,
          nextBindingIdx: state.nextBindingIdx + 1,
          error: null,
        };
      }
    },
    {
      varDecls: [],
      varCtx: {},
      stdinIdx: 0,
      nextBindingIdx: 0,
      error: null,
    },
  );

  if (processState.error) {
    return new Err(processState.error);
  }

  const varDeclarations = processState.varDecls;
  Object.assign(variableContext, processState.varCtx);

  // If we had variable declarations, handle special code generation
  if (hasLetDeclarations) {
    // Let bindings are immutable after declaration
    if (currentInput.includes("=")) {
      return new Err({
        code: CompilationErrorCode.PARSE_ERROR,
        erroneousValue: input,
        message: "Unable to parse input",
        reason: "Let bindings are immutable and cannot be reassigned",
        fix: "Create a new let declaration instead of assigning to an existing name",
      });
    }

    // Validate all variable references are defined
    let i = 0;
    while (i < currentInput.length) {
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
          // This might be a type suffix like "U8" or "U16"
          if (!TYPE_RANGES.has(ident)) {
            return new Err({
              code: CompilationErrorCode.PARSE_ERROR,
              erroneousValue: input,
              message: "Unable to parse input",
              reason: `Undefined variable '${ident}'`,
              fix: `Declare the variable before using it`,
            });
          }
        } else if (binding && !binding.isInitialized) {
          return new Err({
            code: CompilationErrorCode.PARSE_ERROR,
            erroneousValue: input,
            message: "Unable to parse input",
            reason: `Variable '${ident}' is declared but not initialized`,
            fix: `Initialize '${ident}' at declaration time before using it`,
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
      hasReadVars || hasReadInExpr
        ? "const __stdinValues = __stdin.split(' ');\n"
        : "";

    // Add variable declarations
    for (const decl of varDeclarations) {
      code += `const ${decl.jsName} = ${decl.initCode};\n`;
    }

    code += exprCompileResult.value;
    return new Ok(code);
  }

  // Check for chained operations (e.g., "100U8 + 50U8 + 30U8")
  // Find all operators in the input
  const operatorsWithPositions = getOperatorsWithPositions(input);

  if (operatorsWithPositions.length > 0) {
    // Parse all operands
    const operands = extractOperands(input, operatorsWithPositions);

    // Parse each operand
    const operators = operatorsWithPositions.map((o) => o.op);
    let parsedOperands: BinaryOperandValue[] = [];

    for (const operand of operands) {
      const result = parseOperandForBinaryOp(operand);
      if (result.isErr()) {
        return result;
      }
      parsedOperands = [...parsedOperands, result.value];
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
      const operandCodeState = parsedOperands.reduce(
        (state, operand) => {
          if (operand.isRead) {
            return {
              operandCodes: [
                ...state.operandCodes,
                generateReadOperandCode(state.readIndex),
              ],
              readIndex: state.readIndex + 1,
            };
          }

          return {
            operandCodes: [
              ...state.operandCodes,
              (operand.value as number).toString(),
            ],
            readIndex: state.readIndex,
          };
        },
        { operandCodes: [] as string[], readIndex: 0 },
      );
      const { operandCodes } = operandCodeState;

      // Build the chained operation
      const operationCode = operators.reduce((code, op, index) => {
        const nextOperandCode = operandCodes[index + 1];
        if (op === "/") {
          return `Math.floor(${code} / ${nextOperandCode})`;
        }
        return `(${code} ${op} ${nextOperandCode})`;
      }, operandCodes[0]);

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

interface VariableBinding {
  type: string;
  value?: number;
  isRead: boolean;
  isInitialized: boolean;
  jsName: string;
}

interface VariableContext {
  [name: string]: VariableBinding;
}

interface VariableDeclaration {
  name: string;
  type: string;
  initCode: string;
  jsName: string;
}

interface ParsedVariableDeclaration {
  name: string;
  type: string | null;
  initializer: string | null;
  remaining: string;
}

interface ParseAllDeclsResult {
  decls: ParsedVariableDeclaration[];
  remaining: string;
}

function parseVariableDeclaration(
  input: string,
): Result<ParsedVariableDeclaration, CompilationError> {
  // Find the variable name
  let nameEnd = 4; // skip "let "
  while (
    nameEnd < input.length &&
    input[nameEnd] !== " " &&
    input[nameEnd] !== ":"
  ) {
    nameEnd++;
  }
  const name = input.substring(4, nameEnd);

  // Validate variable name is alphanumeric
  for (let i = 0; i < name.length; i++) {
    if (!(isDigit(name[i]) || isLetter(name[i]))) {
      return new Err({
        code: CompilationErrorCode.PARSE_ERROR,
        erroneousValue: input,
        message: "Invalid variable name",
        reason: `Variable name must contain only letters and digits`,
        fix: `Use a name like 'x' or 'var1'`,
      });
    }
  }

  // Parse optional type and optional initializer
  let cursor = nameEnd;
  while (cursor < input.length && input[cursor] === " ") {
    cursor++;
  }

  let varType: string | null = null;
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
    if (!TYPE_RANGES.has(varType)) {
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
  let semicolonPos = hasInitializer ? cursor + 1 : cursor;
  let depth = 0;
  while (semicolonPos < input.length) {
    if (input[semicolonPos] === "<") {
      depth++;
    } else if (input[semicolonPos] === ">") {
      depth--;
    } else if (input[semicolonPos] === ";" && depth === 0) {
      break;
    }
    semicolonPos++;
  }

  if (semicolonPos >= input.length || input[semicolonPos] !== ";") {
    return new Err(
      createVariableDeclarationSyntaxError(
        input,
        "Expected ';' to end variable declaration",
      ),
    );
  }

  if (!hasInitializer && varType === null) {
    return new Err(
      createVariableDeclarationSyntaxError(
        input,
        "Expected ':' or '=' after variable name",
      ),
    );
  }

  if (!hasInitializer && varType !== null && input[cursor] !== ";") {
    return new Err(
      createVariableDeclarationSyntaxError(input, "Expected '=' after type"),
    );
  }

  let initializer: string | null = null;
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
    type: varType,
    initializer,
    remaining,
  });
}
