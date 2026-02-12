import { Result, ok, err, type DescriptiveError } from "./result";

export type InterpretError = DescriptiveError;

type InterpreterContext = {
  variables?: Map<string, number>;
  variableTypes?: Map<string, string>;
  typeAliases?: Map<string, string>;
  functions?: Map<
    string,
    { body: string; returnType: string; params: string[] }
  >;
  stringVariables?: Map<string, string>;
};

function createDefaultContext(): InterpreterContext {
  return {
    variables: new Map(),
    variableTypes: new Map(),
    typeAliases: new Map(),
    functions: new Map(),
    stringVariables: new Map(),
  };
}

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

function extractTypeAliases(
  input: string,
): Result<Map<string, string>, InterpretError> {
  const lines = input.split("\n");
  const typeAliases = new Map<string, string>();

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("type ")) {
      const equalIndex = trimmedLine.indexOf("=");
      if (equalIndex !== -1) {
        const aliasNamePart = trimmedLine.slice(5, equalIndex).trim();

        // Handle generic type aliases by extracting just the base name
        let aliasName = aliasNamePart;
        const angleIndex = aliasNamePart.indexOf("<");
        if (angleIndex !== -1) {
          aliasName = aliasNamePart.slice(0, angleIndex).trim();
        }

        let baseName = trimmedLine.slice(equalIndex + 1).trim();
        if (baseName.endsWith(";")) {
          baseName = baseName.slice(0, -1).trim();
        }

        if (!isValidVariableName(aliasName)) {
          return err({
            source: input,
            description: "Invalid type alias name",
            reason: `Type alias name '${aliasName}' is invalid`,
            fix: "Use valid identifier names (alphanumeric and underscore)",
          });
        }

        if (typeAliases.has(aliasName)) {
          return err({
            source: input,
            description: "Duplicate type alias",
            reason: `type alias '${aliasName}' is declared multiple times`,
            fix: "Use a different alias name or remove the duplicate declaration",
          });
        }

        typeAliases.set(aliasName, baseName);
      }
    }
  }

  return ok(typeAliases);
}

function processFunctionDefinitionLine(
  trimmedLine: string,
  input: string,
  existingFunctions: Set<string>,
): Result<
  { name: string; body: string; returnType: string; params: string[] },
  InterpretError
> {
  const arrowIndex = trimmedLine.indexOf("=>");
  if (arrowIndex === -1) {
    return err({
      source: input,
      description: "Invalid function definition",
      reason: "Function definition must have '=>' arrow",
      fix: "Use syntax: fn name() : ReturnType => body;",
    });
  }

  const headerPart = trimmedLine.slice(3, arrowIndex).trim();
  const parenIndex = headerPart.indexOf("(");
  if (parenIndex === -1) {
    return err({
      source: input,
      description: "Invalid function definition",
      reason: "Function must have parentheses",
      fix: "Use syntax: fn name() : ReturnType => body;",
    });
  }

  let funcName = headerPart.slice(0, parenIndex).trim();
  const angleIndex = funcName.indexOf("<");
  if (angleIndex !== -1) {
    funcName = funcName.slice(0, angleIndex).trim();
  }

  if (!isValidVariableName(funcName)) {
    return err({
      source: input,
      description: "Invalid function name",
      reason: `Function name '${funcName}' is invalid`,
      fix: "Use valid identifier names (alphanumeric and underscore)",
    });
  }

  if (existingFunctions.has(funcName)) {
    return err({
      source: input,
      description: "Duplicate function definition",
      reason: `function '${funcName}' is declared multiple times`,
      fix: "Use a different function name or remove the duplicate",
    });
  }

  const closeParenIndex = headerPart.indexOf(")");
  const colonIndex = headerPart.indexOf(":");

  // Extract parameters
  const paramsResult = extractFunctionParameters(
    headerPart,
    parenIndex,
    closeParenIndex,
    funcName,
    input,
  );
  if (paramsResult.isFailure()) {
    return paramsResult;
  }
  const params = paramsResult.value;

  // Extract return type
  let returnType = "I32";
  if (
    colonIndex !== -1 &&
    closeParenIndex !== -1 &&
    colonIndex > closeParenIndex
  ) {
    returnType = headerPart.slice(colonIndex + 1).trim();
    if (!isValidFieldType(returnType, undefined, new Map())) {
      return err({
        source: input,
        description: "Unknown return type",
        reason: `unknown return type '${returnType}' in function '${funcName}'`,
        fix: "Use a valid return type like I32, U8, U16, U32, U64, I8, I16, or I64",
      });
    }
  } else if (colonIndex !== -1 && closeParenIndex === -1) {
    return err({
      source: input,
      description: "Invalid function definition",
      reason: "Function must have parentheses",
      fix: "Use syntax: fn name() => body; or fn name() : ReturnType => body;",
    });
  }

  let bodyStr = trimmedLine.slice(arrowIndex + 2).trim();
  if (bodyStr.endsWith(";")) {
    bodyStr = bodyStr.slice(0, -1).trim();
  }

  return ok({ name: funcName, body: bodyStr, returnType, params });
}

