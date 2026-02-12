import { Result, ok, err, type DescriptiveError } from "./result";

export type InterpretError = DescriptiveError;

type FunctionParam = { name: string; type: string };

type FunctionDefinition = {
  body: string;
  returnType: string;
  params: FunctionParam[];
  isExtern?: boolean;
};

type FunctionContext = {
  variables: Map<string, TuffValue>;
  functions: Map<string, FunctionDefinition>;
};

type TuffValue = number | FunctionContext;

type VariableMap = Map<string, TuffValue>;
type TypeMap = Map<string, string>;
type FunctionMap = Map<string, FunctionDefinition>;
type AliasMap = Map<string, string>;

type InterpreterContext = {
  variables?: VariableMap;
  variableTypes?: TypeMap;
  typeAliases?: AliasMap;
  functions?: FunctionMap;
  stringVariables?: TypeMap;
  structNames?: Set<string>;
};

function createDefaultContext(): InterpreterContext {
  return {
    variables: new Map(),
    variableTypes: new Map(),
    typeAliases: new Map(),
    functions: new Map(),
    stringVariables: new Map(),
    structNames: new Set(),
  };
}

function getContextMaps(ctx: InterpreterContext) {
  return {
    variables: (ctx.variables as Map<string, TuffValue>) || new Map(),
    variableTypes: ctx.variableTypes || new Map(),
    typeAliases: ctx.typeAliases || new Map(),
    functions: ctx.functions || new Map(),
    stringVariables: ctx.stringVariables || new Map(),
    structNames: ctx.structNames || new Set(),
    contextVariables:
      (ctx.variables as Map<string, FunctionContext>) || new Map(),
  };
}

type BuiltinFunction = (params: Map<string, TuffValue>) => TuffValue;

const builtinFunctions: Map<string, BuiltinFunction> = new Map<
  string,
  BuiltinFunction
>([
  [
    "createSlice",
    (() => {
      return {
        variables: new Map([["__array_count", 0]]),
        functions: new Map(),
      } as TuffValue;
    }) as BuiltinFunction,
  ],
  [
    "addSlice",
    ((params: Map<string, TuffValue>) => {
      const thisValue = params.get("this") as FunctionContext | undefined;
      const element = params.get("element") as number | undefined;

      if (
        !thisValue ||
        typeof thisValue !== "object" ||
        !("variables" in thisValue)
      ) {
        return 0 as TuffValue;
      }

      const count = (thisValue.variables.get("__array_count") as number) || 0;
      const newVars = new Map(thisValue.variables);
      newVars.set("__array_" + count, element || 0);
      newVars.set("__array_count", count + 1);

      return {
        variables: newVars,
        functions: thisValue.functions,
      } as TuffValue;
    }) as BuiltinFunction,
  ],
  [
    "getSlice",
    ((params: Map<string, TuffValue>) => {
      const thisValue = params.get("this") as FunctionContext | undefined;
      const index = params.get("index") as number | undefined;

      if (
        !thisValue ||
        typeof thisValue !== "object" ||
        !("variables" in thisValue)
      ) {
        return 0 as TuffValue;
      }

      const value = thisValue.variables.get("__array_" + (index || 0));
      return ((value as number) || 0) as TuffValue;
    }) as BuiltinFunction,
  ],
]);

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

function extractBaseName(nameWithGenerics: string): string {
  const angleIndex = nameWithGenerics.indexOf("<");
  if (angleIndex !== -1) {
    return nameWithGenerics.slice(0, angleIndex).trim();
  }
  return nameWithGenerics;
}

function extractGenericParameters(nameWithGenerics: string): Set<string> {
  const angleIndex = nameWithGenerics.indexOf("<");
  if (angleIndex === -1) return new Set();

  const closeAngleIndex = nameWithGenerics.lastIndexOf(">");
  if (closeAngleIndex <= angleIndex) return new Set();

  const genericsStr = nameWithGenerics
    .slice(angleIndex + 1, closeAngleIndex)
    .trim();
  return new Set(
    genericsStr
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0),
  );
}

