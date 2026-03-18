type TuffSuffix = "U8" | "U16" | "U32" | "U64" | "I8" | "I16" | "I32" | "I64";

interface NumericTypeInfo {
  kind: "numeric";
  suffix: TuffSuffix;
  signed: boolean;
  bits: 8 | 16 | 32 | 64;
  min: bigint;
  max: bigint;
}

interface PointerTypeInfo {
  kind: "pointer";
  suffix: string;
  target: NumericTypeInfo;
  mutable: boolean;
}

interface BoolTypeInfo {
  kind: "bool";
  suffix: "Bool";
}

type TuffTypeInfo = NumericTypeInfo | PointerTypeInfo | BoolTypeInfo;

interface OkResult<T> {
  ok: true;
  value: T;
}

interface ErrResult<E> {
  ok: false;
  error: E;
}

type Result<T, E> = OkResult<T> | ErrResult<E>;

interface TuffError {
  kind:
    | "UnsupportedInput"
    | "UnsupportedSuffix"
    | "OutOfBounds"
    | "DivisionByZero"
    | "UnsupportedOperator"
    | "UndefinedVariable"
    | "ImmutableVariable"
    | "InvalidPointer";
  sourceCode: string;
  message: string;
  reason: string;
  suggestedFix: string;
}

interface LiteralValueResult {
  value: bigint;
  type: NumericTypeInfo;
}

interface ExpressionParts {
  left: string;
  operator: string;
  right: string;
}

interface LetStatement {
  name: string;
  type: TuffTypeInfo | undefined;
  mutable: boolean;
  initializer: string;
}

interface AssignmentStatement {
  name: string;
  value: string;
}

interface DereferenceAssignmentStatement {
  pointerName: string;
  value: string;
}

interface NumericValue {
  kind: "numeric";
  value: bigint;
  type: NumericTypeInfo;
  mutable: boolean;
}

interface PointerValue {
  kind: "pointer";
  value: bigint;
  type: PointerTypeInfo;
  mutable: boolean;
  target: string;
}

interface BoolValue {
  kind: "bool";
  value: boolean;
  type: BoolTypeInfo;
  mutable: boolean;
}

type BoundValue = NumericValue | PointerValue | BoolValue;

interface UnaryPointerOperand {
  name: string;
  value: BoundValue;
}

const TUFF_TYPES = new Map<TuffSuffix, NumericTypeInfo>([
  [
    "U8",
    {
      kind: "numeric",
      suffix: "U8",
      signed: false,
      bits: 8,
      min: 0n,
      max: 255n,
    },
  ],
  [
    "U16",
    {
      kind: "numeric",
      suffix: "U16",
      signed: false,
      bits: 16,
      min: 0n,
      max: 65535n,
    },
  ],
  [
    "U32",
    {
      kind: "numeric",
      suffix: "U32",
      signed: false,
      bits: 32,
      min: 0n,
      max: 4294967295n,
    },
  ],
  [
    "U64",
    {
      kind: "numeric",
      suffix: "U64",
      signed: false,
      bits: 64,
      min: 0n,
      max: 18446744073709551615n,
    },
  ],
  [
    "I8",
    {
      kind: "numeric",
      suffix: "I8",
      signed: true,
      bits: 8,
      min: -128n,
      max: 127n,
    },
  ],
  [
    "I16",
    {
      kind: "numeric",
      suffix: "I16",
      signed: true,
      bits: 16,
      min: -32768n,
      max: 32767n,
    },
  ],
  [
    "I32",
    {
      kind: "numeric",
      suffix: "I32",
      signed: true,
      bits: 32,
      min: -2147483648n,
      max: 2147483647n,
    },
  ],
  [
    "I64",
    {
      kind: "numeric",
      suffix: "I64",
      signed: true,
      bits: 64,
      min: -9223372036854775808n,
      max: 9223372036854775807n,
    },
  ],
]);

