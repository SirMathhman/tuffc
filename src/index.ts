import { Result, ok, err, type DescriptiveError } from "./result";

export type InterpretError = DescriptiveError;

function extractNumericPart(input: string): string | undefined {
  let i = 0;
  if (input[i] === "-") {
    i++;
  }
  if (i >= input.length || !isDigit(input[i])) {
    return undefined;
  }
  while (i < input.length && isDigit(input[i])) {
    i++;
  }
  return input.slice(0, i);
}

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function isUnsignedTypeSuffix(suffix: string): boolean {
  if (suffix.length < 2 || suffix[0] !== "U") {
    return false;
  }
  const typeSizeStr = suffix.slice(1);
  if (typeSizeStr.length === 0) {
    return false;
  }
  for (let i = 0; i < typeSizeStr.length; i++) {
    if (!isDigit(typeSizeStr[i])) {
      return false;
    }
  }
  return true;
}

function getUnsignedTypeRange(
  suffix: string,
): { min: number; max: number } | undefined {
  if (!isUnsignedTypeSuffix(suffix)) {
    return undefined;
  }
  const bitSize = parseInt(suffix.slice(1), 10);
  return {
    min: 0,
    max: Math.pow(2, bitSize) - 1,
  };
}

function getTypeBitSize(suffix: string): number | undefined {
  if (!isUnsignedTypeSuffix(suffix)) {
    return undefined;
  }
  return parseInt(suffix.slice(1), 10);
}

function promoteTypes(type1: string, type2: string): string | undefined {
  if (type1 === type2) {
    return type1;
  }
  const size1 = getTypeBitSize(type1);
  const size2 = getTypeBitSize(type2);
  if (size1 === undefined || size2 === undefined) {
    return undefined;
  }
  return size1 > size2 ? type1 : type2;
}

function createTypeMismatchError(
  input: string,
  leftType: string,
  rightType: string,
): InterpretError {
  return {
    source: input,
    description: "Type mismatch in addition",
    reason: `Cannot add values of different types: ${leftType} and ${rightType}`,
    fix: "Use operands with the same type or ensure both have matching type suffixes",
  };
}

function parseOperandTypes(
  leftStr: string,
  rightStr: string,
): Result<{ leftType: string; rightType: string }, InterpretError> {
  const leftResult = parseTypedValue(leftStr);
  if (leftResult.isFailure()) {
    return leftResult;
  }
  const leftSuffix = leftResult.value.suffix;

  const rightResult = parseTypedValue(rightStr);
  if (rightResult.isFailure()) {
    return rightResult;
  }
  const rightSuffix = rightResult.value.suffix;

  const leftType = leftSuffix.length > 0 ? leftSuffix : "I32";
  const rightType = rightSuffix.length > 0 ? rightSuffix : "I32";

  return ok({ leftType, rightType });
}

function checkAndPromoteTypes(
  input: string,
  leftType: string,
  rightType: string,
  allowExplicitPromotion: boolean = true,
): Result<string, InterpretError> {
  if (leftType === rightType) {
    return ok(leftType);
  }
  // Handle untyped (I32) values - always allow promotion to match the typed value
  if (rightType === "I32" && leftType.startsWith("U")) {
    return ok(leftType);
  }
  if (leftType === "I32" && rightType.startsWith("U")) {
    return ok(rightType);
  }
  // For explicit types, allow promotion to wider types
  if (leftType.startsWith("U") && rightType.startsWith("U")) {
    const promoted = promoteTypes(leftType, rightType);
    if (promoted !== undefined) {
      // Always allow if one of the operands is already the promoted type (widening)
      if (promoted === leftType || promoted === rightType) {
        return ok(promoted);
      }
      //  Only allow arbitrary promotion if explicitly enabled
      if (allowExplicitPromotion) {
        return ok(promoted);
      }
    }
  }
  return err(createTypeMismatchError(input, leftType, rightType));
}