function extractReturnType(
  headerPart: string,
  colonIndex: number,
  closeParenIndex: number,
  funcName: string,
  input: string,
  structNames: Set<string>,
  genericParams: Set<string> = new Set(),
): Result<string, InterpretError> {
  let returnType = "I32";
  if (
    colonIndex !== -1 &&
    closeParenIndex !== -1 &&
    colonIndex > closeParenIndex
  ) {
    returnType = headerPart.slice(colonIndex + 1).trim();

    const tempFunctions = new Map<string, FunctionDefinition>();
    tempFunctions.set(funcName, { body: "", returnType: "", params: [] });

    if (
      !isValidFieldType(
        returnType,
        genericParams,
        new Map(),
        structNames,
        tempFunctions,
      )
    ) {
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
  return ok(returnType);
}

function processFunctionDefinitionLine(
  trimmedLine: string,
  input: string,
  existingFunctions: Set<string>,
  structNames: Set<string> = new Set(),
): Result<
  { name: string; body: string; returnType: string; params: FunctionParam[] },
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

  const funcNameWithGenerics = headerPart.slice(0, parenIndex).trim();
  const genericParams = extractGenericParameters(funcNameWithGenerics);
  const funcName = extractBaseName(funcNameWithGenerics);

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

  const paramsResult = extractFunctionParameters(
    headerPart,
    parenIndex,
    closeParenIndex,
    funcName,
    input,
    structNames,
    genericParams,
  );
  if (paramsResult.isFailure()) {
    return paramsResult;
  }
  const params = paramsResult.value;

  const returnTypeResult = extractReturnType(
    headerPart,
    colonIndex,
    closeParenIndex,
    funcName,
    input,
    structNames,
    genericParams,
  );
  if (returnTypeResult.isFailure()) {
    return returnTypeResult;
  }
  const returnType = returnTypeResult.value;

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
  structNames: Set<string> = new Set(),
  genericParams: Set<string> = new Set(),
): Result<FunctionParam[], InterpretError> {
  const params: FunctionParam[] = [];
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

          let paramType = "I32";
          if (colonIdx !== -1) {
            paramType = trimmedPart.slice(colonIdx + 1).trim();
            if (
              !isValidFieldType(
                paramType,
                genericParams,
                new Map(),
                structNames,
              )
            ) {
              return err({
                source: input,
                description: "Unknown parameter type",
                reason: `unknown parameter type '${paramType}' in function '${funcName}'`,
                fix: "Use a valid type like I32, U8, U16, U32, U64, I8, I16, I64, or *Str",
              });
            }
          }
          params.push({ name: paramName, type: paramType });
        }
      }
    }
  }
  return ok(params);
}

function getLines(input: string): string[] {
  return input.split("\n");
}

function extractExternFunction(
  cleanLine: string,
  functionalNameTracker: Set<string>,
  functions: Map<string, FunctionDefinition>,
): boolean {
  if (!cleanLine.startsWith("extern fn ")) {
    return false;
  }

  const externFnText = cleanLine.slice(10); // Remove "extern fn "
  const parenIndex = externFnText.indexOf("(");
  if (parenIndex === -1) return false;

  const funcNameWithGenerics = externFnText.slice(0, parenIndex).trim();
  const funcName = extractBaseName(funcNameWithGenerics);

  if (!isValidVariableName(funcName) || functionalNameTracker.has(funcName)) {
    return false;
  }

  // Extract parameters
  const closeParenIndex = externFnText.indexOf(")");
  const headerPart = externFnText.slice(0, closeParenIndex + 1);
  const paramsText = headerPart.slice(parenIndex + 1, closeParenIndex).trim();
  const params: FunctionParam[] = [];

  if (paramsText.length > 0) {
    const paramParts = paramsText.split(",");
    for (const part of paramParts) {
      const colonPos = part.indexOf(":");
      if (colonPos !== -1) {
        const paramName = part.slice(0, colonPos).trim();
        const paramType = part.slice(colonPos + 1).trim();
        params.push({ name: paramName, type: paramType });
      }
    }
  }

  // Find the return type (after the closing paren)
  let returnType = "undefined";
  const afterParen = externFnText.slice(closeParenIndex + 1);
  const semiIndex = afterParen.indexOf(";");
  const colonIndex = afterParen.indexOf(":");
  const arrowIndex = afterParen.indexOf("=>");
  let typeStartIdx = -1;

  if (colonIndex !== -1) {
    typeStartIdx = colonIndex + 1;
  } else if (arrowIndex !== -1) {
    typeStartIdx = arrowIndex + 2;
  }

  if (typeStartIdx !== -1) {
    const endIdx = semiIndex !== -1 ? semiIndex : afterParen.length;
    returnType = afterParen.slice(typeStartIdx, endIdx).trim();
  }

  functionalNameTracker.add(funcName);
  functions.set(funcName, {
    body: "0", // Extern functions have no Tuff implementation, default to 0
    returnType: returnType,
    params: params,
    isExtern: true,
  });
  return true;
}