const TUFF_SUFFIXES: TuffSuffix[] = [
  "U8",
  "U16",
  "U32",
  "U64",
  "I8",
  "I16",
  "I32",
  "I64",
];
const DEFAULT_NUMERIC_TYPE = TUFF_TYPES.get("I32") as NumericTypeInfo;
const BOOL_TYPE: BoolTypeInfo = { kind: "bool", suffix: "Bool" };

function ok<T>(value: T): OkResult<T> {
  return { ok: true, value };
}

function err<E>(error: E): ErrResult<E> {
  return { ok: false, error };
}

function unsupportedInput(input: string): ErrResult<TuffError> {
  return err({
    kind: "UnsupportedInput",
    sourceCode: input,
    message: `Unsupported Tuff input: ${input}`,
    reason: "The input is not a supported literal, binding, or expression.",
    suggestedFix:
      "Use a numeric literal, a let binding, or a supported arithmetic expression.",
  });
}

function unsupportedSuffix(
  input: string,
  suffix: string,
): ErrResult<TuffError> {
  return err({
    kind: "UnsupportedSuffix",
    sourceCode: input,
    message: `Unsupported Tuff suffix: ${suffix}`,
    reason: "The literal suffix is not one of the supported Tuff families.",
    suggestedFix: "Use one of U8, U16, U32, U64, I8, I16, I32, or I64.",
  });
}

function outOfBounds(input: string, suffix: TuffSuffix): ErrResult<TuffError> {
  return err({
    kind: "OutOfBounds",
    sourceCode: input,
    message: `Tuff value out of bounds for ${suffix}: ${input}`,
    reason:
      "The numeric value is outside the allowed range for the target type.",
    suggestedFix: "Choose a value within the type bounds or use a wider type.",
  });
}

function divisionByZero(input: string): ErrResult<TuffError> {
  return err({
    kind: "DivisionByZero",
    sourceCode: input,
    message: `Division by zero: ${input}`,
    reason: "Division requires a non-zero right-hand operand.",
    suggestedFix: "Change the divisor to a non-zero typed literal.",
  });
}

function undefinedVariable(input: string, name: string): ErrResult<TuffError> {
  return err({
    kind: "UndefinedVariable",
    sourceCode: input,
    message: `Undefined variable: ${name}`,
    reason: "The variable was referenced before it was defined.",
    suggestedFix: `Define ${name} with a let binding before using it.`,
  });
}

function immutableVariable(input: string, name: string): ErrResult<TuffError> {
  return err({
    kind: "ImmutableVariable",
    sourceCode: input,
    message: `Immutable variable: ${name}`,
    reason: "The variable was declared without mutability.",
    suggestedFix: `Declare ${name} with let mut before reassigning it.`,
  });
}

function invalidPointer(input: string, detail: string): ErrResult<TuffError> {
  return err({
    kind: "InvalidPointer",
    sourceCode: input,
    message: `Invalid pointer usage: ${detail}`,
    reason:
      "The pointer operation requires a matching pointer or numeric value.",
    suggestedFix: "Use & on a numeric variable or * on a pointer variable.",
  });
}

function isNumericValue(value: BoundValue): value is NumericValue {
  return value.kind === "numeric";
}

function isPointerValue(value: BoundValue): value is PointerValue {
  return value.kind === "pointer";
}

function isBoolValue(value: BoundValue): value is BoolValue {
  return value.kind === "bool";
}

function makeNumericValue(
  value: bigint,
  type: NumericTypeInfo,
  mutable: boolean,
): NumericValue {
  return {
    kind: "numeric",
    value,
    type,
    mutable,
  };
}

function makeBoolValue(value: boolean, mutable: boolean): BoolValue {
  return {
    kind: "bool",
    value,
    type: BOOL_TYPE,
    mutable,
  };
}