function parseNumericPartOrError(
  input: string,
  numericPart: string | undefined,
): Result<number, InterpretError> {
  if (numericPart === undefined) {
    return err({
      source: input,
      description: "Failed to parse input as a number",
      reason: "The input string cannot be converted to a valid integer",
      fix: "Provide a valid numeric string (e.g., '42', '100', '-5')",
    });
  }
  return ok(parseInt(numericPart, 10));
}

function parseTypedValue(
  input: string,
): Result<{ value: number; suffix: string }, InterpretError> {
  const numericPart = extractNumericPart(input);
  if (numericPart === undefined) {
    return err({
      source: input,
      description: "Failed to parse input as a number",
      reason: "The input string cannot be converted to a valid integer",
      fix: "Provide a valid numeric string (e.g., '42', '100', '-5')",
    });
  }

  const value = parseInt(numericPart, 10);
  const suffix = input.slice(numericPart.length);

  return ok({ value, suffix });
}

function getAdditionResultType(
  input: string,
  leftStr: string,
  rightStr: string,
): Result<string, InterpretError> {
  const typesResult = parseOperandTypes(leftStr, rightStr);
  if (typesResult.isFailure()) {
    return typesResult;
  }
  const { leftType, rightType } = typesResult.value;

  // Allow promotion for simple operands (both are literals)
  return checkAndPromoteTypes(input, leftType, rightType, true);
}

function getExpressionResultType(
  expr: string,
  sourceForErrors: string = expr,
): Result<string, InterpretError> {
  // Determine the result type of an expression (used for chained additions)
  const plusIndex = expr.indexOf(" + ");
  if (plusIndex === -1) {
    // Simple value, extract its type
    const numPart = extractNumericPart(expr);
    if (numPart === undefined) {
      return err({
        source: sourceForErrors,
        description: "Failed to parse input as a number",
        reason: "The input string cannot be converted to a valid integer",
        fix: "Provide a valid numeric string (e.g., '42', '100', '-5')",
      });
    }
    const suffix = expr.slice(numPart.length);
    const type = suffix.length > 0 ? suffix : "I32";
    return ok(type);
  }
  // Chained addition: reject mixing of different explicit types
  const leftStr = expr.slice(0, plusIndex);
  const rightStr = expr.slice(plusIndex + 3);

  const typesResult = parseOperandTypes(leftStr, rightStr);
  if (typesResult.isFailure()) {
    return typesResult;
  }
  const { leftType, rightType } = typesResult.value;

  // In a chain, reject mixing of different explicit types (e.g., U16 + U8)
  if (leftType !== rightType && leftType !== "I32" && rightType !== "I32") {
    return err(createTypeMismatchError(sourceForErrors, leftType, rightType));
  }

  // Allow untyped values to promote to match explicit types
  return checkAndPromoteTypes(sourceForErrors, leftType, rightType, false);
}

function isValidFieldType(
  typeStr: string,
  genericParams?: Set<string>,
): boolean {
  const trimmed = typeStr.trim();
  // Valid types: I32, U8, U16, U32, U64, I8, I16, I64
  const validTypes = ["I32", "U8", "U16", "U32", "U64", "I8", "I16", "I64"];
  if (validTypes.includes(trimmed)) return true;
  // Check if it's a generic type parameter
  if (genericParams && genericParams.has(trimmed)) return true;
  return false;
}