function extractFunctionDefinitions(
  input: string,
  includeIndented: boolean = false,
  structNames: Set<string> = new Set(),
): Result<Map<string, FunctionDefinition>, InterpretError> {
  const linesArray = getLines(input);
  const functions = new Map<
    string,
    { body: string; returnType: string; params: FunctionParam[] }
  >();
  const functionalNameTracker = new Set<string>();

  for (let idx = 0; idx < linesArray.length; idx++) {
    const rawLine = linesArray[idx];
    const cleanLine = rawLine.trim();

    if (
      !includeIndented &&
      rawLine.length > 0 &&
      rawLine[0] === " " &&
      cleanLine.startsWith("fn ")
    ) {
      continue;
    }

    // Handle extern function declarations
    if (extractExternFunction(cleanLine, functionalNameTracker, functions)) {
      continue;
    }

    if (cleanLine.startsWith("fn ")) {
      // Check if this is a multi-line function
      let functionText = cleanLine;
      if (cleanLine.includes("=> {") && !cleanLine.includes("}")) {
        // Multi-line function, collect lines until closing brace
        let braceDepth = 1;
        for (let j = idx + 1; j < linesArray.length; j++) {
          const nextLine = linesArray[j];
          functionText += "\n" + nextLine;
          if (nextLine.includes("{")) braceDepth++;
          if (nextLine.includes("}")) braceDepth--;
          if (braceDepth === 0) {
            idx = j; // Skip these lines in the next outer loop iteration
            break;
          }
        }
      }

      const result = processFunctionDefinitionLine(
        functionText,
        input,
        functionalNameTracker,
        structNames,
      );
      if (result.isFailure()) {
        return result;
      }
      const funcDef = result.value;
      functionalNameTracker.add(funcDef.name);
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
  // Extract base name and parameters from the input type
  const baseNameInput = extractBaseName(typeStr);
  const paramsInput = extractGenericParameters(typeStr);

  // Check if the base name is in the alias map
  if (typeAliases.has(baseNameInput)) {
    let aliasValue = typeAliases.get(baseNameInput)!;

    // If the input had generic parameters, substitute them into the alias value
    if (paramsInput.size > 0) {
      const paramsAlias = extractGenericParameters(aliasValue);
      const paramsArray = Array.from(paramsInput);
      const paramsAliasArray = Array.from(paramsAlias);

      // Create a substitution map: T -> I32, X -> I32, etc.
      const substitutions = new Map<string, string>();
      for (
        let i = 0;
        i < paramsAliasArray.length && i < paramsArray.length;
        i++
      ) {
        substitutions.set(paramsAliasArray[i], paramsArray[i]);
      }

      // Substitute all occurrences in the alias value
      for (const [from, to] of substitutions) {
        // Replace all occurrences of the type variable
        let newValue = "";
        let pos = 0;
        let index = aliasValue.indexOf(from, pos);
        while (index !== -1) {
          newValue += aliasValue.slice(pos, index) + to;
          pos = index + from.length;
          index = aliasValue.indexOf(from, pos);
        }
        newValue += aliasValue.slice(pos);
        aliasValue = newValue;
      }
    }

    return aliasValue;
  }

  return typeStr;
}

function isValidFieldType(
  typeStr: string,
  genericParams?: Set<string>,
  typeAliases?: Map<string, string>,
  structNames?: Set<string>,
  functions?: Map<string, FunctionDefinition>,
): boolean {
  const trimmed = typeStr.trim();

  // Check for mutable array type: *mut [TypeName]
  if (trimmed.startsWith("*mut [") && trimmed.endsWith("]")) {
    const innerType = trimmed.slice(6, -1).trim();
    // Recursively validate the inner type
    return isValidFieldType(
      innerType,
      genericParams,
      typeAliases,
      structNames,
      functions,
    );
  }

  // Check for array type: *[TypeName]
  if (trimmed.startsWith("*[") && trimmed.endsWith("]")) {
    const innerType = trimmed.slice(2, -1).trim();
    // Recursively validate the inner type
    return isValidFieldType(
      innerType,
      genericParams,
      typeAliases,
      structNames,
      functions,
    );
  }

  // Extract base name if the type has generic parameters (e.g., Result<T, X> => Result)
  let baseName = trimmed;
  let angleIndex = trimmed.indexOf("<");
  if (angleIndex !== -1) {
    baseName = trimmed.slice(0, angleIndex).trim();
  }

  const resolved = typeAliases
    ? resolveTypeAlias(baseName, typeAliases)
    : baseName;

  // Also extract base name from the resolved result (e.g., Ok<T, X> => Ok)
  let resolvedBaseName = resolved;
  angleIndex = resolved.indexOf("<");
  if (angleIndex !== -1) {
    resolvedBaseName = resolved.slice(0, angleIndex).trim();
  }

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
  if (validTypes.includes(resolvedBaseName)) return true;
  // Check if it's a generic type parameter
  if (genericParams && genericParams.has(resolvedBaseName)) return true;
  // Check if it's a struct name
  if (structNames && structNames.has(resolvedBaseName)) return true;
  // Check if it's a function name (allowed as a type for Fluent API contexts)
  if (functions && functions.has(resolvedBaseName)) return true;
  return false;
}

function extractStructNames(input: string): Set<string> {
  const lines = getLines(input);
  const structNames = new Set<string>();

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("struct ")) {
      const openBraceIndex = trimmedLine.indexOf("{");
      if (openBraceIndex !== -1) {
        const structNamePart = trimmedLine.slice(7, openBraceIndex).trim();
        const angleIndex = structNamePart.indexOf("<");
        const structName =
          angleIndex !== -1
            ? structNamePart.slice(0, angleIndex).trim()
            : structNamePart;
        structNames.add(structName);
      }
    }
  }

  return structNames;
}