function bindValue(
  name: string,
  value: BoundValue,
  environment: Map<string, BoundValue>,
): OkResult<BoundValue> {
  environment.set(name, value);
  return ok(value);
}

function makePointerType(target: NumericTypeInfo): PointerTypeInfo {
  return {
    kind: "pointer",
    suffix: `*${target.suffix}`,
    target,
    mutable: false,
  };
}

function makePointerTypeMutable(target: NumericTypeInfo): PointerTypeInfo {
  return {
    kind: "pointer",
    suffix: `*mut ${target.suffix}`,
    target,
    mutable: true,
  };
}

function getSuffix(input: string): TuffSuffix | undefined {
  for (const suffix of TUFF_SUFFIXES) {
    if (input.endsWith(suffix)) {
      return suffix;
    }
  }

  return undefined;
}

function isSignedIntegerText(text: string): boolean {
  if (text.length === 0) {
    return false;
  }

  let startIndex = 0;

  if (text[0] === "-") {
    if (text.length === 1) {
      return false;
    }

    startIndex = 1;
  }

  for (let index = startIndex; index < text.length; index += 1) {
    const code = text.charCodeAt(index);

    if (code < 48 || code > 57) {
      return false;
    }
  }

  return true;
}

function parseLiteral(input: string): Result<LiteralValueResult, TuffError> {
  const suffix = getSuffix(input);

  if (!suffix) {
    if (!isSignedIntegerText(input)) {
      return unsupportedInput(input);
    }

    return ok({ value: BigInt(input), type: DEFAULT_NUMERIC_TYPE });
  }

  const numericText = input.slice(0, input.length - suffix.length);

  if (!isSignedIntegerText(numericText)) {
    return unsupportedInput(input);
  }

  const type = TUFF_TYPES.get(suffix)!;
  const value = BigInt(numericText);

  if (value < type.min || value > type.max) {
    return outOfBounds(input, suffix);
  }

  return ok({ value, type });
}

function isWhitespace(character: string): boolean {
  return (
    character === " " ||
    character === "\t" ||
    character === "\n" ||
    character === "\r"
  );
}

function skipWhitespace(text: string, startIndex: number): number {
  let index = startIndex;

  while (index < text.length && isWhitespace(text[index])) {
    index += 1;
  }

  return index;
}

function isIdentifierStart(character: string): boolean {
  const code = character.charCodeAt(0);

  return (
    code === 95 || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
  );
}

function isIdentifierPart(character: string): boolean {
  const code = character.charCodeAt(0);

  return isIdentifierStart(character) || (code >= 48 && code <= 57);
}

function isIdentifierText(text: string): boolean {
  if (text.length === 0 || !isIdentifierStart(text[0])) {
    return false;
  }

  for (let index = 1; index < text.length; index += 1) {
    if (!isIdentifierPart(text[index])) {
      return false;
    }
  }

  return true;
}

function splitStatements(input: string): string[] {
  const statements: string[] = [];
  let current = "";

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (character === ";") {
      const trimmed = current.trim();

      if (trimmed.length > 0) {
        statements.push(trimmed);
      }

      current = "";
      continue;
    }

    current += character;
  }

  const trimmed = current.trim();

  if (trimmed.length > 0) {
    statements.push(trimmed);
  }

  return statements;
}

function parseExpression(input: string): Result<ExpressionParts, TuffError> {
  for (let index = 1; index < input.length - 1; index += 1) {
    const operator = input[index];

    if (
      operator !== "+" &&
      operator !== "-" &&
      operator !== "*" &&
      operator !== "/"
    ) {
      continue;
    }

    return ok({
      left: input.slice(0, index).trimEnd(),
      operator,
      right: input.slice(index + 1).trimStart(),
    });
  }

  return unsupportedInput(input);
}