function extractFunctionParameters(
  headerPart: string,
  parenIndex: number,
  closeParenIndex: number,
  funcName: string,
  input: string,
): Result<string[], InterpretError> {
  const params: string[] = [];
  if (closeParenIndex > parenIndex + 1) {
    const paramString = headerPart
      .slice(parenIndex + 1, closeParenIndex)
      .trim();
    if (paramString.length > 0) {
      const paramParts = paramString.split(",");
      const seenParams = new Set<string>();
      for (const part of paramParts) {
        const trimmedPart = part.trim();
        const colonIdx = trimmedPart.indexOf(":");
        const paramName =
          colonIdx !== -1 ? trimmedPart.slice(0, colonIdx).trim() : trimmedPart;
        if (paramName.length > 0) {
          if (seenParams.has(paramName)) {
            return err({
              source: input,
              description: "Duplicate parameter name",
              reason: `parameter '${paramName}' is declared multiple times in function '${funcName}'`,
              fix: "Use different parameter names",
            });
          }
          seenParams.add(paramName);
          params.push(paramName);

          if (colonIdx !== -1) {
            const paramType = trimmedPart.slice(colonIdx + 1).trim();
            if (!isValidFieldType(paramType, undefined, new Map())) {
              return err({
                source: input,
                description: "Unknown parameter type",
                reason: `unknown parameter type '${paramType}' in function '${funcName}'`,
                fix: "Use a valid type like I32, U8, U16, U32, U64, I8, I16, I64, or *Str",
              });
            }
          }
        }
      }
    }
  }
  return ok(params);
}

function extractFunctionDefinitions(
  input: string,
): Result<
  Map<string, { body: string; returnType: string; params: string[] }>,
  InterpretError
> {
  const lines = input.split("\n");
  const functions = new Map<
    string,
    { body: string; returnType: string; params: string[] }
  >();
  const existingFuncNames = new Set<string>();

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (line.length > 0 && line[0] === " " && trimmedLine.startsWith("fn ")) {
      continue;
    }

    if (trimmedLine.startsWith("fn ")) {
      const result = processFunctionDefinitionLine(
        trimmedLine,
        input,
        existingFuncNames,
      );
      if (result.isFailure()) {
        return result;
      }
      const funcDef = result.value;
      existingFuncNames.add(funcDef.name);
      functions.set(funcDef.name, {
        body: funcDef.body,
        returnType: funcDef.returnType,
        params: funcDef.params,
      });
    }
  }

  return ok(functions);
}

function resolveTypeAlias(
  typeStr: string,
  typeAliases: Map<string, string>,
): string {
  if (typeAliases.has(typeStr)) {
    return typeAliases.get(typeStr)!;
  }
  return typeStr;
}