function validateStructDefinitions(
  input: string,
  typeAliases: Map<string, string> = new Map(),
): Result<undefined, InterpretError> {
  const lines = getLines(input);
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

        // If it's a single line struct definition like "struct Ok {}", don't set currentStructName
        if (trimmedLine.endsWith("}")) {
          currentStructName = undefined;
        } else {
          currentStructName = structName;
          structFields.set(structName, new Set<string>());
        }
      }
    } else if (
      currentStructName &&
      trimmedLine.includes(":") &&
      !trimmedLine.includes("fn ") &&
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

        if (
          !isValidFieldType(
            typeStr,
            currentGenericParams,
            typeAliases,
            structNames,
          )
        ) {
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

function validateContractDefinitions(
  input: string,
): Result<undefined, InterpretError> {
  const contractNames = new Set<string>();
  const lines = getLines(input);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("contract ")) {
      const openBraceIndex = trimmedLine.indexOf("{");
      if (openBraceIndex !== -1) {
        const contractName = trimmedLine.slice(9, openBraceIndex).trim();
        if (contractNames.has(contractName)) {
          return err({
            source: input,
            description: "Duplicate contract declaration",
            reason: `duplicate contract definition: '${contractName}' is declared multiple times`,
            fix: "Remove the duplicate contract declaration or use a different name",
          });
        }
        contractNames.add(contractName);
      }
    }
  }

  return ok(undefined);
}

function handleAddition(
  input: string,
  leftStr: string,
  rightStr: string,
  ctx: InterpreterContext = createDefaultContext(),
): Result<TuffValue, InterpretError> {
  const {
    variables,
    variableTypes,
    typeAliases,
    functions,
    stringVariables,
    structNames,
  } = getContextMaps(ctx);
  // Recursively interpret the left side (can be variable or expression)
  const leftResult = interpretWithVars(
    leftStr,
    variables,
    variableTypes,
    typeAliases,
    functions,
    stringVariables,
    structNames,
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
    structNames,
  );
  if (rightResult.isFailure()) {
    return rightResult;
  }
  const rightValue = rightResult.value;

  if (typeof leftValue !== "number" || typeof rightValue !== "number") {
    return err({
      source: input,
      description: "Type mismatch in addition",
      reason: "Addition is only supported for numeric values",
      fix: "Ensure both operands are numbers",
    });
  }

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

  // Check if it's a function call: extract the function name (with generics) as the type
  const openParenIndex = valueStr.indexOf("(");
  if (openParenIndex !== -1 && valueStr.endsWith(")")) {
    const funcNameWithGenerics = valueStr.slice(0, openParenIndex).trim();
    const funcBaseName = extractBaseName(funcNameWithGenerics);
    if (isValidVariableName(funcBaseName)) {
      // Return the full name with generics (e.g., "Ok<I32, I32>" instead of just "Ok")
      return funcNameWithGenerics;
    }
  }

  return undefined;
}
function interpretNumericLiteral(
  input: string,
  variables: VariableMap = new Map(),
): Result<TuffValue, InterpretError> {
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
  variables: Map<string, TuffValue>,
  variableTypes: Map<string, string>,
  typeAliases: Map<string, string>,
  functions: Map<
    string,
    { body: string; returnType: string; params: FunctionParam[] }
  >,
  stringVariables: Map<string, string>,
  extractedAliases: Map<string, string>,
  structNames: Set<string> = new Set(),
): Result<TuffValue, InterpretError> | undefined {
  const functionCallResult = tryFunctionCall(
    input,
    functions,
    variables,
    variableTypes,
    extractedAliases,
    structNames,
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
    extractedAliases,
    structNames,
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
      structNames,
    );
  }

  const isKeywordIndex = input.indexOf(" is ");
  if (isKeywordIndex !== -1) {
    return evaluateIsTypeCheck(input, variableTypes);
  }

  return undefined;
}