function parseLogicalExpression(
  input: string,
): Result<ExpressionParts, TuffError> {
  const tryParse = (operator: "&&" | "||"): ExpressionParts | undefined => {
    const operatorIndex = input.indexOf(operator);

    if (operatorIndex <= 0 || operatorIndex >= input.length - 2) {
      return undefined;
    }

    return {
      left: input.slice(0, operatorIndex).trimEnd(),
      operator,
      right: input.slice(operatorIndex + 2).trimStart(),
    };
  };

  const orExpression = tryParse("||");

  if (orExpression) {
    return ok(orExpression);
  }

  const andExpression = tryParse("&&");

  if (andExpression) {
    return ok(andExpression);
  }

  return unsupportedInput(input);
}

function parseTypeReference(input: string): Result<TuffTypeInfo, TuffError> {
  if (input === "Bool") {
    return ok(BOOL_TYPE);
  }

  if (input.startsWith("*")) {
    let mutable = false;
    let remaining = input.slice(1).trim();

    if (remaining.startsWith("mut ")) {
      mutable = true;
      remaining = remaining.slice(4);
    }

    const targetSuffix = remaining as TuffSuffix;
    const target = TUFF_TYPES.get(targetSuffix);

    if (!target) {
      return unsupportedSuffix(input, input);
    }

    return ok(
      mutable ? makePointerTypeMutable(target) : makePointerType(target),
    );
  }

  const numeric = TUFF_TYPES.get(input as TuffSuffix);

  if (!numeric) {
    return unsupportedSuffix(input, input);
  }

  return ok(numeric);
}

function consumeRequiredWhitespace(
  input: string,
  text: string,
  index: number,
): Result<number, TuffError> {
  if (index >= text.length || !isWhitespace(text[index])) {
    return unsupportedInput(input);
  }

  return ok(skipWhitespace(text, index));
}

function parseLetStatement(input: string): Result<LetStatement, TuffError> {
  const trimmed = input.trim();

  if (!trimmed.startsWith("let")) {
    return unsupportedInput(input);
  }

  let index = 3;

  const afterLet = consumeRequiredWhitespace(input, trimmed, index);

  if (!afterLet.ok) {
    return afterLet;
  }

  index = afterLet.value;

  let mutable = false;

  if (trimmed.slice(index, index + 3) === "mut") {
    mutable = true;
    index += 3;

    const afterMut = consumeRequiredWhitespace(input, trimmed, index);

    if (!afterMut.ok) {
      return afterMut;
    }

    index = afterMut.value;
  }

  if (index >= trimmed.length || !isIdentifierStart(trimmed[index])) {
    return unsupportedInput(input);
  }

  const nameStart = index;
  index += 1;

  while (index < trimmed.length && isIdentifierPart(trimmed[index])) {
    index += 1;
  }

  const name = trimmed.slice(nameStart, index);
  index = skipWhitespace(trimmed, index);

  let type: TuffTypeInfo | undefined;

  if (index < trimmed.length && trimmed[index] === ":") {
    index += 1;
    index = skipWhitespace(trimmed, index);

    const typeStart = index;

    if (typeStart < trimmed.length && trimmed[typeStart] === "*") {
      index = typeStart + 1;

      if (index < trimmed.length && trimmed[index] === "m") {
        index += 3;
        index = skipWhitespace(trimmed, index);
      }

      while (
        index < trimmed.length &&
        !isWhitespace(trimmed[index]) &&
        trimmed[index] !== "="
      ) {
        index += 1;
      }
    } else {
      while (
        index < trimmed.length &&
        !isWhitespace(trimmed[index]) &&
        trimmed[index] !== "="
      ) {
        index += 1;
      }
    }

    const typeText = trimmed.slice(typeStart, index);

    if (typeText.length === 0) {
      return unsupportedInput(input);
    }

    const parsedType = parseTypeReference(typeText);

    if (!parsedType.ok) {
      return parsedType;
    }

    type = parsedType.value;
    index = skipWhitespace(trimmed, index);
  }

  if (index >= trimmed.length || trimmed[index] !== "=") {
    return unsupportedInput(input);
  }

  const initializer = trimmed.slice(index + 1).trim();

  if (initializer.length === 0) {
    return unsupportedInput(input);
  }

  return ok({ name, type, mutable, initializer });
}