function validateStructDefinitions(
  input: string,
): Result<undefined, InterpretError> {
  const lines = input.split("\n");
  const structNames = new Set<string>();
  let currentStructName: string | undefined;
  let currentGenericParams: Set<string> = new Set();
  const structFields = new Map<string, Set<string>>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check for struct declaration
    if (trimmedLine.startsWith("struct ")) {
      const colonIndex = trimmedLine.indexOf("{");
      if (colonIndex !== -1) {
        const structNamePart = trimmedLine.slice(7, colonIndex).trim();

        // Extract struct name and generic parameters
        const angleIndex = structNamePart.indexOf("<");
        let structName: string;
        if (angleIndex !== -1) {
          structName = structNamePart.slice(0, angleIndex).trim();
          const genericPartEnd = structNamePart.indexOf(">");
          if (genericPartEnd !== -1) {
            const genericParamStr = structNamePart.slice(
              angleIndex + 1,
              genericPartEnd,
            );
            currentGenericParams = new Set(
              genericParamStr.split(",").map((p) => p.trim()),
            );
          }
        } else {
          structName = structNamePart;
          currentGenericParams = new Set();
        }

        if (structNames.has(structName)) {
          return err({
            source: input,
            description: "Duplicate struct declaration",
            reason: `duplicate struct definition: '${structName}' is declared multiple times`,
            fix: "Remove the duplicate struct declaration or use a different name",
          });
        }
        structNames.add(structName);
        currentStructName = structName;
        structFields.set(structName, new Set<string>());
      }
    } else if (
      currentStructName &&
      trimmedLine.includes(":") &&
      !trimmedLine.startsWith("}")
    ) {
      // Parse field declaration: "fieldName : Type;"
      const colonIndex = trimmedLine.indexOf(":");
      if (colonIndex !== -1) {
        const fieldName = trimmedLine.slice(0, colonIndex).trim();
        const fields = structFields.get(currentStructName)!;
        if (fields.has(fieldName)) {
          return err({
            source: input,
            description: "Duplicate field in struct",
            reason: `duplicate field declaration: '${fieldName}' is declared multiple times in struct '${currentStructName}'`,
            fix: "Remove the duplicate field or use a different field name",
          });
        }
        fields.add(fieldName);

        // Extract and validate the type
        const typePartStr = trimmedLine.slice(colonIndex + 1);
        const semicolonIndex = typePartStr.indexOf(";");
        const typeStr =
          semicolonIndex !== -1
            ? typePartStr.slice(0, semicolonIndex).trim()
            : typePartStr.trim();

        if (!isValidFieldType(typeStr, currentGenericParams)) {
          return err({
            source: input,
            description: "Unknown field type",
            reason: `unknown type '${typeStr}' in field '${fieldName}' of struct '${currentStructName}'`,
            fix: "Use a valid type like I32, U8, U16, U32, U64, I8, I16, or I64",
          });
        }
      }
    }

    // Check for struct closing
    if (trimmedLine === "}") {
      currentStructName = undefined;
      currentGenericParams = new Set();
    }
  }

  return ok(undefined);
}

function handleAddition(
  input: string,
  leftStr: string,
  rightStr: string,
  variables: Map<string, number> = new Map(),
): Result<number, InterpretError> {
  const leftResult = parseTypedValue(leftStr);
  if (leftResult.isFailure()) {
    return leftResult;
  }
  const leftValue = leftResult.value.value;
  const leftSuffix = leftResult.value.suffix;

  // Recursively interpret the right side (handles chained additions)
  const rightResult = interpretWithVars(rightStr, variables);
  if (rightResult.isFailure()) {
    return rightResult;
  }
  const rightValue = rightResult.value;

  // For chained additions, determine the right side's type.
  // If right side is a simple value, extract the suffix.
  // If it's a chained addition (has " + "), determine the result type recursively.
  const rightHasAddition = rightStr.indexOf(" + ") !== -1;
  let rightSuffix = "";
  if (!rightHasAddition) {
    const rightNumPart = extractNumericPart(rightStr);
    rightSuffix =
      rightNumPart !== undefined ? rightStr.slice(rightNumPart.length) : "";
  }

  const leftType = leftSuffix.length > 0 ? leftSuffix : "I32";
  let rightType: string;
  if (rightHasAddition) {
    const typeResult = getExpressionResultType(rightStr, input);
    if (typeResult.isFailure()) {
      return typeResult;
    }
    rightType = typeResult.value;
  } else {
    rightType = rightSuffix.length > 0 ? rightSuffix : "I32";
  }

  // Don't allow promotion between different explicit types if right is computed
  const typeResult = checkAndPromoteTypes(
    input,
    leftType,
    rightType,
    !rightHasAddition,
  );
  if (typeResult.isFailure()) {
    return typeResult;
  }
  const resultType = typeResult.value;

  const range = getUnsignedTypeRange(resultType);
  const sum = leftValue + rightValue;
  if (range !== undefined && (sum < range.min || sum > range.max)) {
    return err({
      source: input,
      description: "Arithmetic overflow",
      reason: `overflow: the sum ${sum} exceeds the range of type ${resultType} [${range.min}, ${range.max}]`,
      fix: `Use a larger type suffix (e.g., ${resultType === "U8" ? "U16" : "U32"}) or reduce operand values`,
    });
  }

  return ok(sum);
}