function interpretPropertyAccess(
  input: string,
  variableTypes: Map<string, string>,
  stringVariables: Map<string, string>,
  variables: Map<string, TuffValue> = new Map(),
  typeAliases: Map<string, string> = new Map(),
  structNames: Set<string> = new Set(),
): Result<TuffValue, InterpretError> | undefined {
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

  // Handle context variables (Fluent API)
  if (variables.has(varName)) {
    const val = variables.get(varName);
    if (
      val !== undefined &&
      typeof val === "object" &&
      "variables" in val &&
      "functions" in val
    ) {
      const context = val as FunctionContext;
      return interpretWithVars(
        propertyName,
        context.variables,
        new Map(),
        typeAliases,
        context.functions,
        new Map(),
        structNames,
      );
    }
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

function detectCompoundAssignment(
  line: string,
): { varName: string; operator: string; value: string } | undefined {
  const trimmedLine = line.trim();
  const operators = ["+=", "-=", "*=", "/=", "&=", "|=", "^="];

  for (const op of operators) {
    const opIndex = trimmedLine.indexOf(op);
    if (opIndex !== -1) {
      const varName = trimmedLine.slice(0, opIndex).trim();
      const operator = op[0]; // +, -, *, /, etc.
      let valueStr = trimmedLine.slice(opIndex + 2).trim();
      if (valueStr.endsWith(";")) valueStr = valueStr.slice(0, -1);

      // Basic validation that varName is an identifier
      if (isValidVariableName(varName)) {
        return { varName, operator, value: valueStr };
      }
    }
  }
  return undefined;
}

function parseVariableAssignment(
  line: string,
): Result<{ name: string; value: string }, string> {
  const trimmedLine = line.trim();

  // Handle compound assignment operators (+=, -=, *=, /=, etc.)
  const compoundAssign = detectCompoundAssignment(line);
  if (compoundAssign) {
    const { varName, operator, value } = compoundAssign;
    // Expand compound assignment: x += 1 becomes x = x + 1
    return ok({
      name: varName,
      value: `${varName} ${operator} ${value}`,
    });
  }

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
  varMap: VariableMap,
  typeMap: TypeMap,
  declaredInThisScope: Set<string>,
  typeAliases: AliasMap,
  mutableVars?: Set<string>,
  functions: FunctionMap = new Map(),
  structNames: Set<string> = new Set(),
): Result<{ varMap: VariableMap; typeMap: TypeMap }, InterpretError> {
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
    functions,
    new Map(),
    structNames,
  );
  if (valueInterpretResult.isFailure()) return valueInterpretResult;
  const value = valueInterpretResult.value;

  if (
    typeAnnotation &&
    !isValidFieldType(
      typeAnnotation,
      undefined,
      typeAliases,
      structNames,
      functions,
    )
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

function createImmutableVariableError(
  input: string,
  varName: string,
): InterpretError {
  return {
    source: input,
    description: "Cannot reassign immutable variable",
    reason: `Variable '${varName}' is not declared as mutable`,
    fix: "Declare the variable with 'let mut varName = value;'",
  };
}

function processSingleVariableReassignment(
  input: string,
  line: string,
  varMap: VariableMap,
  typeMap: TypeMap,
  mutableVars: Set<string>,
  typeAliases: AliasMap,
  functions: FunctionMap = new Map(),
): Result<VariableMap, InterpretError> {
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
    return err(createImmutableVariableError(input, varName));
  }

  const valueResult = interpretWithVars(
    valueStr,
    varMap,
    typeMap,
    typeAliases,
    functions,
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

function getNestedFunctions(body: string): FunctionMap {
  const nestedResult = extractFunctionDefinitions(body, true);
  return nestedResult.isSuccess() ? nestedResult.value : new Map();
}

function processVariableDeclarations(
  input: string,
  variables: Map<string, TuffValue>,
  variableTypes: Map<string, string> = new Map(),
  typeAliases: Map<string, string> = new Map(),
  stringVariables: Map<string, string> = new Map(),
  functions: Map<string, FunctionDefinition> = new Map(),
  structNames: Set<string> = new Set(),
): Result<
  {
    varMap: Map<string, TuffValue>;
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
    // Skip indented lines (they're inside function bodies)
    if (line.length > 0 && line[0] === " ") {
      continue;
    }

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
        functions,
        structNames,
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
        functions,
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
): Result<TuffValue, InterpretError> | undefined {
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

function parseAndValidateArguments(
  argString: string,
  funcDef: { params: FunctionParam[] },
  ctx: InterpreterContext,
  funcName: string,
  input: string,
): Result<{ paramVars: VariableMap; paramTypes: TypeMap }, InterpretError> {
  const args: TuffValue[] = [];
  const argTypes: string[] = [];
  const { variables, variableTypes, typeAliases, functions } =
    getContextMaps(ctx);

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
      const argType =
        determineAssignedValueType(trimmedArg, variableTypes) || "I32";
      argTypes.push(argType);
    }
  }

  const paramVars = new Map(variables);
  const paramTypes = new Map(variableTypes);
  for (let i = 0; i < funcDef.params.length; i++) {
    if (i < args.length) {
      const param = funcDef.params[i];
      const argType = argTypes[i];
      // Allow generic type parameters (like T) to accept any argument
      const isGenericParam =
        param.type.length === 1 && param.type >= "A" && param.type <= "Z";

      // Allow numeric literals (I32) to be passed to unsigned types (USize, U8, U16, etc.)
      const isNumericLiteralToUnsigned =
        argType === "I32" &&
        (param.type.startsWith("U") || param.type === "USize");

      // Allow mutable array type (*mut [T]) to be passed to immutable parameter (*[T])
      const isMutableToImmutable =
        argType.startsWith("*mut [") &&
        param.type.startsWith("*[") &&
        argType.slice(6) === param.type.slice(2);

      if (
        !isGenericParam &&
        !isNumericLiteralToUnsigned &&
        !isMutableToImmutable &&
        param.type !== argType &&
        param.type !== "I32"
      ) {
        return err({
          source: input,
          description: "Type mismatch in function call",
          reason: `type mismatch: Cannot pass argument of type '${argType}' to parameter '${param.name}' of type '${param.type}' in function '${funcName}'`,
          fix: `Use a value of type '${param.type}'`,
        });
      }
      paramVars.set(param.name, args[i]);
      paramTypes.set(param.name, param.type);
    }
  }

  return ok({ paramVars, paramTypes });
}

function extractMethodCallInfo(
  funcNameWithGenerics: string,
  ctx: InterpreterContext,
): { methodValue?: string; funcName: string } {
  const { variables, variableTypes, typeAliases, functions, structNames } =
    getContextMaps(ctx);

  // Check if this is a method call: value.functionName()
  const lastDotIndex = funcNameWithGenerics.lastIndexOf(".");
  if (lastDotIndex !== -1) {
    const potentialValue = funcNameWithGenerics.slice(0, lastDotIndex);
    const potentialFuncName = funcNameWithGenerics.slice(lastDotIndex + 1);

    // First, check if this matches a variable.functionName pattern where functionName takes 'this'
    if (isValidVariableName(potentialValue) && variables.has(potentialValue)) {
      const baseFuncName = extractBaseName(potentialFuncName);
      if (functions.has(baseFuncName)) {
        const funcDef = functions.get(baseFuncName)!;
        if (funcDef.params.length > 0 && funcDef.params[0].name === "this") {
          return { methodValue: potentialValue, funcName: potentialFuncName };
        }
      }
    }

    // If the part before the dot is not a valid variable name, it's a method call
    if (!isValidVariableName(potentialValue)) {
      // Validate that the value can be evaluated
      const valueResult = interpretWithVars(
        potentialValue,
        variables,
        variableTypes,
        typeAliases,
        functions,
        new Map(),
        structNames,
      );
      if (valueResult.isSuccess()) {
        return { methodValue: potentialValue, funcName: potentialFuncName };
      }
    }
  }

  return { funcName: funcNameWithGenerics };
}

function interpretDottedReturnValue(
  returnValue: TuffValue,
  returnType: string,
  dotRest: string,
  paramVars: Map<string, TuffValue>,
  paramTypes: Map<string, string>,
  typeAliases: Map<string, string>,
  functions: Map<string, FunctionDefinition>,
  structNames: Set<string>,
): Result<TuffValue, InterpretError> {
  const tempVars = new Map(paramVars);
  const tempTypes = new Map(paramTypes);
  tempVars.set("__ret", returnValue);
  tempTypes.set("__ret", returnType);

  return interpretWithVars(
    `__ret.${dotRest}`,
    tempVars,
    tempTypes,
    typeAliases,
    functions,
    new Map(),
    structNames,
  );
}

function checkIfFunctionReturnsThis(funcBody: string): boolean {
  if (funcBody === "this") return true;
  if (funcBody.startsWith("{") && funcBody.endsWith("}")) {
    const innerBody = funcBody.slice(1, -1).trim();
    const bodyLines = getLines(innerBody);
    if (bodyLines.length > 0) {
      return bodyLines[bodyLines.length - 1].trim() === "this";
    }
  }
  return false;
}

function handleFunctionCallWithDotAccess(
  rest: string,
  funcDef: { body: string; returnType: string },
  paramVars: Map<string, TuffValue>,
  paramTypes: Map<string, string>,
  typeAliases: Map<string, string>,
  structNames: Set<string>,
  functions: Map<string, FunctionDefinition> = new Map(),
): Result<TuffValue, InterpretError> | undefined {
  if (!rest.startsWith(".")) return undefined;

  let dotRest = rest.slice(1).trim();
  if (dotRest.endsWith(";")) {
    dotRest = dotRest.slice(0, -1).trim();
  }

  const returnsThis = checkIfFunctionReturnsThis(funcDef.body);
  if (returnsThis) {
    return interpretWithVars(
      dotRest,
      paramVars,
      paramTypes,
      typeAliases,
      getNestedFunctions(funcDef.body),
      new Map(),
      structNames,
    );
  }

  // For functions that don't return "this", interpret the body to get return value
  // Store it in a temp variable with the function's return type
  const returnValueResult = interpretWithVars(
    funcDef.body,
    paramVars,
    paramTypes,
    typeAliases,
    functions,
    new Map(),
    structNames,
  );

  if (returnValueResult.isFailure()) {
    return returnValueResult;
  }

  const returnValue = returnValueResult.value;

  return interpretDottedReturnValue(
    returnValue,
    funcDef.returnType,
    dotRest,
    paramVars,
    paramTypes,
    typeAliases,
    functions,
    structNames,
  );
}

function handleBuiltinOrRegularCall(
  funcDef: {
    body: string;
    returnType: string;
    params: FunctionParam[];
    isExtern?: boolean;
  },
  effectiveFuncName: string,
  paramVars: Map<string, TuffValue>,
  paramTypes: Map<string, string>,
  rest: string,
  typeAliases: Map<string, string>,
  functions: Map<string, FunctionDefinition>,
  structNames: Set<string>,
): Result<TuffValue, InterpretError> | undefined {
  // For builtin extern functions, get the actual return value first
  let returnValue: TuffValue | undefined = undefined;
  if (funcDef.isExtern && builtinFunctions.has(effectiveFuncName)) {
    const builtin = builtinFunctions.get(effectiveFuncName)!;
    returnValue = builtin(paramVars);
  }

  // Handle dot access with proper return value
  if (rest.startsWith(".")) {
    if (returnValue !== undefined) {
      // For builtin functions, we already have the return value
      const dotRest = rest.slice(1).trim();
      return interpretDottedReturnValue(
        returnValue,
        funcDef.returnType,
        dotRest,
        paramVars,
        paramTypes,
        typeAliases,
        functions,
        structNames,
      );
    } else {
      // For regular functions, use the original handler
      const dotResult = handleFunctionCallWithDotAccess(
        rest,
        funcDef,
        paramVars,
        paramTypes,
        typeAliases,
        structNames,
        functions,
      );
      if (dotResult) return dotResult;
    }
  }

  if (rest.length > 0 && rest !== ";") return undefined;

  const returnsThis = checkIfFunctionReturnsThis(funcDef.body);
  if (returnsThis) {
    return ok({
      variables: paramVars,
      functions: getNestedFunctions(funcDef.body),
    });
  }

  // Return the builtin result if we have one
  if (returnValue !== undefined) {
    return ok(returnValue);
  }

  return interpretWithVars(
    funcDef.body,
    paramVars,
    paramTypes,
    typeAliases,
    functions,
    new Map(),
    structNames,
  );
}

function tryFunctionCall(
  input: string,
  functions: Map<
    string,
    {
      body: string;
      returnType: string;
      params: FunctionParam[];
      isExtern?: boolean;
    }
  >,
  variables: Map<string, TuffValue>,
  variableTypes: Map<string, string>,
  typeAliases: Map<string, string>,
  structNames: Set<string> = new Set(),
): Result<TuffValue, InterpretError> | undefined {
  const openParenIndex = input.indexOf("(");
  if (openParenIndex === -1) return undefined;

  const closeParenIndex = findMatchingParen(input, openParenIndex);
  if (closeParenIndex === -1 || closeParenIndex <= openParenIndex)
    return undefined;

  const nameBeforeParen = input.slice(0, openParenIndex).trim();
  const ctx = { variables, variableTypes, typeAliases, functions, structNames };
  const { methodValue, funcName: rawFuncName } = extractMethodCallInfo(
    nameBeforeParen,
    ctx,
  );

  const funcName = extractBaseName(rawFuncName);
  const effectiveFuncName = funcName.startsWith("this.")
    ? funcName.slice(5)
    : funcName;

  if (!functions.has(effectiveFuncName)) return undefined;

  const funcDef = functions.get(effectiveFuncName)!;
  let argString = input.slice(openParenIndex + 1, closeParenIndex).trim();

  if (
    methodValue !== undefined &&
    funcDef.params.length > 0 &&
    funcDef.params[0].name === "this"
  ) {
    argString =
      argString.length > 0 ? methodValue + ", " + argString : methodValue;
  }

  const argResult = parseAndValidateArguments(
    argString,
    funcDef,
    ctx,
    effectiveFuncName,
    input,
  );

  if (argResult.isFailure()) return argResult;

  const { paramVars, paramTypes } = argResult.value;
  const rest = input.slice(closeParenIndex + 1).trim();

  return handleBuiltinOrRegularCall(
    funcDef,
    effectiveFuncName,
    paramVars,
    paramTypes,
    rest,
    typeAliases,
    functions,
    structNames,
  );
}

function findMatchingParen(input: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < input.length; i++) {
    if (input[i] === "(") depth++;
    else if (input[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function validateFunctionBodies(
  extractedFunctions: Map<string, FunctionDefinition>,
  finalVars: VariableMap,
  mutableVars: Set<string>,
  input: string,
): Result<undefined, InterpretError> {
  for (const [, funcDef] of extractedFunctions) {
    const compoundAssign = detectCompoundAssignment(funcDef.body);
    if (
      compoundAssign &&
      finalVars.has(compoundAssign.varName) &&
      !mutableVars.has(compoundAssign.varName)
    ) {
      return err(createImmutableVariableError(input, compoundAssign.varName));
    }
  }
  return ok(undefined);
}

function handleMultilineInput(
  input: string,
  extractedAliases: Map<string, string>,
  variables: Map<string, TuffValue>,
  variableTypes: Map<string, string>,
  stringVariables: Map<string, string> = new Map(),
  structNames?: Set<string>,
): Result<TuffValue, InterpretError> {
  // Extract struct names
  const localStructNames = new Set(structNames);
  if (input.includes("struct ")) {
    const names = extractStructNames(input);
    for (const name of names) {
      localStructNames.add(name);
    }

    // Validate struct definitions
    const validationResult = validateStructDefinitions(input, extractedAliases);
    if (validationResult.isFailure()) {
      return validationResult;
    }
  }

  // Validate contract definitions
  if (input.includes("contract ")) {
    const validationResult = validateContractDefinitions(input);
    if (validationResult.isFailure()) {
      return validationResult;
    }
  }

  // Extract functions first
  let extractedFunctions = new Map<string, FunctionDefinition>();
  if (input.includes("fn ")) {
    const functionsResult = extractFunctionDefinitions(
      input,
      false,
      localStructNames,
    );
    if (functionsResult.isFailure()) {
      return functionsResult;
    }
    extractedFunctions = functionsResult.value;
  }

  // Update variables and types if there are let declarations
  let finalVars = variables;
  let finalTypes = variableTypes;
  let finalStringVars = stringVariables;
  let mutableVars = new Set<string>();
  if (input.includes("let ")) {
    const processResult = processVariableDeclarations(
      input,
      variables,
      variableTypes,
      extractedAliases,
      stringVariables,
      extractedFunctions,
      localStructNames,
    );
    if (processResult.isFailure()) {
      return processResult;
    }
    finalVars = processResult.value.varMap;
    finalTypes = processResult.value.typeMap;
    finalStringVars = processResult.value.stringVarMap;
    
    // Extract which variables are mutable
    const lines = input.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("let mut ")) {
        const afterMut = trimmed.slice(8).trim();
        const eqIndex = afterMut.indexOf("=");
        if (eqIndex !== -1) {
          const varName = afterMut.slice(0, eqIndex).trim();
          mutableVars.add(varName);
        }
      }
    }
  }

  // Validate that function bodies don't modify immutable variables
  const validateResult = validateFunctionBodies(
    extractedFunctions,
    finalVars,
    mutableVars,
    input,
  );
  if (validateResult.isFailure()) {
    return validateResult;
  }

  // Evaluate the last non-declaration, non-comment line
  const lines = input.split("\n");
  return evaluateLastLine(
    input,
    lines,
    finalVars,
    finalTypes,
    extractedAliases,
    extractedFunctions,
    finalStringVars,
    localStructNames,
  );
}

function evaluateLastLine(
  input: string,
  lines: string[],
  finalVars: VariableMap,
  finalTypes: TypeMap,
  extractedAliases: AliasMap,
  extractedFunctions: FunctionMap,
  finalStringVars: TypeMap,
  localStructNames: Set<string>,
): Result<TuffValue, InterpretError> {
  // Find the last non-empty, non-comment line
  let lastLine = "";
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmedLine = lines[i].trim();
    if (trimmedLine.length > 0 && !trimmedLine.startsWith("//")) {
      lastLine = trimmedLine;
      break;
    }
  }

  if (
    !lastLine.startsWith("let ") &&
    !lastLine.startsWith("type ") &&
    !lastLine.startsWith("fn ") &&
    !lastLine.startsWith("extern fn ") &&
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
      localStructNames,
    );
  }

  return ok(0);
}

function evaluateIsTypeCheck(
  input: string,
  variableTypes: Map<string, string> = new Map(),
): Result<TuffValue, InterpretError> {
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
    // Check if evaluateExpr is a variable name
    if (variableTypes.has(evaluateExpr)) {
      effectiveTypeSuffix = variableTypes.get(evaluateExpr) || "I32";
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
  }

  // Extract base names (without generics) from both types for comparison
  const effectiveBaseName = extractBaseName(effectiveTypeSuffix);
  const targetBaseName = extractBaseName(targetTypeSuffix);

  const typeMatches = effectiveBaseName === targetBaseName;
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
  variables: VariableMap = new Map(),
  variableTypes: TypeMap = new Map(),
  typeAliases: AliasMap = new Map(),
  functions: FunctionMap = new Map(),
  stringVariables: TypeMap = new Map(),
  structNames: Set<string> = new Set(),
): Result<TuffValue, InterpretError> {
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

  if (
    input.includes("let ") ||
    input.includes("fn ") ||
    input.includes("struct ") ||
    input.includes("contract ")
  ) {
    return handleMultilineInput(
      input,
      extractedAliases,
      variables,
      variableTypes,
      stringVariables,
      structNames,
    );
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
      structNames,
    });
  }

  return interpretNumericLiteral(input, variables);
}