function parseAssignmentStatement(
  input: string,
): Result<AssignmentStatement, TuffError> {
  const trimmed = input.trim();
  const equalsIndex = trimmed.indexOf("=");

  if (equalsIndex <= 0) {
    return unsupportedInput(input);
  }

  const name = trimmed.slice(0, equalsIndex).trim();
  const value = trimmed.slice(equalsIndex + 1).trim();

  if (!isIdentifierText(name) || value.length === 0) {
    return unsupportedInput(input);
  }

  return ok({ name, value });
}

function parseDereferenceAssignmentStatement(
  input: string,
): Result<DereferenceAssignmentStatement, TuffError> {
  const trimmed = input.trim();

  if (!trimmed.startsWith("*")) {
    return unsupportedInput(input);
  }

  const equalsIndex = trimmed.indexOf("=");

  if (equalsIndex <= 1) {
    return unsupportedInput(input);
  }

  const pointerName = trimmed.slice(1, equalsIndex).trim();
  const value = trimmed.slice(equalsIndex + 1).trim();

  if (!isIdentifierText(pointerName) || value.length === 0) {
    return unsupportedInput(input);
  }

  return ok({ pointerName, value });
}

function resolveIdentifier(
  name: string,
  sourceCode: string,
  environment: Map<string, BoundValue>,
): Result<BoundValue, TuffError> {
  const value = environment.get(name);

  if (!value) {
    return undefinedVariable(sourceCode, name);
  }

  return ok(value);
}

function resolveUnaryPointerOperand(
  input: string,
  operand: string,
  environment: Map<string, BoundValue>,
  detail: string,
): Result<UnaryPointerOperand, TuffError> {
  const name = operand.trim();

  if (!isIdentifierText(name)) {
    return invalidPointer(input, detail);
  }

  const resolved = resolveIdentifier(name, input, environment);

  if (!resolved.ok) {
    return resolved;
  }

  return ok({ name, value: resolved.value });
}

function buildAddressPointer(
  name: string,
  numericValue: NumericValue,
): PointerValue {
  return {
    kind: "pointer",
    value: 0n,
    type: makePointerType(numericValue.type),
    mutable: false,
    target: name,
  };
}

function buildMutableAddressPointer(
  name: string,
  numericValue: NumericValue,
): PointerValue {
  if (!numericValue.mutable) {
    return {
      kind: "pointer",
      value: 0n,
      type: makePointerTypeMutable(numericValue.type),
      mutable: true,
      target: "INVALID",
    };
  }

  return {
    kind: "pointer",
    value: 0n,
    type: makePointerTypeMutable(numericValue.type),
    mutable: true,
    target: name,
  };
}

function buildDereferencedNumeric(
  pointerValue: PointerValue,
  environment: Map<string, BoundValue>,
): NumericValue {
  const pointedValue = environment.get(pointerValue.target) as NumericValue;

  return {
    kind: "numeric",
    value: pointedValue.value,
    type: pointedValue.type,
    mutable: false,
  };
}

function dereferencePointer(
  input: string,
  operand: string,
  environment: Map<string, BoundValue>,
): Result<BoundValue, TuffError> {
  const resolved = resolveUnaryPointerOperand(
    input,
    operand,
    environment,
    "Dereference requires a named pointer variable.",
  );

  if (!resolved.ok) {
    return resolved;
  }

  if (!isPointerValue(resolved.value.value)) {
    const invalidMessage = `${resolved.value.name} cannot be used here.`;

    return invalidPointer(input, invalidMessage);
  }

  return ok(buildDereferencedNumeric(resolved.value.value, environment));
}