function isValidVariableName(name: string): boolean {
  if (name.length === 0) return false;
  // First character must be a letter or underscore
  const firstChar = name[0];
  if (
    !(firstChar >= "a" && firstChar <= "z") &&
    !(firstChar >= "A" && firstChar <= "Z") &&
    firstChar !== "_"
  ) {
    return false;
  }
  // Rest must be alphanumeric or underscore
  for (let i = 1; i < name.length; i++) {
    const char = name[i];
    if (
      !(char >= "a" && char <= "z") &&
      !(char >= "A" && char <= "Z") &&
      !(char >= "0" && char <= "9") &&
      char !== "_"
    ) {
      return false;
    }
  }
  return true;
}

function processVariableDeclarations(
  input: string,
  variables: Map<string, number>,
): Result<Map<string, number>, InterpretError> {
  const lines = input.split("\n");
  const varMap = new Map(variables);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("let ")) {
      const equalIndex = trimmedLine.indexOf("=");
      if (equalIndex === -1) {
        return err({
          source: input,
          description: "Invalid variable declaration",
          reason: "Variable declaration must have an '=' sign",
          fix: "Use syntax: let varName = value;",
        });
      }

      const varName = trimmedLine.slice(4, equalIndex).trim();
      let valueStr = trimmedLine.slice(equalIndex + 1).trim();
      if (valueStr.endsWith(";")) {
        valueStr = valueStr.slice(0, -1);
      }

      if (!isValidVariableName(varName)) {
        return err({
          source: input,
          description: "Invalid variable name",
          reason: `Variable name '${varName}' is invalid`,
          fix: "Use valid identifier names (alphanumeric and underscore)",
        });
      }

      const valueResult = interpretWithVars(valueStr, varMap);
      if (valueResult.isFailure()) {
        return valueResult;
      }

      varMap.set(varName, valueResult.value);
    }
  }

  return ok(varMap);
}

function validateTypeSuffix(
  input: string,
  parsed: number,
  typeSuffix: string,
): Result<undefined, InterpretError> {
  if (parsed < 0 && isUnsignedTypeSuffix(typeSuffix)) {
    return err({
      source: input,
      description: "Negative value with unsigned type",
      reason: `Type suffix ${typeSuffix} is unsigned, but the value is negative`,
      fix: `Use a signed type suffix (e.g., 'I8' instead of 'U8') or remove the negative sign`,
    });
  }

  if (typeSuffix.length > 0) {
    const range = getUnsignedTypeRange(typeSuffix);
    if (range !== undefined && (parsed < range.min || parsed > range.max)) {
      return err({
        source: input,
        description: `Value out of range for type ${typeSuffix}`,
        reason: `The value ${parsed} is out of range for type ${typeSuffix}. Valid range is [${range.min}, ${range.max}]`,
        fix: `Use a value within the range [${range.min}, ${range.max}] or use a larger type suffix`,
      });
    }
  }

  return ok(undefined);
}