function isValidFieldType(
  typeStr: string,
  genericParams?: Set<string>,
  typeAliases?: Map<string, string>,
): boolean {
  const trimmed = typeStr.trim();
  const resolved = typeAliases
    ? resolveTypeAlias(trimmed, typeAliases)
    : trimmed;
  // Valid types: I32, U8, U16, U32, U64, I8, I16, I64, *Str
  const validTypes = [
    "I32",
    "U8",
    "U16",
    "U32",
    "U64",
    "I8",
    "I16",
    "I64",
    "*Str",
  ];
  if (validTypes.includes(resolved)) return true;
  // Check if it's a generic type parameter
  if (genericParams && genericParams.has(resolved)) return true;
  return false;
}

function validateStructDefinitions(
  input: string,
  typeAliases: Map<string, string> = new Map(),
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

        if (!isValidFieldType(typeStr, currentGenericParams, typeAliases)) {
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
  ctx: InterpreterContext = createDefaultContext(),
): Result<number, InterpretError> {
  const variables = ctx.variables || new Map();
  const variableTypes = ctx.variableTypes || new Map();
  const typeAliases = ctx.typeAliases || new Map();
  const functions = ctx.functions || new Map();
  const stringVariables = ctx.stringVariables || new Map();
  // Recursively interpret the left side (can be variable or expression)
  const leftResult = interpretWithVars(
    leftStr,
    variables,
    variableTypes,
    typeAliases,
    functions,
    stringVariables,
  );
  if (leftResult.isFailure()) {
    return leftResult;
  }
  const leftValue = leftResult.value;

  // Recursively interpret the right side (handles chained additions)
  const rightResult = interpretWithVars(
    rightStr,
    variables,
    variableTypes,
    typeAliases,
    functions,
    stringVariables,
  );
  if (rightResult.isFailure()) {
    return rightResult;
  }
  const rightValue = rightResult.value;

  // Determine the left side's type - check if it's a literal with suffix or a variable
  let leftSuffix: string;
  const leftNumPart = extractNumericPart(leftStr);
  if (leftNumPart !== undefined) {
    leftSuffix = leftStr.slice(leftNumPart.length);
  } else if (variables.has(leftStr)) {
    // Left side is a variable - use its type
    leftSuffix = variableTypes.get(leftStr) || "I32";
  } else {
    leftSuffix = "I32";
  }

  let rightSuffix = "";
  const rightHasAddition = rightStr.indexOf(" + ") !== -1;
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

function determineAssignedValueType(
  valueStr: string,
  typeMap: Map<string, string>,
): string | undefined {
  // Check if valueStr is a variable reference
  if (isValidVariableName(valueStr) && typeMap.has(valueStr)) {
    // valueStr is a variable reference; use its tracked type
    return typeMap.get(valueStr);
  }

  // valueStr is a numeric literal; extract its type
  const numericPart = extractNumericPart(valueStr);
  if (numericPart !== undefined) {
    const valueSuffix = valueStr.slice(numericPart.length);
    return valueSuffix.length > 0 ? valueSuffix : "I32";
  }

  return undefined;
}
function interpretNumericLiteral(
  input: string,
  variables: Map<string, number> = new Map(),
): Result<number, InterpretError> {
  // Check if input is a valid variable name that's not defined
  if (isValidVariableName(input) && !variables.has(input)) {
    return err({
      source: input,
      description: "Undefined variable",
      reason: `Variable '${input}' is not defined`,
      fix: "Declare the variable first using 'let varName = value;' or pass it as a function parameter",
    });
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

function interpretEarlyReturns(
  input: string,
  variables: Map<string, number>,
  variableTypes: Map<string, string>,
  typeAliases: Map<string, string>,
  functions: Map<
    string,
    { body: string; returnType: string; params: string[] }
  >,
  stringVariables: Map<string, string>,
  extractedAliases: Map<string, string>,
): Result<number, InterpretError> | undefined {
  const functionCallResult = tryFunctionCall(
    input,
    functions,
    variables,
    variableTypes,
    extractedAliases,
  );
  if (functionCallResult !== undefined) {
    return functionCallResult;
  }

  if (variables.has(input)) {
    return ok(variables.get(input)!);
  }

  const propertyAccess = interpretPropertyAccess(
    input,
    variableTypes,
    stringVariables,
    variables,
  );
  if (propertyAccess !== undefined) {
    return propertyAccess;
  }

  const stringProp = tryStringLiteralProperty(input);
  if (stringProp !== undefined) {
    return stringProp;
  }

  if (input[0] === "(" && input[input.length - 1] === ")") {
    return interpretWithVars(
      input.slice(1, -1),
      variables,
      variableTypes,
      extractedAliases,
      functions,
      stringVariables,
    );
  }

  const isKeywordIndex = input.indexOf(" is ");
  if (isKeywordIndex !== -1) {
    return evaluateIsTypeCheck(input);
  }

  return undefined;
}

function interpretPropertyAccess(
  input: string,
  variableTypes: Map<string, string>,
  stringVariables: Map<string, string>,
  variables: Map<string, number> = new Map(),
): Result<number, InterpretError> | undefined {
  const dotIndex = input.indexOf(".");
  if (dotIndex === -1) {
    return undefined;
  }

  const varName = input.slice(0, dotIndex);
  const propertyName = input.slice(dotIndex + 1);

  // Handle this.x syntax to access variables
  if (varName === "this") {
    if (!isValidVariableName(propertyName)) {
      return err({
        source: input,
        description: "Invalid property name",
        reason: `Property name '${propertyName}' is invalid`,
        fix: "Use valid identifier names (alphanumeric and underscore)",
      });
    }

    if (!variables.has(propertyName)) {
      return err({
        source: input,
        description: "Undefined variable",
        reason: `Variable '${propertyName}' is not defined`,
        fix: "Declare the variable first using 'let varName = value;'",
      });
    }

    return ok(variables.get(propertyName)!);
  }

  // Check if this is a variable property access (not a number like 1.5)
  if (!isValidVariableName(varName)) {
    return undefined;
  }

  const varType = variableTypes.get(varName);
  if (varType !== "*Str") {
    return undefined;
  }

  const stringValue = stringVariables.get(varName);
  if (stringValue === undefined) {
    return err({
      source: input,
      description: "Undefined string variable",
      reason: `String variable '${varName}' has no value`,
      fix: "Assign a string literal to the variable",
    });
  }

  if (propertyName === "length") {
    return ok(stringValue.length);
  }

  return err(createStringPropertyError(input, propertyName));
}

function createStringPropertyError(
  input: string,
  propertyName: string,
): InterpretError {
  return {
    source: input,
    description: "Unknown string property",
    reason: `String property '${propertyName}' is not supported`,
    fix: "Use 'length' to get the string length",
  };
}

function createVariableDeclarationError(
  input: string,
  syntax: string,
): InterpretError {
  return {
    source: input,
    description: "Invalid variable declaration",
    reason: "Variable declaration must have an '=' sign",
    fix: `Use syntax: ${syntax}`,
  };
}

function parseVariableAssignment(
  line: string,
): Result<{ name: string; value: string }, string> {
  const trimmedLine = line.trim();
  const equalIndex = trimmedLine.indexOf("=");
  if (equalIndex === -1) {
    return err("No '=' found");
  }

  let nameStr = trimmedLine.slice(0, equalIndex).trim();
  // Remove 'let' prefix if present
  if (nameStr.startsWith("let ")) {
    nameStr = nameStr.slice(4).trim();
  }
  // Remove 'mut' prefix if present
  if (nameStr.startsWith("mut ")) {
    nameStr = nameStr.slice(4).trim();
  }

  let valueStr = trimmedLine.slice(equalIndex + 1).trim();
  if (valueStr.endsWith(";")) valueStr = valueStr.slice(0, -1);

  return ok({ name: nameStr, value: valueStr });
}

function extractStringFromLiteral(input: string): string | undefined {
  if (input.startsWith('"') && input.endsWith('"')) {
    return input.slice(1, -1);
  }
  return undefined;
}

function validateVariableAssignmentType(
  input: string,
  assignedValueType: string | undefined,
  declaredType: string | undefined,
): Result<undefined, InterpretError> {
  if (declaredType && assignedValueType && declaredType !== assignedValueType) {
    const valueBits = getTypeBitSize(assignedValueType);
    const declaredBits = getTypeBitSize(declaredType);
    if (
      valueBits !== undefined &&
      declaredBits !== undefined &&
      valueBits > declaredBits
    ) {
      return err({
        source: input,
        description: "Type mismatch in variable assignment",
        reason: `Cannot assign value of type '${assignedValueType}' to variable of type '${declaredType}'`,
        fix: `Use a value of type '${declaredType}' or change the variable type`,
      });
    }
  }

  if (declaredType) {
    // Determine numeric value for validation
    const numericPart = extractNumericPart(
      assignedValueType && assignedValueType.length > 0
        ? assignedValueType
        : "0",
    );
    const numValue = numericPart !== undefined ? parseInt(numericPart, 10) : 0;
    const validationResult = validateTypeSuffix(input, numValue, declaredType);
    if (validationResult.isFailure()) return validationResult;
  }

  return ok(undefined);
}

function processSingleVariableDeclaration(
  input: string,
  line: string,
  varMap: Map<string, number>,
  typeMap: Map<string, string>,
  declaredInThisScope: Set<string>,
  typeAliases: Map<string, string>,
  mutableVars?: Set<string>,
): Result<
  { varMap: Map<string, number>; typeMap: Map<string, string> },
  InterpretError
> {
  const parseResult = parseVariableAssignment(line);
  if (parseResult.isFailure()) {
    return err(createVariableDeclarationError(input, "let varName = value;"));
  }

  const { name: varNameWithSuffix, value: valueStr } = parseResult.value;

  // Check for 'mut' keyword that was already parsed
  const trimmedLine = line.trim();
  const beforeEqual = trimmedLine.slice(4, trimmedLine.indexOf("=")).trim();
  let isMutable = beforeEqual.startsWith("mut ");

  // Extract variable name and type annotation
  let nameStr = varNameWithSuffix;
  const colonIndex = nameStr.indexOf(":");
  const varName =
    colonIndex !== -1 ? nameStr.slice(0, colonIndex).trim() : nameStr;
  const typeAnnotation =
    colonIndex !== -1 ? nameStr.slice(colonIndex + 1).trim() : undefined;

  if (!isValidVariableName(varName)) {
    return err({
      source: input,
      description: "Invalid variable name",
      reason: `Variable name '${varName}' is invalid`,
      fix: "Use valid identifier names (alphanumeric and underscore)",
    });
  }
  if (declaredInThisScope.has(varName)) {
    return err({
      source: input,
      description: "Duplicate variable declaration",
      reason: `duplicate variable: '${varName}' is declared multiple times`,
      fix: "Use a different variable name or remove the duplicate declaration",
    });
  }

  const valueInterpretResult = interpretWithVars(
    valueStr,
    varMap,
    typeMap,
    typeAliases,
    new Map(),
    new Map(),
  );
  if (valueInterpretResult.isFailure()) return valueInterpretResult;
  const value = valueInterpretResult.value;

  if (
    typeAnnotation &&
    !isValidFieldType(typeAnnotation, undefined, typeAliases)
  ) {
    return err({
      source: input,
      description: "Unknown type annotation",
      reason: `unknown type '${typeAnnotation}' in variable declaration for '${varName}'`,
      fix: "Use a valid type like I32, U8, U16, U32, U64, I8, I16, or I64",
    });
  }

  const assignedValueType = determineAssignedValueType(valueStr, typeMap);
  const resolvedAnnotation = typeAnnotation
    ? resolveTypeAlias(typeAnnotation, typeAliases)
    : undefined;

  const typeCheckResult = validateVariableAssignmentType(
    input,
    assignedValueType,
    resolvedAnnotation,
  );
  if (typeCheckResult.isFailure()) return typeCheckResult;

  varMap.set(varName, value);
  typeMap.set(varName, resolvedAnnotation || assignedValueType || "I32");
  declaredInThisScope.add(varName);
  if (isMutable && mutableVars) {
    mutableVars.add(varName);
  }
  return ok({ varMap, typeMap });
}

function processSingleVariableReassignment(
  input: string,
  line: string,
  varMap: Map<string, number>,
  typeMap: Map<string, string>,
  mutableVars: Set<string>,
  typeAliases: Map<string, string>,
): Result<Map<string, number>, InterpretError> {
  const parseResult = parseVariableAssignment(line);
  if (parseResult.isFailure()) {
    return err({
      source: input,
      description: "Invalid reassignment",
      reason: "Reassignment must have an '=' sign",
      fix: "Use syntax: varName = value;",
    });
  }

  const { name: varName, value: valueStr } = parseResult.value;

  if (!varMap.has(varName)) {
    return err({
      source: input,
      description: "Undefined variable",
      reason: `Variable '${varName}' is not defined`,
      fix: "Declare the variable first using 'let varName = value;'",
    });
  }

  if (!mutableVars.has(varName)) {
    return err({
      source: input,
      description: "Cannot reassign immutable variable",
      reason: `Variable '${varName}' is not declared as mutable`,
      fix: "Declare the variable with 'let mut varName = value;'",
    });
  }

  const valueResult = interpretWithVars(
    valueStr,
    varMap,
    typeMap,
    typeAliases,
    new Map(),
    new Map(),
  );
  if (valueResult.isFailure()) return valueResult;
  const value = valueResult.value;

  const assignedValueType = determineAssignedValueType(valueStr, typeMap);
  const declaredType = typeMap.get(varName);

  const typeCheckResult = validateVariableAssignmentType(
    input,
    assignedValueType,
    declaredType,
  );
  if (typeCheckResult.isFailure()) return typeCheckResult;

  varMap.set(varName, value);
  return ok(varMap);
}

function processVariableDeclarations(
  input: string,
  variables: Map<string, number>,
  variableTypes: Map<string, string> = new Map(),
  typeAliases: Map<string, string> = new Map(),
  stringVariables: Map<string, string> = new Map(),
): Result<
  {
    varMap: Map<string, number>;
    typeMap: Map<string, string>;
    stringVarMap: Map<string, string>;
  },
  InterpretError
> {
  const lines = input.split("\n");
  const varMap = new Map(variables);
  const typeMap = new Map(variableTypes);
  const stringVarMap = new Map(stringVariables);
  const declaredInThisScope = new Set<string>();
  const mutableVars = new Set<string>();

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("let ")) {
      // Check if this is a string variable declaration
      const colonIndex = trimmedLine.indexOf(":");
      if (colonIndex !== -1) {
        const afterColon = trimmedLine
          .slice(colonIndex + 1, trimmedLine.indexOf("="))
          .trim();

        if (afterColon === "*Str") {
          // This is a string variable declaration
          const parseResult = parseVariableAssignment(line);
          if (parseResult.isFailure()) {
            return err(
              createVariableDeclarationError(
                input,
                'let varName : *Str = "value";',
              ),
            );
          }

          const { name: nameWithType, value: valueStr } = parseResult.value;
          const nameOnly = nameWithType
            .slice(0, nameWithType.indexOf(":"))
            .trim();

          // Extract string value from literal
          const stringValue = extractStringFromLiteral(valueStr);
          if (stringValue === undefined) {
            return err({
              source: input,
              description: "Invalid string assignment",
              reason: `String variable '${nameOnly}' must be assigned a string literal`,
              fix: 'Use syntax: let x : *Str = "value";',
            });
          }

          stringVarMap.set(nameOnly, stringValue);
          typeMap.set(nameOnly, "*Str");
          declaredInThisScope.add(nameOnly);
          continue;
        }
      }

      // Regular numeric variable declaration
      const result = processSingleVariableDeclaration(
        input,
        line,
        varMap,
        typeMap,
        declaredInThisScope,
        typeAliases,
        mutableVars,
      );
      if (result.isFailure()) {
        return result;
      }
    } else if (
      trimmedLine.includes("=") &&
      !trimmedLine.startsWith("let ") &&
      !trimmedLine.startsWith("fn ") &&
      !trimmedLine.startsWith("type ") &&
      !trimmedLine.startsWith("struct ")
    ) {
      // This looks like a reassignment
      const reassignResult = processSingleVariableReassignment(
        input,
        line,
        varMap,
        typeMap,
        mutableVars,
        typeAliases,
      );
      if (reassignResult.isFailure()) {
        return reassignResult;
      }
    }
  }

  return ok({ varMap, typeMap, stringVarMap });
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

function tryStringLiteralProperty(
  input: string,
): Result<number, InterpretError> | undefined {
  if (input.startsWith('"') && input.includes('".')) {
    const dotIndex = input.indexOf('".');
    if (dotIndex !== -1) {
      const stringContent = input.slice(1, dotIndex);
      const propertyName = input.slice(dotIndex + 2);

      if (propertyName === "length") {
        return ok(stringContent.length);
      }

      return err(createStringPropertyError(input, propertyName));
    }
  }
  return undefined;
}

function tryFunctionCall(
  input: string,
  functions: Map<
    string,
    { body: string; returnType: string; params: string[] }
  >,
  variables: Map<string, number>,
  variableTypes: Map<string, string>,
  typeAliases: Map<string, string>,
): Result<number, InterpretError> | undefined {
  // Match function calls with or without arguments: name() or name(arg1, arg2, ...)
  const openParenIndex = input.indexOf("(");
  const closeParenIndex = input.lastIndexOf(")");

  if (
    openParenIndex !== -1 &&
    closeParenIndex === input.length - 1 &&
    closeParenIndex > openParenIndex
  ) {
    const funcName = input.slice(0, openParenIndex).trim();
    if (functions.has(funcName)) {
      const funcDef = functions.get(funcName)!;
      const argString = input.slice(openParenIndex + 1, closeParenIndex).trim();

      // Parse arguments
      const args: number[] = [];
      if (argString.length > 0) {
        const argParts = argString.split(",");
        for (const argPart of argParts) {
          const trimmedArg = argPart.trim();
          const argResult = interpretWithVars(
            trimmedArg,
            variables,
            variableTypes,
            typeAliases,
            functions,
            new Map(),
          );
          if (argResult.isFailure()) {
            return argResult;
          }
          args.push(argResult.value);
        }
      }

      // Map parameters to argument values
      const paramVars = new Map(variables);
      const paramTypes = new Map(variableTypes);
      for (let i = 0; i < funcDef.params.length; i++) {
        if (i < args.length) {
          paramVars.set(funcDef.params[i], args[i]);
          paramTypes.set(funcDef.params[i], funcDef.returnType);
        }
      }

      return interpretWithVars(
        funcDef.body,
        paramVars,
        paramTypes,
        typeAliases,
        functions,
        new Map(),
      );
    }
  }
  return undefined;
}

function handleMultilineInput(
  input: string,
  extractedAliases: Map<string, string>,
  variables: Map<string, number>,
  variableTypes: Map<string, string>,
  stringVariables: Map<string, string> = new Map(),
): Result<number, InterpretError> {
  // Extract functions first
  let extractedFunctions = new Map<
    string,
    { body: string; returnType: string; params: string[] }
  >();
  if (input.includes("fn ")) {
    const functionsResult = extractFunctionDefinitions(input);
    if (functionsResult.isFailure()) {
      return functionsResult;
    }
    extractedFunctions = functionsResult.value;
  }

  // Update variables and types if there are let declarations
  let finalVars = variables;
  let finalTypes = variableTypes;
  let finalStringVars = stringVariables;
  if (input.includes("let ")) {
    const processResult = processVariableDeclarations(
      input,
      variables,
      variableTypes,
      extractedAliases,
      stringVariables,
    );
    if (processResult.isFailure()) {
      return processResult;
    }
    finalVars = processResult.value.varMap;
    finalTypes = processResult.value.typeMap;
    finalStringVars = processResult.value.stringVarMap;
  }

  // Evaluate the last non-declaration line
  const lines = input.split("\n");
  const lastLine = lines[lines.length - 1].trim();
  if (
    !lastLine.startsWith("let ") &&
    !lastLine.startsWith("type ") &&
    !lastLine.startsWith("fn ") &&
    !lastLine.startsWith("struct ") &&
    lastLine !== "}" &&
    lastLine.length > 0
  ) {
    return interpretWithVars(
      lastLine,
      finalVars,
      finalTypes,
      extractedAliases,
      extractedFunctions,
      finalStringVars,
    );
  }

  return ok(0);
}

function evaluateIsTypeCheck(input: string): Result<number, InterpretError> {
  const isKeywordIndex = input.indexOf(" is ");
  const valueWithSuffix = input.slice(0, isKeywordIndex);
  const targetTypeSuffix = input.slice(isKeywordIndex + 4);

  let evaluateExpr = valueWithSuffix;
  if (
    evaluateExpr[0] === "(" &&
    evaluateExpr[evaluateExpr.length - 1] === ")"
  ) {
    evaluateExpr = evaluateExpr.slice(1, -1);
  }

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
    const numericPart = extractNumericPart(evaluateExpr);
    if (numericPart === undefined) {
      return err({
        source: input,
        description: "Failed to parse input as a number",
        reason: "The input string cannot be converted to a valid integer",
        fix: "Provide a valid numeric string (e.g., '42', '100', '-5')",
      });
    }
    const originalTypeSuffix = evaluateExpr.slice(numericPart.length);
    effectiveTypeSuffix =
      originalTypeSuffix.length > 0 ? originalTypeSuffix : "I32";
  }

  const typeMatches = effectiveTypeSuffix === targetTypeSuffix;
  return ok(typeMatches ? 1 : 0);
}

function containsOnlyTypeDeclarations(input: string): boolean {
  const lines = input.split("\n");
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (
      trimmedLine.length > 0 &&
      !trimmedLine.startsWith("type ") &&
      !trimmedLine.startsWith("//")
    ) {
      return false;
    }
  }
  return true;
}

function interpretWithVars(
  input: string,
  variables: Map<string, number> = new Map(),
  variableTypes: Map<string, string> = new Map(),
  typeAliases: Map<string, string> = new Map(),
  functions: Map<
    string,
    { body: string; returnType: string; params: string[] }
  > = new Map(),
  stringVariables: Map<string, string> = new Map(),
): Result<number, InterpretError> {
  if (input === "") {
    return ok(0);
  }

  // First, extract type aliases if present
  let extractedAliases = typeAliases;
  if (input.includes("type ")) {
    const aliasesResult = extractTypeAliases(input);
    if (aliasesResult.isFailure()) {
      return aliasesResult;
    }
    extractedAliases = aliasesResult.value;
  }

  if (input.includes("let ") || input.includes("fn ")) {
    return handleMultilineInput(
      input,
      extractedAliases,
      variables,
      variableTypes,
      stringVariables,
    );
  }

  if (input.includes("struct ")) {
    const validationResult = validateStructDefinitions(input, extractedAliases);
    if (validationResult.isFailure()) {
      return validationResult;
    }
    return ok(0);
  }

  if (input.includes("type ") && containsOnlyTypeDeclarations(input)) {
    return ok(0);
  }

  const earlyResult = interpretEarlyReturns(
    input,
    variables,
    variableTypes,
    typeAliases,
    functions,
    stringVariables,
    extractedAliases,
  );
  if (earlyResult !== undefined) {
    return earlyResult;
  }

  // Check for addition operator
  const plusIndex = input.indexOf(" + ");
  if (plusIndex !== -1) {
    const leftStr = input.slice(0, plusIndex);
    const rightStr = input.slice(plusIndex + 3);
    return handleAddition(input, leftStr, rightStr, {
      variables,
      variableTypes,
      typeAliases: extractedAliases,
      functions,
      stringVariables,
    });
  }

  return interpretNumericLiteral(input, variables);
}

export function interpret(input: string): Result<number, InterpretError> {
  return interpretWithVars(
    input,
    new Map(),
    new Map(),
    new Map(),
    new Map(),
    new Map(),
  );
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