function evaluateExpression(
  input: string,
  environment: Map<string, BoundValue>,
): Result<BoundValue, TuffError> {
  const trimmed = input.trim();

  if (trimmed === "true" || trimmed === "false") {
    return ok(makeBoolValue(trimmed === "true", false));
  }

  if (trimmed.startsWith("!")) {
    const operand = evaluateExpression(trimmed.slice(1), environment);

    if (!operand.ok) {
      return operand;
    }

    if (!isBoolValue(operand.value)) {
      return invalidPointer(input, "Logical negation requires a Bool operand.");
    }

    return ok(makeBoolValue(!operand.value.value, false));
  }

  const logicalExpression = parseLogicalExpression(trimmed);

  if (logicalExpression.ok) {
    const left = evaluateExpression(logicalExpression.value.left, environment);

    if (!left.ok) {
      return left;
    }

    const right = evaluateExpression(
      logicalExpression.value.right,
      environment,
    );

    if (!right.ok) {
      return right;
    }

    if (!isBoolValue(left.value) || !isBoolValue(right.value)) {
      return invalidPointer(input, "Logical operators require Bool operands.");
    }

    return ok(
      makeBoolValue(
        logicalExpression.value.operator === "&&"
          ? left.value.value && right.value.value
          : left.value.value || right.value.value,
        false,
      ),
    );
  }

  if (trimmed.startsWith("&")) {
    let mutable = false;
    let operand = trimmed.slice(1);

    if (operand.trim().startsWith("mut ")) {
      mutable = true;
      operand = operand.trim().slice(4);
    }

    const resolved = resolveUnaryPointerOperand(
      input,
      operand,
      environment,
      "Address-of requires a named variable.",
    );

    if (!resolved.ok) {
      return resolved;
    }

    if (!isNumericValue(resolved.value.value)) {
      return invalidPointer(
        input,
        `${resolved.value.name} cannot be used here.`,
      );
    }

    if (mutable) {
      const result = buildMutableAddressPointer(
        resolved.value.name,
        resolved.value.value,
      );

      if (result.target === "INVALID") {
        return invalidPointer(
          input,
          "Cannot take mutable address of immutable variable.",
        );
      }

      return ok(result);
    }

    return ok(buildAddressPointer(resolved.value.name, resolved.value.value));
  }

  if (trimmed.startsWith("*")) {
    return dereferencePointer(input, trimmed.slice(1), environment);
  }

  const literal = parseLiteral(trimmed);

  if (literal.ok) {
    return ok({
      kind: "numeric",
      value: literal.value.value,
      type: literal.value.type,
      mutable: false,
    });
  }

  const expression = parseExpression(trimmed);

  if (!expression.ok) {
    if (isIdentifierText(trimmed)) {
      return resolveIdentifier(trimmed, input, environment);
    }

    return literal.error.kind === "UnsupportedInput"
      ? unsupportedInput(input)
      : literal;
  }

  const left = evaluateExpression(expression.value.left, environment);

  if (!left.ok) {
    return left;
  }

  const right = evaluateExpression(expression.value.right, environment);

  if (!right.ok) {
    return right;
  }

  if (!isNumericValue(left.value) || !isNumericValue(right.value)) {
    return invalidPointer(input, "Arithmetic requires numeric operands.");
  }

  const resultType = promoteType(left.value.type, right.value.type);
  let result = 0n;

  switch (expression.value.operator) {
    case "+":
      result = left.value.value + right.value.value;
      break;
    case "-":
      result = left.value.value - right.value.value;
      break;
    case "*":
      result = left.value.value * right.value.value;
      break;
    case "/":
      if (right.value.value === 0n) {
        return divisionByZero(input);
      }

      result = left.value.value / right.value.value;
      break;
  }

  if (result < resultType.min || result > resultType.max) {
    return outOfBounds(input, resultType.suffix);
  }

  return ok({
    kind: "numeric",
    value: result,
    type: resultType,
    mutable: false,
  });
}