function interpretWithVars(
  input: string,
  variables: Map<string, number> = new Map(),
): Result<number, InterpretError> {
  if (input === "") {
    return ok(0);
  }

  // Handle multiline input with variable declarations
  if (input.includes("let ")) {
    const processResult = processVariableDeclarations(input, variables);
    if (processResult.isFailure()) {
      return processResult;
    }
    const varMap = processResult.value;

    // After processing declarations, evaluate the last non-declaration line
    const lines = input.split("\n");
    const lastLine = lines[lines.length - 1].trim();
    if (!lastLine.startsWith("let ") && lastLine.length > 0) {
      return interpretWithVars(lastLine, varMap);
    }

    return ok(0);
  }

  // Handle multiline input with struct declarations
  if (input.includes("struct ")) {
    const validationResult = validateStructDefinitions(input);
    if (validationResult.isFailure()) {
      return validationResult;
    }
    return ok(0);
  }

  // Check if input is a variable reference
  if (variables.has(input)) {
    return ok(variables.get(input)!);
  }

  // Handle parenthesized expressions
  if (input[0] === "(" && input[input.length - 1] === ")") {
    // Recursively evaluate the inner expression
    return interpretWithVars(input.slice(1, -1), variables);
  }

  // Check for type compatibility check syntax BEFORE addition
  // This allows "is" checks to contain addition expressions
  const isKeywordIndex = input.indexOf(" is ");
  if (isKeywordIndex !== -1) {
    const valueWithSuffix = input.slice(0, isKeywordIndex);
    const targetTypeSuffix = input.slice(isKeywordIndex + 4);

    // Strip outer parentheses from valueWithSuffix if present
    let evaluateExpr = valueWithSuffix;
    if (
      evaluateExpr[0] === "(" &&
      evaluateExpr[evaluateExpr.length - 1] === ")"
    ) {
      evaluateExpr = evaluateExpr.slice(1, -1);
    }

    // Check if the expression is an addition
    const additionIndex = evaluateExpr.indexOf(" + ");
    let effectiveTypeSuffix: string;
    if (additionIndex !== -1) {
      const leftStr = evaluateExpr.slice(0, additionIndex);
      const rightStr = evaluateExpr.slice(additionIndex + 3);
      const typeResult = getAdditionResultType(input, leftStr, rightStr);
      if (typeResult.isFailure()) {
        return typeResult;
      }
      effectiveTypeSuffix = typeResult.value;
    } else {
      // Parse the value with its suffix
      const numericPart = extractNumericPart(evaluateExpr);
      if (numericPart === undefined) {
        return err({
          source: input,
          description: "Failed to parse input as a number",
          reason: "The input string cannot be converted to a valid integer",
          fix: "Provide a valid numeric string (e.g., '42', '100', '-5')",
        });
      }

      // Extract the original type suffix from the value
      const originalTypeSuffix = evaluateExpr.slice(numericPart.length);

      // Determine the effective type suffix (use I32 as implicit default)
      effectiveTypeSuffix =
        originalTypeSuffix.length > 0 ? originalTypeSuffix : "I32";
    }

    // Check if effective type matches target type
    const typeMatches = effectiveTypeSuffix === targetTypeSuffix;
    return ok(typeMatches ? 1 : 0);
  }

  // Check for addition operator
  const plusIndex = input.indexOf(" + ");
  if (plusIndex !== -1) {
    const leftStr = input.slice(0, plusIndex);
    const rightStr = input.slice(plusIndex + 3);
    return handleAddition(input, leftStr, rightStr, variables);
  }

  // Extract numeric part and type suffix
  const numericPart = extractNumericPart(input);
  const parseResult = parseNumericPartOrError(input, numericPart);
  if (parseResult.isFailure()) {
    return parseResult;
  }
  const parsed = parseResult.value;

  // Check for unsigned type suffix with negative value
  const typeSuffix = input.slice(numericPart!.length);
  const validationResult = validateTypeSuffix(input, parsed, typeSuffix);
  if (validationResult.isFailure()) {
    return validationResult;
  }

  return ok(parsed);
}

export function interpret(input: string): Result<number, InterpretError> {
  return interpretWithVars(input);
}

// Read and interpret the .tuff file
const tuffFilePath = import.meta.dir + "/index.tuff";
const tuffContent = await Bun.file(tuffFilePath).text();
const result = interpret(tuffContent.trim());

if (result.isSuccess()) {
  console.log(`Result: ${result.value}`);
} else {
  console.error(`Source: ${result.error.source}`);
  console.error(`Error: ${result.error.description}`);
  console.error(`Reason: ${result.error.reason}`);
  console.error(`Fix: ${result.error.fix}`);
}
