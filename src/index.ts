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

type TuffTypeInfo =
  | NumericTypeInfo
  | PointerTypeInfo
  | BoolTypeInfo
  | StructTypeInfo;

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
    | "InvalidPointer"
    | "IterationLimit"
    | "UndefinedType";
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

interface IfExpressionParts {
  condition: string;
  thenBranch: string;
  elseBranch: string;
}

interface IfStatementParts {
  condition: string;
  thenBranch: string;
  elseBranch: string | undefined;
}

interface WhileStatement {
  condition: string;
  body: string;
}

interface StructTypeInfo {
  kind: "struct";
  name: string;
  suffix: string;
}

interface StructFieldDef {
  name: string;
  type: TuffTypeInfo;
  mutable: boolean;
}

interface StructDefinition {
  name: string;
  fields: StructFieldDef[];
}

interface FieldAssignmentStatement {
  path: string[];
  operator: string;
  rhs: string;
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

interface CompoundAssignmentStatement {
  name: string;
  operator: string;
  value: string;
}

interface DereferenceCompoundAssignmentStatement {
  pointerName: string;
  operator: string;
  value: string;
}

interface DerefContext {
  pointerVar: PointerValue;
  targetVar: NumericValue;
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

interface StructValue {
  kind: "struct";
  typeName: string;
  type: StructTypeInfo;
  fields: Map<string, BoundValue>;
  definition: StructDefinition;
  mutable: boolean;
}

interface UnitValue {
  kind: "unit";
}

type BoundValue = NumericValue | PointerValue | BoolValue | StructValue;
type StatementValue = BoundValue | UnitValue;

interface UnaryPointerOperand {
  name: string;
  value: BoundValue;
}

interface Scope {
  bindings: Map<string, BoundValue>;
  typeDefinitions: Map<string, StructDefinition>;
  parent: Scope | undefined;
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
const UNIT_VALUE: UnitValue = { kind: "unit" };

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

function iterationLimit(input: string): ErrResult<TuffError> {
  return err({
    kind: "IterationLimit",
    sourceCode: input,
    message: `While loop exceeded the 1024 iteration limit: ${input}`,
    reason: "The loop condition remained true for more than 1024 iterations.",
    suggestedFix:
      "Ensure the loop condition eventually becomes false within 1024 steps.",
  });
}

function undefinedType(input: string, name: string): ErrResult<TuffError> {
  return err({
    kind: "UndefinedType",
    sourceCode: input,
    message: `Undefined struct type '${name}': ${input}`,
    reason: `The struct type '${name}' has not been defined in the current scope.`,
    suggestedFix: `Define the struct with 'struct ${name} { ... }' before using it.`,
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

function isStructValue(value: BoundValue): value is StructValue {
  return value.kind === "struct";
}

function resolveTypeDefinition(
  scope: Scope,
  name: string,
): StructDefinition | undefined {
  let current: Scope | undefined = scope;

  while (current) {
    const def = current.typeDefinitions.get(name);

    if (def) {
      return def;
    }

    current = current.parent;
  }

  return undefined;
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
  scope: Scope,
): OkResult<BoundValue> {
  scope.bindings.set(name, value);
  return ok(value);
}

function createScope(parent: Scope | undefined): Scope {
  return {
    bindings: new Map<string, BoundValue>(),
    typeDefinitions: new Map<string, StructDefinition>(),
    parent,
  };
}

function resolveScopeBinding(
  scope: Scope,
  name: string,
): BoundValue | undefined {
  let current: Scope | undefined = scope;

  while (current) {
    const value = current.bindings.get(name);

    if (value !== undefined) {
      return value;
    }

    current = current.parent;
  }

  return undefined;
}

function assignScopeBinding(
  scope: Scope,
  name: string,
  value: BoundValue,
): void {
  let current: Scope | undefined = scope;

  while (current) {
    if (current.bindings.has(name)) {
      current.bindings.set(name, value);
      return;
    }

    current = current.parent;
  }
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

function cloneBoundValue(value: BoundValue): BoundValue {
  if (value.kind === "numeric") {
    return {
      kind: "numeric",
      value: value.value,
      type: value.type,
      mutable: value.mutable,
    };
  }

  if (value.kind === "bool") {
    return {
      kind: "bool",
      value: value.value,
      type: value.type,
      mutable: value.mutable,
    };
  }

  if (value.kind === "struct") {
    const clonedFields = new Map<string, BoundValue>();

    for (const [fname, fval] of value.fields.entries()) {
      clonedFields.set(fname, cloneBoundValue(fval));
    }

    return {
      kind: "struct",
      typeName: value.typeName,
      type: value.type,
      fields: clonedFields,
      definition: value.definition,
      mutable: value.mutable,
    };
  }

  return {
    kind: "pointer",
    value: value.value,
    type: value.type,
    mutable: value.mutable,
    target: value.target,
  };
}

function cloneScope(scope: Scope): Scope {
  const clonedBindings = new Map<string, BoundValue>();

  for (const [name, value] of scope.bindings.entries()) {
    clonedBindings.set(name, cloneBoundValue(value));
  }

  return {
    bindings: clonedBindings,
    typeDefinitions: new Map<string, StructDefinition>(scope.typeDefinitions),
    parent: scope.parent ? cloneScope(scope.parent) : undefined,
  };
}

function isTypeMatch(left: TuffTypeInfo, right: TuffTypeInfo): boolean {
  if (left.kind !== right.kind) {
    return false;
  }

  if (left.kind === "numeric") {
    return left.suffix === (right as NumericTypeInfo).suffix;
  }

  if (left.kind === "bool") {
    return true;
  }

  if (left.kind === "struct") {
    return left.name === (right as StructTypeInfo).name;
  }

  const rightPointer = right as PointerTypeInfo;

  return (
    left.mutable === rightPointer.mutable &&
    left.target.suffix === rightPointer.target.suffix
  );
}

function isKeywordBoundary(text: string, index: number): boolean {
  if (index < 0 || index >= text.length) {
    return true;
  }

  return !isIdentifierPart(text[index]);
}

function startsWithKeywordAt(
  text: string,
  keyword: string,
  index: number,
): boolean {
  if (text.slice(index, index + keyword.length) !== keyword) {
    return false;
  }

  return (
    isKeywordBoundary(text, index - 1) &&
    isKeywordBoundary(text, index + keyword.length)
  );
}

function findMatchingDelimiter(
  text: string,
  startIndex: number,
  openChar: string,
  closeChar: string,
): number {
  let depth = 0;

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];

    if (character === openChar) {
      depth += 1;
      continue;
    }

    if (character === closeChar) {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function readIdentifier(
  input: string,
  trimmed: string,
  index: number,
): Result<{ name: string; next: number }, TuffError> {
  if (index >= trimmed.length || !isIdentifierStart(trimmed[index])) {
    return unsupportedInput(input);
  }

  const nameStart = index;
  let pos = index + 1;

  while (pos < trimmed.length && isIdentifierPart(trimmed[pos])) {
    pos += 1;
  }

  return ok({
    name: trimmed.slice(nameStart, pos),
    next: skipWhitespace(trimmed, pos),
  });
}

function splitIdentifierPath(text: string): string[] | undefined {
  const path = text.split(".").map((s) => s.trim());

  return path.length < 2 || !path.every(isIdentifierText) ? undefined : path;
}

function parseTypeOrError(
  typeText: string,
  input: string,
): Result<TuffTypeInfo, TuffError> {
  if (typeText.length === 0) {
    return unsupportedInput(input);
  }

  return parseTypeReference(typeText);
}

function splitStatements(input: string): Result<string[], TuffError> {
  const statements: string[] = [];
  let current = "";
  let braceDepth = 0;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (character === "{") {
      braceDepth += 1;
      current += character;
      continue;
    }

    if (character === "}") {
      braceDepth -= 1;

      if (braceDepth < 0) {
        return unsupportedInput(input);
      }

      current += character;

      if (braceDepth === 0) {
        let nextIndex = index + 1;

        while (nextIndex < input.length && isWhitespace(input[nextIndex])) {
          nextIndex += 1;
        }

        if (
          nextIndex < input.length &&
          input[nextIndex] !== ";" &&
          !startsWithKeywordAt(input, "else", nextIndex)
        ) {
          statements.push(current.trim());

          current = "";
        }
      }

      continue;
    }

    if (character === ";" && braceDepth === 0) {
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

  if (braceDepth !== 0) {
    return unsupportedInput(input);
  }

  return ok(statements);
}

function isBlockExpressionText(text: string): boolean {
  const trimmed = text.trim();

  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return false;
  }

  let braceDepth = 0;

  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];

    if (character === "{") {
      braceDepth += 1;
    } else if (character === "}") {
      braceDepth -= 1;
    }
  }

  return braceDepth === 0;
}

function evaluateBlockExpression(
  input: string,
  scope: Scope,
): Result<BoundValue, TuffError> {
  const trimmed = input.trim();
  const inner = trimmed.slice(1, trimmed.length - 1);
  const blockStatements = (splitStatements(inner) as OkResult<string[]>).value;

  if (blockStatements.length === 0) {
    return unsupportedInput(input);
  }

  const blockScope = createScope(scope);
  let lastValue: BoundValue | undefined;

  for (const statement of blockStatements) {
    const evaluated = evaluateStatement(statement, blockScope);

    if (!evaluated.ok) {
      return evaluated;
    }

    if (evaluated.value.kind !== "unit") {
      lastValue = evaluated.value;
    }
  }

  if (!lastValue) {
    return unsupportedInput(input);
  }

  return ok(lastValue);
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

function parseComparisonExpression(
  input: string,
): Result<ExpressionParts | undefined, TuffError> {
  const twoCharacterOperators = ["==", "!=", "<=", ">="];
  const oneCharacterOperators = ["<", ">"];
  const matches: Array<{ index: number; operator: string }> = [];

  for (let index = 0; index < input.length; index += 1) {
    let matchedOperator: string | undefined;

    for (const operator of twoCharacterOperators) {
      if (input.slice(index, index + 2) === operator) {
        matchedOperator = operator;
        break;
      }
    }

    if (!matchedOperator) {
      for (const operator of oneCharacterOperators) {
        if (input[index] === operator) {
          matchedOperator = operator;
          break;
        }
      }
    }

    if (matchedOperator) {
      matches.push({ index, operator: matchedOperator });

      if (matchedOperator.length === 2) {
        index += 1;
      }
    }
  }

  if (matches.length === 0) {
    return ok(undefined);
  }

  if (matches.length > 1) {
    return unsupportedInput(input);
  }

  const match = matches[0];
  const left = input.slice(0, match.index).trimEnd();
  const right = input.slice(match.index + match.operator.length).trimStart();

  if (left.length === 0 || right.length === 0) {
    return unsupportedInput(input);
  }

  return ok({
    left,
    operator: match.operator,
    right,
  });
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

function findElseForIf(input: string, startIndex: number): number {
  let parenDepth = 0;
  let braceDepth = 0;
  let nestedIfCount = 0;

  for (let index = startIndex; index < input.length; index += 1) {
    const character = input[index];

    if (character === "(") {
      parenDepth += 1;
      continue;
    }

    if (character === ")") {
      parenDepth -= 1;
      continue;
    }

    if (character === "{") {
      braceDepth += 1;
      continue;
    }

    if (character === "}") {
      braceDepth -= 1;
      continue;
    }

    if (parenDepth !== 0 || braceDepth !== 0) {
      continue;
    }

    if (startsWithKeywordAt(input, "if", index)) {
      nestedIfCount += 1;
      continue;
    }

    if (startsWithKeywordAt(input, "else", index)) {
      if (nestedIfCount === 0) {
        return index;
      }

      nestedIfCount -= 1;
    }
  }

  return -1;
}

interface ParenConditionResult {
  condition: string;
  afterIndex: number;
}

function parseParenCondition(
  input: string,
  trimmed: string,
  startIndex: number,
): Result<ParenConditionResult, TuffError> {
  let index = startIndex;

  index = skipWhitespace(trimmed, index);

  if (index >= trimmed.length || trimmed[index] !== "(") {
    return unsupportedInput(input);
  }

  const conditionEnd = findMatchingDelimiter(trimmed, index, "(", ")");

  if (conditionEnd < 0) {
    return unsupportedInput(input);
  }

  const condition = trimmed.slice(index + 1, conditionEnd).trim();

  if (condition.length === 0) {
    return unsupportedInput(input);
  }

  const afterIndex = skipWhitespace(trimmed, conditionEnd + 1);

  if (afterIndex >= trimmed.length) {
    return unsupportedInput(input);
  }

  return ok({ condition, afterIndex });
}

function parseIfHeader(
  input: string,
  trimmed: string,
): Result<{ condition: string; branchStart: number }, TuffError> {
  if (trimmed.length < 3 || !isWhitespace(trimmed[2])) {
    return unsupportedInput(input);
  }

  const parsed = parseParenCondition(input, trimmed, 2);

  if (!parsed.ok) {
    return parsed;
  }

  return ok({
    condition: parsed.value.condition,
    branchStart: parsed.value.afterIndex,
  });
}

function parseIfBranches(
  input: string,
  trimmed: string,
  branchStart: number,
): Result<{ thenBranch: string; elseBranch: string | undefined }, TuffError> {
  const elseIndex = findElseForIf(trimmed, branchStart);

  if (elseIndex < 0) {
    return ok({
      thenBranch: trimmed.slice(branchStart).trim(),
      elseBranch: undefined,
    });
  }

  const thenBranch = trimmed.slice(branchStart, elseIndex).trim();

  if (thenBranch.length === 0) {
    return unsupportedInput(input);
  }

  const elseStart = skipWhitespace(trimmed, elseIndex + 4);

  if (elseStart >= trimmed.length) {
    return unsupportedInput(input);
  }

  return ok({
    thenBranch,
    elseBranch: trimmed.slice(elseStart).trim(),
  });
}

function parseIfParts(
  input: string,
  mode: "expression" | "statement",
): Result<IfExpressionParts | IfStatementParts | undefined, TuffError> {
  const trimmed = input.trim();

  if (!trimmed.startsWith("if")) {
    return ok(undefined);
  }

  if (!startsWithKeywordAt(trimmed, "if", 0)) {
    return mode === "expression" ? unsupportedInput(input) : ok(undefined);
  }

  const parsedHeader = parseIfHeader(input, trimmed);

  if (!parsedHeader.ok) {
    return parsedHeader;
  }

  const parsedBranches = parseIfBranches(
    input,
    trimmed,
    parsedHeader.value.branchStart,
  );

  if (!parsedBranches.ok) {
    return parsedBranches;
  }

  const parsedIf = {
    condition: parsedHeader.value.condition,
    thenBranch: parsedBranches.value.thenBranch,
    elseBranch: parsedBranches.value.elseBranch,
  };

  if (mode === "expression") {
    if (parsedBranches.value.elseBranch === undefined) {
      return unsupportedInput(input);
    }

    return ok(parsedIf);
  }

  if (
    parsedBranches.value.elseBranch !== undefined &&
    (!parsedBranches.value.thenBranch.startsWith("{") ||
      !parsedBranches.value.elseBranch.startsWith("{"))
  ) {
    return ok(undefined);
  }

  return ok(parsedIf);
}

function parseIfExpression(
  input: string,
): Result<IfExpressionParts | undefined, TuffError> {
  return parseIfParts(input, "expression") as Result<
    IfExpressionParts | undefined,
    TuffError
  >;
}

function parseIfStatement(
  input: string,
): Result<IfStatementParts | undefined, TuffError> {
  return parseIfParts(input, "statement") as Result<
    IfStatementParts | undefined,
    TuffError
  >;
}

function parseWhileStatement(
  input: string,
): Result<WhileStatement | undefined, TuffError> {
  const trimmed = input.trim();

  if (!trimmed.startsWith("while")) {
    return ok(undefined);
  }

  if (!startsWithKeywordAt(trimmed, "while", 0)) {
    return ok(undefined);
  }

  let index = 5;

  const parsed = parseParenCondition(input, trimmed, index);

  if (!parsed.ok) {
    return parsed;
  }

  const body = trimmed.slice(parsed.value.afterIndex).trim();

  return ok({ condition: parsed.value.condition, body });
}

function splitByComma(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const character of input) {
    if (character === "{" || character === "}") {
      depth += character === "{" ? 1 : -1;
      current += character;
    } else if (character === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  if (current.trim().length > 0) {
    parts.push(current.trim());
  }

  return parts;
}

function parseStructDefinitionStatement(
  input: string,
): Result<StructDefinition | undefined, TuffError> {
  const trimmed = input.trim();

  if (!startsWithKeywordAt(trimmed, "struct", 0)) {
    return ok(undefined);
  }

  let index = 6;

  const afterStruct = consumeRequiredWhitespace(input, trimmed, index);

  if (!afterStruct.ok) {
    return afterStruct;
  }

  index = afterStruct.value;

  const identResult = readIdentifier(input, trimmed, index);

  if (!identResult.ok) {
    return identResult;
  }

  const { name, next: nextIndex } = identResult.value;
  index = nextIndex;

  if (index >= trimmed.length || trimmed[index] !== "{") {
    return unsupportedInput(input);
  }

  const bodyEnd = findMatchingDelimiter(trimmed, index, "{", "}");

  const bodyText = trimmed.slice(index + 1, bodyEnd);
  const fieldTexts = bodyText
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const fields: StructFieldDef[] = [];

  for (const fieldText of fieldTexts) {
    let fi = 0;
    let mutable = false;

    if (
      fieldText.startsWith("mut") &&
      (fieldText.length === 3 || isWhitespace(fieldText[3]))
    ) {
      mutable = true;
      fi = skipWhitespace(fieldText, 3);
    }

    if (fi >= fieldText.length || !isIdentifierStart(fieldText[fi])) {
      return unsupportedInput(input);
    }

    const fnameStart = fi;
    fi += 1;

    while (fi < fieldText.length && isIdentifierPart(fieldText[fi])) {
      fi += 1;
    }

    const fieldName = fieldText.slice(fnameStart, fi);
    fi = skipWhitespace(fieldText, fi);

    if (fi >= fieldText.length || fieldText[fi] !== ":") {
      return unsupportedInput(input);
    }

    fi += 1;
    fi = skipWhitespace(fieldText, fi);

    const typeText = fieldText.slice(fi).trim();

    const parsedType = parseTypeOrError(typeText, input);

    if (!parsedType.ok) {
      return parsedType;
    }

    fields.push({ name: fieldName, type: parsedType.value, mutable });
  }

  if (fields.length === 0) {
    return unsupportedInput(input);
  }

  return ok({ name, fields });
}

interface StructInstantiationParts {
  typeName: string;
  fieldPairs: Array<{ name: string; value: string }>;
}

function parseStructInstantiation(
  input: string,
): StructInstantiationParts | undefined {
  const trimmed = input.trim();

  if (trimmed.length === 0 || !isIdentifierStart(trimmed[0])) {
    return undefined;
  }

  let index = 1;

  while (index < trimmed.length && isIdentifierPart(trimmed[index])) {
    index += 1;
  }

  const typeName = trimmed.slice(0, index);
  index = skipWhitespace(trimmed, index);

  if (index >= trimmed.length || trimmed[index] !== "{") {
    return undefined;
  }

  const bodyEnd = findMatchingDelimiter(trimmed, index, "{", "}");

  const bodyText = trimmed.slice(index + 1, bodyEnd);
  const rawPairs = splitByComma(bodyText);
  const fieldPairs: Array<{ name: string; value: string }> = [];

  for (const pair of rawPairs) {
    const colonIndex = pair.indexOf(":");

    if (colonIndex < 0) {
      return undefined;
    }

    const fieldName = pair.slice(0, colonIndex).trim();
    const fieldValue = pair.slice(colonIndex + 1).trim();

    if (!isIdentifierText(fieldName) || fieldValue.length === 0) {
      return undefined;
    }

    fieldPairs.push({ name: fieldName, value: fieldValue });
  }

  return { typeName, fieldPairs };
}

function parseFieldAccess(input: string): string[] | undefined {
  const trimmed = input.trim();

  if (!trimmed.includes(".")) {
    return undefined;
  }

  return splitIdentifierPath(trimmed);
}

function parseFieldAssignmentStatement(
  input: string,
): FieldAssignmentStatement | undefined {
  const trimmed = input.trim();
  const dotIndex = trimmed.indexOf(".");

  if (dotIndex <= 0) {
    return undefined;
  }

  const equalsIndex = trimmed.indexOf("=");

  if (
    equalsIndex <= dotIndex ||
    isComparisonEqualsUsage(trimmed, equalsIndex)
  ) {
    return undefined;
  }

  const operator = extractCompoundOperator(trimmed, equalsIndex) ?? "";
  const lhs = trimmed.slice(0, equalsIndex - operator.length).trim();
  const rhs = trimmed.slice(equalsIndex + 1).trim();

  if (rhs.length === 0) {
    return undefined;
  }

  const path = splitIdentifierPath(lhs);

  if (path === undefined) {
    return undefined;
  }

  return { path, operator, rhs };
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
    if (isIdentifierText(input)) {
      return ok({ kind: "struct", name: input, suffix: input });
    }

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

  const identResult = readIdentifier(input, trimmed, index);

  if (!identResult.ok) {
    return identResult;
  }

  const name = identResult.value.name;
  index = identResult.value.next;

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

    const parsedType = parseTypeOrError(typeText, input);

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

function isComparisonEqualsUsage(
  trimmed: string,
  equalsIndex: number,
): boolean {
  return (
    (equalsIndex < trimmed.length - 1 && trimmed[equalsIndex + 1] === "=") ||
    trimmed[equalsIndex - 1] === "!" ||
    trimmed[equalsIndex - 1] === "<" ||
    trimmed[equalsIndex - 1] === ">"
  );
}

function extractCompoundOperator(
  trimmed: string,
  equalsIndex: number,
): string | undefined {
  const prev = trimmed[equalsIndex - 1];

  if (prev === "+" || prev === "-" || prev === "*" || prev === "/") {
    return prev;
  }

  if (prev === "&" && trimmed[equalsIndex - 2] === "&") {
    return "&&";
  }

  if (prev === "|" && trimmed[equalsIndex - 2] === "|") {
    return "||";
  }

  return undefined;
}

interface EqualsBase {
  operator: string;
  lhs: string;
  value: string;
}

function parseEqualsBase(
  trimmed: string,
  lhsStart: number,
  minEqualsIndex: number,
): EqualsBase | undefined {
  const equalsIndex = trimmed.indexOf("=");

  if (equalsIndex <= minEqualsIndex) {
    return undefined;
  }

  if (isComparisonEqualsUsage(trimmed, equalsIndex)) {
    return undefined;
  }

  const operator = extractCompoundOperator(trimmed, equalsIndex) ?? "";
  const lhs = trimmed.slice(lhsStart, equalsIndex - operator.length).trim();
  const value = trimmed.slice(equalsIndex + 1).trim();

  if (!isIdentifierText(lhs) || value.length === 0) {
    return undefined;
  }

  return { operator, lhs, value };
}

function parseAssignmentStatement(
  input: string,
): Result<AssignmentStatement, TuffError> {
  const base = parseEqualsBase(input.trim(), 0, 0);

  if (!base || base.operator !== "") {
    return unsupportedInput(input);
  }

  return ok({ name: base.lhs, value: base.value });
}

function parseCompoundAssignmentStatement(
  input: string,
): Result<CompoundAssignmentStatement, TuffError> {
  const base = parseEqualsBase(input.trim(), 0, 1);

  if (!base || base.operator === "") {
    return unsupportedInput(input);
  }

  return ok({ name: base.lhs, operator: base.operator, value: base.value });
}

function parseAnyDereferenceAssignment(
  input: string,
): Result<DereferenceCompoundAssignmentStatement, TuffError> {
  const trimmed = input.trim();

  if (!trimmed.startsWith("*")) {
    return unsupportedInput(input);
  }

  const base = parseEqualsBase(trimmed, 1, 1);

  if (!base) {
    return unsupportedInput(input);
  }

  return ok({
    pointerName: base.lhs,
    operator: base.operator,
    value: base.value,
  });
}

function validateMutableDerefTarget(
  statement: string,
  pointerName: string,
  scope: Scope,
): Result<DerefContext, TuffError> {
  const ptrVar = resolveScopeBinding(scope, pointerName);

  if (!ptrVar) {
    return undefinedVariable(statement, pointerName);
  }

  if (!isPointerValue(ptrVar)) {
    return invalidPointer(
      statement,
      "Cannot dereference a non-pointer variable.",
    );
  }

  if (!ptrVar.type.mutable) {
    return invalidPointer(
      statement,
      "Cannot assign through an immutable pointer.",
    );
  }

  const targetVar = resolveScopeBinding(scope, ptrVar.target) as NumericValue;

  return ok({ pointerVar: ptrVar, targetVar });
}

function resolveIdentifier(
  name: string,
  sourceCode: string,
  scope: Scope,
): Result<BoundValue, TuffError> {
  const value = resolveScopeBinding(scope, name);

  if (!value) {
    return undefinedVariable(sourceCode, name);
  }

  return ok(value);
}

function resolveUnaryPointerOperand(
  input: string,
  operand: string,
  scope: Scope,
  detail: string,
): Result<UnaryPointerOperand, TuffError> {
  const name = operand.trim();

  if (!isIdentifierText(name)) {
    return invalidPointer(input, detail);
  }

  const resolved = resolveIdentifier(name, input, scope);

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
  scope: Scope,
): NumericValue {
  const pointedValue = resolveScopeBinding(
    scope,
    pointerValue.target,
  ) as NumericValue;

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
  scope: Scope,
): Result<BoundValue, TuffError> {
  const resolved = resolveUnaryPointerOperand(
    input,
    operand,
    scope,
    "Dereference requires a named pointer variable.",
  );

  if (!resolved.ok) {
    return resolved;
  }

  if (!isPointerValue(resolved.value.value)) {
    const invalidMessage = `${resolved.value.name} cannot be used here.`;

    return invalidPointer(input, invalidMessage);
  }

  return ok(buildDereferencedNumeric(resolved.value.value, scope));
}

function makeStructValue(
  typeName: string,
  fieldType: StructTypeInfo,
  fields: Map<string, BoundValue>,
  definition: StructDefinition,
  mutable: boolean,
): StructValue {
  const clonedFields = new Map<string, BoundValue>();

  for (const [fname, fval] of fields.entries()) {
    clonedFields.set(fname, cloneBoundValue(fval));
  }

  return {
    kind: "struct",
    typeName,
    type: fieldType,
    fields: clonedFields,
    definition,
    mutable,
  };
}

function resolveFieldChain(
  path: string[],
  input: string,
  scope: Scope,
): Result<BoundValue, TuffError> {
  const rootBinding = resolveScopeBinding(scope, path[0]);

  if (!rootBinding) {
    return undefinedVariable(input, path[0]);
  }

  let current: BoundValue = rootBinding;

  for (let i = 1; i < path.length; i += 1) {
    if (!isStructValue(current)) {
      return invalidPointer(input, "Field access requires a struct value.");
    }

    const fieldVal = current.fields.get(path[i]);

    if (!fieldVal) {
      return undefinedVariable(input, path[i]);
    }

    current = fieldVal;
  }

  return ok(current);
}

function evaluateExpression(
  input: string,
  scope: Scope,
): Result<BoundValue, TuffError> {
  const trimmed = input.trim();

  const ifExpression = parseIfExpression(trimmed);

  if (!ifExpression.ok) {
    return ifExpression;
  }

  if (ifExpression.value) {
    const condition = evaluateExpression(ifExpression.value.condition, scope);

    if (!condition.ok) {
      return condition;
    }

    if (!isBoolValue(condition.value)) {
      return invalidPointer(input, "If condition must evaluate to Bool.");
    }

    const selectedBranch = condition.value.value
      ? ifExpression.value.thenBranch
      : ifExpression.value.elseBranch;
    const otherBranch = condition.value.value
      ? ifExpression.value.elseBranch
      : ifExpression.value.thenBranch;

    const selectedValue = evaluateExpression(selectedBranch, scope);

    if (!selectedValue.ok) {
      return selectedValue;
    }

    const typeCheckScope = cloneScope(scope);
    const otherValue = evaluateExpression(otherBranch, typeCheckScope);

    if (
      otherValue.ok &&
      !isTypeMatch(selectedValue.value.type, otherValue.value.type)
    ) {
      return invalidPointer(
        input,
        "If branches must evaluate to the same type.",
      );
    }

    return selectedValue;
  }

  if (isBlockExpressionText(trimmed)) {
    return evaluateBlockExpression(trimmed, scope);
  }

  if (trimmed === "true" || trimmed === "false") {
    return ok(makeBoolValue(trimmed === "true", false));
  }

  if (trimmed.startsWith("!")) {
    const operand = evaluateExpression(trimmed.slice(1), scope);

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
    const left = evaluateExpression(logicalExpression.value.left, scope);

    if (!left.ok) {
      return left;
    }

    const right = evaluateExpression(logicalExpression.value.right, scope);

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

  const comparisonExpression = parseComparisonExpression(trimmed);

  if (!comparisonExpression.ok) {
    return comparisonExpression;
  }

  if (comparisonExpression.value) {
    const left = evaluateExpression(comparisonExpression.value.left, scope);

    if (!left.ok) {
      return left;
    }

    const right = evaluateExpression(comparisonExpression.value.right, scope);

    if (!right.ok) {
      return right;
    }

    const operator = comparisonExpression.value.operator;

    if (operator === "==" || operator === "!=") {
      let result: boolean;

      if (isNumericValue(left.value) && isNumericValue(right.value)) {
        result = left.value.value === right.value.value;
      } else if (isBoolValue(left.value) && isBoolValue(right.value)) {
        result = left.value.value === right.value.value;
      } else if (isPointerValue(left.value) && isPointerValue(right.value)) {
        result =
          left.value.target === right.value.target &&
          left.value.type.target.suffix === right.value.type.target.suffix;
      } else {
        return invalidPointer(
          input,
          "Comparison requires operands of compatible types.",
        );
      }

      return ok(makeBoolValue(operator === "==" ? result : !result, false));
    }

    if (!isNumericValue(left.value) || !isNumericValue(right.value)) {
      return invalidPointer(
        input,
        "Relational comparison requires numeric operands.",
      );
    }

    let result = false;

    if (operator === "<") {
      result = left.value.value < right.value.value;
    } else if (operator === "<=") {
      result = left.value.value <= right.value.value;
    } else if (operator === ">") {
      result = left.value.value > right.value.value;
    } else {
      result = left.value.value >= right.value.value;
    }

    return ok(makeBoolValue(result, false));
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
      scope,
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
    return dereferencePointer(input, trimmed.slice(1), scope);
  }

  const structInst = parseStructInstantiation(trimmed);

  if (structInst !== undefined) {
    const definition = resolveTypeDefinition(scope, structInst.typeName);

    if (!definition) {
      return undefinedType(input, structInst.typeName);
    }

    const expectedNames = definition.fields.map((f) => f.name);
    const providedNames = structInst.fieldPairs.map((p) => p.name);

    const allExpectedProvided = expectedNames.every((n) =>
      providedNames.includes(n),
    );
    const noUnknownFields = providedNames.every((n) =>
      expectedNames.includes(n),
    );

    if (!allExpectedProvided || !noUnknownFields) {
      return unsupportedInput(input);
    }

    const fieldsMap = new Map<string, BoundValue>();

    for (const fieldDef of definition.fields) {
      const pair = structInst.fieldPairs.find((p) => p.name === fieldDef.name)!;
      const evaluated = evaluateExpression(pair.value, scope);

      if (!evaluated.ok) {
        return evaluated;
      }

      if (!isTypeMatch(fieldDef.type, evaluated.value.type)) {
        return invalidPointer(
          input,
          `Field '${fieldDef.name}' type does not match the declared type.`,
        );
      }

      fieldsMap.set(fieldDef.name, {
        ...evaluated.value,
        mutable: fieldDef.mutable,
      } as BoundValue);
    }

    const structType: StructTypeInfo = {
      kind: "struct",
      name: definition.name,
      suffix: definition.name,
    };

    return ok(
      makeStructValue(
        definition.name,
        structType,
        fieldsMap,
        definition,
        false,
      ),
    );
  }

  const fieldAccessPath = parseFieldAccess(trimmed);

  if (fieldAccessPath !== undefined) {
    return resolveFieldChain(fieldAccessPath, input, scope);
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
      return resolveIdentifier(trimmed, input, scope);
    }

    return literal.error.kind === "UnsupportedInput"
      ? unsupportedInput(input)
      : literal;
  }

  const left = evaluateExpression(expression.value.left, scope);

  if (!left.ok) {
    return left;
  }

  const right = evaluateExpression(expression.value.right, scope);

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
  scope: Scope,
): Result<StatementValue, TuffError> {
  const ifStatement = parseIfStatement(statement);

  if (!ifStatement.ok) {
    return ifStatement;
  }

  if (ifStatement.value) {
    const condition = evaluateExpression(ifStatement.value.condition, scope);

    if (!condition.ok) {
      return condition;
    }

    if (!isBoolValue(condition.value)) {
      return invalidPointer(statement, "If condition must evaluate to Bool.");
    }

    const selectedBranch = condition.value.value
      ? ifStatement.value.thenBranch
      : ifStatement.value.elseBranch;

    if (!selectedBranch) {
      return ok(UNIT_VALUE);
    }

    const branchScope = createScope(scope);
    const selectedResult = evaluateStatement(selectedBranch, branchScope);

    if (!selectedResult.ok) {
      return selectedResult;
    }

    return ok(UNIT_VALUE);
  }

  const whileStatement = parseWhileStatement(statement);

  if (!whileStatement.ok) {
    return whileStatement;
  }

  if (whileStatement.value) {
    const ITERATION_LIMIT = 1024;
    let iterations = 0;

    while (iterations < ITERATION_LIMIT) {
      const condition = evaluateExpression(
        whileStatement.value.condition,
        scope,
      );

      if (!condition.ok) {
        return condition;
      }

      if (!isBoolValue(condition.value)) {
        return invalidPointer(
          statement,
          "While condition must evaluate to Bool.",
        );
      }

      if (!condition.value.value) {
        break;
      }

      const bodyScope = createScope(scope);
      const bodyResult = evaluateStatement(
        whileStatement.value.body,
        bodyScope,
      );

      if (!bodyResult.ok) {
        return bodyResult;
      }

      iterations += 1;
    }

    if (iterations >= ITERATION_LIMIT) {
      return iterationLimit(statement);
    }

    return ok(UNIT_VALUE);
  }

  const structDefinition = parseStructDefinitionStatement(statement);

  if (!structDefinition.ok) {
    return structDefinition;
  }

  if (structDefinition.value) {
    scope.typeDefinitions.set(
      structDefinition.value.name,
      structDefinition.value,
    );
    return ok(UNIT_VALUE);
  }

  const letStatement = parseLetStatement(statement);

  if (letStatement.ok) {
    const initializer = evaluateExpression(
      letStatement.value.initializer,
      scope,
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
        scope,
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
        scope,
      );
    }

    if (inferredType.kind === "struct") {
      if (!isStructValue(initializer.value)) {
        return invalidPointer(
          statement,
          "Initializer type does not match the declared type.",
        );
      }

      if (inferredType.name !== initializer.value.typeName) {
        return invalidPointer(
          statement,
          "Initializer type does not match the declared type.",
        );
      }

      return bindValue(
        letStatement.value.name,
        makeStructValue(
          initializer.value.typeName,
          initializer.value.type,
          initializer.value.fields,
          initializer.value.definition,
          letStatement.value.mutable,
        ),
        scope,
      );
    }

    const pointerInitializer = initializer.value;
    if (!isPointerValue(pointerInitializer)) {
      return invalidPointer(
        statement,
        "Initializer type does not match the declared type.",
      );
    }

    const pointerInferredType = inferredType as PointerTypeInfo;

    if (
      pointerInferredType.target.suffix !==
      pointerInitializer.type.target.suffix
    ) {
      return invalidPointer(
        statement,
        "Initializer type does not match the declared type.",
      );
    }

    const boundValue: PointerValue = {
      kind: "pointer",
      value: pointerInitializer.value,
      type: pointerInferredType,
      mutable: letStatement.value.mutable,
      target: pointerInitializer.target,
    };

    return bindValue(letStatement.value.name, boundValue, scope);
  }

  if (statement.trim().startsWith("let")) {
    return letStatement;
  }

  const fieldAssignment = parseFieldAssignmentStatement(statement);

  if (fieldAssignment !== undefined) {
    const bindingName = fieldAssignment.path[0];
    const rootBinding = resolveScopeBinding(scope, bindingName);

    if (!rootBinding) {
      return undefinedVariable(statement, bindingName);
    }

    if (!isStructValue(rootBinding)) {
      return invalidPointer(
        statement,
        "Field assignment requires a struct binding.",
      );
    }

    if (!rootBinding.mutable) {
      return immutableVariable(statement, bindingName);
    }

    const fieldName = fieldAssignment.path[fieldAssignment.path.length - 1];
    let parentStruct: StructValue = rootBinding;

    if (fieldAssignment.path.length > 2) {
      const parentPath = fieldAssignment.path.slice(
        0,
        fieldAssignment.path.length - 1,
      );
      const parentResult = resolveFieldChain(parentPath, statement, scope);

      if (!parentResult.ok) {
        return parentResult;
      }

      if (!isStructValue(parentResult.value)) {
        return invalidPointer(
          statement,
          "Field assignment requires a struct value.",
        );
      }

      parentStruct = parentResult.value;
    }

    const fieldValue = parentStruct.fields.get(fieldName);

    if (!fieldValue) {
      return undefinedVariable(statement, fieldName);
    }

    if (!fieldValue.mutable) {
      return immutableVariable(statement, fieldName);
    }

    const rhsResult = evaluateExpression(fieldAssignment.rhs, scope);

    if (!rhsResult.ok) {
      return rhsResult;
    }

    const op = fieldAssignment.operator;
    let newFieldValue: BoundValue;

    if (op === "") {
      newFieldValue = {
        ...fieldValue,
        value: (rhsResult.value as NumericValue).value,
      } as BoundValue;

      if (!isNumericValue(fieldValue) && !isBoolValue(fieldValue)) {
        return invalidPointer(
          statement,
          "Field assignment only supports numeric and Bool fields.",
        );
      }

      if (isBoolValue(fieldValue)) {
        if (!isBoolValue(rhsResult.value)) {
          return invalidPointer(
            statement,
            "Assigned value type does not match field type.",
          );
        }

        newFieldValue = makeBoolValue(
          rhsResult.value.value,
          fieldValue.mutable,
        );
      } else {
        if (!isNumericValue(rhsResult.value)) {
          return invalidPointer(
            statement,
            "Assigned value type does not match field type.",
          );
        }

        if (
          rhsResult.value.value < (fieldValue as NumericValue).type.min ||
          rhsResult.value.value > (fieldValue as NumericValue).type.max
        ) {
          return outOfBounds(
            statement,
            (fieldValue as NumericValue).type.suffix,
          );
        }

        newFieldValue = makeNumericValue(
          rhsResult.value.value,
          (fieldValue as NumericValue).type,
          fieldValue.mutable,
        );
      }
    } else {
      if (!isNumericValue(fieldValue) || !isNumericValue(rhsResult.value)) {
        return invalidPointer(
          statement,
          "Compound field assignment requires numeric operands.",
        );
      }

      let computed: bigint;

      if (op === "+") {
        computed = fieldValue.value + rhsResult.value.value;
      } else if (op === "-") {
        computed = fieldValue.value - rhsResult.value.value;
      } else if (op === "*") {
        computed = fieldValue.value * rhsResult.value.value;
      } else {
        if (rhsResult.value.value === 0n) {
          return divisionByZero(statement);
        }

        computed = fieldValue.value / rhsResult.value.value;
      }

      if (computed < fieldValue.type.min || computed > fieldValue.type.max) {
        return outOfBounds(statement, fieldValue.type.suffix);
      }

      newFieldValue = makeNumericValue(
        computed,
        fieldValue.type,
        fieldValue.mutable,
      );
    }

    parentStruct.fields.set(fieldName, newFieldValue);
    return ok(newFieldValue);
  }

  const compoundAssignment = parseCompoundAssignmentStatement(statement);

  if (compoundAssignment.ok) {
    const existing = resolveScopeBinding(scope, compoundAssignment.value.name);

    if (!existing) {
      return undefinedVariable(statement, compoundAssignment.value.name);
    }

    if (!existing.mutable) {
      return immutableVariable(statement, compoundAssignment.value.name);
    }

    const rhs = evaluateExpression(compoundAssignment.value.value, scope);

    if (!rhs.ok) {
      return rhs;
    }

    const op = compoundAssignment.value.operator;

    if (op === "&&" || op === "||") {
      if (!isBoolValue(existing) || !isBoolValue(rhs.value)) {
        return invalidPointer(
          statement,
          "Logical compound assignment requires Bool operands.",
        );
      }

      const newVal = makeBoolValue(
        op === "&&"
          ? existing.value && rhs.value.value
          : existing.value || rhs.value.value,
        existing.mutable,
      );

      assignScopeBinding(scope, compoundAssignment.value.name, newVal);
      return ok(newVal);
    }

    if (!isNumericValue(existing) || !isNumericValue(rhs.value)) {
      return invalidPointer(
        statement,
        "Arithmetic compound assignment requires numeric operands.",
      );
    }

    let computed: bigint;

    if (op === "+") {
      computed = existing.value + rhs.value.value;
    } else if (op === "-") {
      computed = existing.value - rhs.value.value;
    } else if (op === "*") {
      computed = existing.value * rhs.value.value;
    } else {
      computed = existing.value / rhs.value.value;
    }

    if (computed < existing.type.min || computed > existing.type.max) {
      return outOfBounds(statement, existing.type.suffix);
    }

    const updatedVal = makeNumericValue(
      computed,
      existing.type,
      existing.mutable,
    );
    assignScopeBinding(scope, compoundAssignment.value.name, updatedVal);
    return ok(updatedVal);
  }

  const assignmentStatement = parseAssignmentStatement(statement);

  if (assignmentStatement.ok) {
    const existing = resolveScopeBinding(scope, assignmentStatement.value.name);

    if (!existing) {
      return undefinedVariable(statement, assignmentStatement.value.name);
    }

    if (!existing.mutable) {
      return immutableVariable(statement, assignmentStatement.value.name);
    }

    const assigned = evaluateExpression(assignmentStatement.value.value, scope);

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

      const updatedValue = makeNumericValue(
        assigned.value.value,
        existing.type,
        existing.mutable,
      );

      assignScopeBinding(scope, assignmentStatement.value.name, updatedValue);
      return ok(updatedValue);
    }

    if (existing.type.kind === "bool") {
      if (!isBoolValue(assigned.value)) {
        return invalidPointer(
          statement,
          "Assigned value type does not match the variable type.",
        );
      }

      const updatedValue = makeBoolValue(
        assigned.value.value,
        existing.mutable,
      );

      assignScopeBinding(scope, assignmentStatement.value.name, updatedValue);
      return ok(updatedValue);
    }

    if (!isPointerValue(assigned.value)) {
      return invalidPointer(
        statement,
        "Assigned value type does not match the variable type.",
      );
    }

    const pointerAssigned = assigned.value;
    const existingPointerType = existing.type as PointerTypeInfo;

    if (existingPointerType.mutable && !assigned.value.type.mutable) {
      return invalidPointer(
        statement,
        "Cannot assign immutable pointer to mutable pointer binding.",
      );
    }

    if (
      existingPointerType.target.suffix !== pointerAssigned.type.target.suffix
    ) {
      return invalidPointer(
        statement,
        "Assigned value type does not match the variable type.",
      );
    }

    const updatedValue: PointerValue = {
      kind: "pointer",
      value: pointerAssigned.value,
      type: existingPointerType,
      mutable: existing.mutable,
      target: pointerAssigned.target,
    };

    assignScopeBinding(scope, assignmentStatement.value.name, updatedValue);
    return ok(updatedValue);
  }

  const anyDerefAssignment = parseAnyDereferenceAssignment(statement);

  if (anyDerefAssignment.ok) {
    const ctx = validateMutableDerefTarget(
      statement,
      anyDerefAssignment.value.pointerName,
      scope,
    );

    if (!ctx.ok) {
      return ctx;
    }

    const { pointerVar, targetVar } = ctx.value;

    const rhs = evaluateExpression(anyDerefAssignment.value.value, scope);

    if (!rhs.ok) {
      return rhs;
    }

    if (!isNumericValue(rhs.value)) {
      return invalidPointer(
        statement,
        "Cannot assign non-numeric value through pointer.",
      );
    }

    const op = anyDerefAssignment.value.operator;
    let computed: bigint;

    if (op === "") {
      computed = rhs.value.value;
    } else if (op === "+") {
      computed = targetVar.value + rhs.value.value;
    } else if (op === "-") {
      computed = targetVar.value - rhs.value.value;
    } else if (op === "*") {
      computed = targetVar.value * rhs.value.value;
    } else {
      computed = targetVar.value / rhs.value.value;
    }

    if (computed < targetVar.type.min || computed > targetVar.type.max) {
      return outOfBounds(statement, targetVar.type.suffix);
    }

    const updatedTarget = makeNumericValue(computed, targetVar.type, true);
    assignScopeBinding(scope, pointerVar.target, updatedTarget);
    return ok(updatedTarget);
  }

  return evaluateExpression(statement, scope);
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

  if (!statements.ok) {
    return statements;
  }

  if (statements.value.length === 0) {
    return unsupportedInput(input);
  }

  const rootScope = createScope(undefined);
  let lastValue: StatementValue | undefined;

  for (const statement of statements.value) {
    const evaluated = evaluateStatement(statement, rootScope);

    if (!evaluated.ok) {
      return evaluated;
    }

    lastValue = evaluated.value;
  }

  if (!lastValue || lastValue.kind !== "numeric") {
    if (lastValue && lastValue.kind === "unit") {
      return ok(0);
    }

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