function evaluateStatement(
  statement: string,
  environment: Map<string, BoundValue>,
): Result<BoundValue, TuffError> {
  const letStatement = parseLetStatement(statement);

  if (letStatement.ok) {
    const initializer = evaluateExpression(
      letStatement.value.initializer,
      environment,
    );

    if (!initializer.ok) {
      return initializer;
    }

    const inferredType = letStatement.value.type ?? initializer.value.type;

    if (inferredType.kind === "numeric") {
      if (!isNumericValue(initializer.value)) {
        return invalidPointer(
          statement,
          "Initializer type does not match the declared type.",
        );
      }

      if (
        initializer.value.value < inferredType.min ||
        initializer.value.value > inferredType.max
      ) {
        return outOfBounds(statement, inferredType.suffix);
      }

      return bindValue(
        letStatement.value.name,
        makeNumericValue(
          initializer.value.value,
          inferredType,
          letStatement.value.mutable,
        ),
        environment,
      );
    }

    if (inferredType.kind === "bool") {
      if (!isBoolValue(initializer.value)) {
        return invalidPointer(
          statement,
          "Initializer type does not match the declared type.",
        );
      }

      return bindValue(
        letStatement.value.name,
        makeBoolValue(initializer.value.value, letStatement.value.mutable),
        environment,
      );
    }

    if (!isPointerValue(initializer.value)) {
      return invalidPointer(
        statement,
        "Initializer type does not match the declared type.",
      );
    }

    const pointerInitializer = initializer.value;

    if (inferredType.target.suffix !== pointerInitializer.type.target.suffix) {
      return invalidPointer(
        statement,
        "Initializer type does not match the declared type.",
      );
    }

    const boundValue: PointerValue = {
      kind: "pointer",
      value: pointerInitializer.value,
      type: inferredType,
      mutable: letStatement.value.mutable,
      target: pointerInitializer.target,
    };

    environment.set(letStatement.value.name, boundValue);
    return ok(boundValue);
  }

  if (statement.trim().startsWith("let")) {
    return letStatement;
  }

  const assignmentStatement = parseAssignmentStatement(statement);

  if (assignmentStatement.ok) {
    const existing = environment.get(assignmentStatement.value.name);

    if (!existing) {
      return undefinedVariable(statement, assignmentStatement.value.name);
    }

    if (!existing.mutable) {
      return immutableVariable(statement, assignmentStatement.value.name);
    }

    const assigned = evaluateExpression(
      assignmentStatement.value.value,
      environment,
    );

    if (!assigned.ok) {
      return assigned;
    }

    if (existing.type.kind === "numeric") {
      if (!isNumericValue(assigned.value)) {
        return invalidPointer(
          statement,
          "Assigned value type does not match the variable type.",
        );
      }

      if (
        assigned.value.value < existing.type.min ||
        assigned.value.value > existing.type.max
      ) {
        return outOfBounds(statement, existing.type.suffix);
      }

      return bindValue(
        assignmentStatement.value.name,
        makeNumericValue(assigned.value.value, existing.type, existing.mutable),
        environment,
      );
    }

    if (existing.type.kind === "bool") {
      if (!isBoolValue(assigned.value)) {
        return invalidPointer(
          statement,
          "Assigned value type does not match the variable type.",
        );
      }

      return bindValue(
        assignmentStatement.value.name,
        makeBoolValue(assigned.value.value, existing.mutable),
        environment,
      );
    }

    if (!isPointerValue(assigned.value)) {
      return invalidPointer(
        statement,
        "Assigned value type does not match the variable type.",
      );
    }

    const pointerAssigned = assigned.value;

    if (existing.type.mutable && !assigned.value.type.mutable) {
      return invalidPointer(
        statement,
        "Cannot assign immutable pointer to mutable pointer binding.",
      );
    }

    if (existing.type.target.suffix !== pointerAssigned.type.target.suffix) {
      return invalidPointer(
        statement,
        "Assigned value type does not match the variable type.",
      );
    }

    const updatedValue: PointerValue = {
      kind: "pointer",
      value: pointerAssigned.value,
      type: existing.type,
      mutable: existing.mutable,
      target: pointerAssigned.target,
    };

    environment.set(assignmentStatement.value.name, updatedValue);
    return ok(updatedValue);
  }

  const dereferenceAssignmentStatement =
    parseDereferenceAssignmentStatement(statement);

  if (dereferenceAssignmentStatement.ok) {
    const pointerVar = environment.get(
      dereferenceAssignmentStatement.value.pointerName,
    );

    if (!pointerVar) {
      return undefinedVariable(
        statement,
        dereferenceAssignmentStatement.value.pointerName,
      );
    }

    if (!isPointerValue(pointerVar)) {
      return invalidPointer(
        statement,
        "Cannot dereference a non-pointer variable.",
      );
    }

    if (!pointerVar.type.mutable) {
      return invalidPointer(
        statement,
        "Cannot assign through an immutable pointer.",
      );
    }

    const targetVar = environment.get(pointerVar.target) as NumericValue;

    const assigned = evaluateExpression(
      dereferenceAssignmentStatement.value.value,
      environment,
    );

    if (!assigned.ok) {
      return assigned;
    }

    if (!isNumericValue(assigned.value)) {
      return invalidPointer(
        statement,
        "Cannot assign non-numeric value through pointer.",
      );
    }

    if (
      assigned.value.value < targetVar.type.min ||
      assigned.value.value > targetVar.type.max
    ) {
      return outOfBounds(statement, targetVar.type.suffix);
    }

    const updatedTarget = makeNumericValue(
      assigned.value.value,
      targetVar.type,
      true,
    );

    return bindValue(pointerVar.target, updatedTarget, environment);
  }

  return evaluateExpression(statement, environment);
}