function truncateErrorSource(error: InterpretError): InterpretError {
  if (error.source.length > 200) {
    // Truncate to stay under 200 characters total (including "...")
    const maxLength = 197; // Leave room for "..."
    return {
      ...error,
      source: error.source.slice(0, maxLength) + "...",
    };
  }
  return error;
}

export function interpret(input: string): Result<TuffValue, InterpretError> {
  const result = interpretWithVars(
    input,
    new Map(),
    new Map(),
    new Map(),
    new Map(),
    new Map(),
  );

  // Ensure error sources don't exceed 200 characters
  if (result.isFailure()) {
    return err(truncateErrorSource(result.error));
  }

  return result;
}

// Read and interpret the .tuff file
const tuffFilePath = import.meta.dir + "/index.tuff";
const tuffContent = await Bun.file(tuffFilePath).text();
const result = interpret(tuffContent.trim());

if (result.isSuccess()) {
  console.log(`Result: ${result.value}`);
} else {
  const rawSource = result.error.source;
  if (rawSource.length > 200) {
    console.error(`Error '${result.error.description}' provided too much source code, 
      length ${rawSource.length} characters. 
      To keep error messages informative, this must be corrected to be a smaller code snippet, ideally less than 200 characters.`);
  } else {
    console.error(`Source Code: 

${rawSource}

If the given code does not actually provide relevant context, then this is an issue and must be corrected.
`);
    console.error(`Error: ${result.error.description}`);
    console.error(`Reason: ${result.error.reason}`);
    console.error(`Fix: ${result.error.fix}`);
  }
}