function promoteType(
  left: NumericTypeInfo,
  right: NumericTypeInfo,
): NumericTypeInfo {
  const bits = Math.max(left.bits, right.bits) as 8 | 16 | 32 | 64;
  const signed = left.signed || right.signed;

  if (signed) {
    switch (bits) {
      case 8:
        return TUFF_TYPES.get("I8") as NumericTypeInfo;
      case 16:
        return TUFF_TYPES.get("I16") as NumericTypeInfo;
      case 32:
        return TUFF_TYPES.get("I32") as NumericTypeInfo;
      default:
        return TUFF_TYPES.get("I64") as NumericTypeInfo;
    }
  }

  switch (bits) {
    case 8:
      return TUFF_TYPES.get("U8") as NumericTypeInfo;
    case 16:
      return TUFF_TYPES.get("U16") as NumericTypeInfo;
    case 32:
      return TUFF_TYPES.get("U32") as NumericTypeInfo;
    default:
      return TUFF_TYPES.get("U64") as NumericTypeInfo;
  }
}

function interpretTuff(input: string): Result<number, TuffError> {
  const statements = splitStatements(input);

  if (statements.length === 0) {
    return unsupportedInput(input);
  }

  const environment = new Map<string, BoundValue>();
  let lastValue: BoundValue | undefined;

  for (const statement of statements) {
    const evaluated = evaluateStatement(statement, environment);

    if (!evaluated.ok) {
      return evaluated;
    }

    lastValue = evaluated.value;
  }

  if (!lastValue || lastValue.kind !== "numeric") {
    if (lastValue && lastValue.kind === "bool") {
      return ok(lastValue.value ? 1 : 0);
    }

    return invalidPointer(input, "The final result must be numeric or Bool.");
  }

  return ok(Number(lastValue.value));
}

function main(): void {
  console.log("Hello from TypeScript!");
}

export { interpretTuff, main };
