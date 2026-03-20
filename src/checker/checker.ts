import { createDiagnostic, type Diagnostic } from "../diagnostics";
import type {
  AssignmentExpression,
  BinaryExpression,
  BlockExpression,
  BoolLiteralExpression,
  CallExpression,
  CharLiteralExpression,
  ExprStatement,
  Expression,
  FloatLiteralExpression,
  FunctionDeclaration,
  IdentifierExpression,
  IfExpression,
  IntegerLiteralExpression,
  LetStatement,
  Program,
  ReturnStatement,
  Statement,
  StringLiteralExpression,
  TypeAnnotation,
  UnaryExpression,
  WhileExpression,
} from "../parser";
import { functionType, primitiveType, type FunctionSymbol, type TuffType, type VariableSymbol, unknownType } from "./types";

export interface CheckResult {
  diagnostics: Diagnostic[];
  functions: Map<string, FunctionSymbol>;
}

interface FunctionContext {
  returnType: TuffType;
  sawReturn: boolean;
}

class Scope {
  private readonly values = new Map<string, VariableSymbol>();

  public constructor(public readonly parent?: Scope) {}

  public declare(name: string, symbol: VariableSymbol): boolean {
    if (this.values.has(name)) {
      return false;
    }

    this.values.set(name, symbol);
    return true;
  }

  public lookup(name: string): VariableSymbol | undefined {
    const local = this.values.get(name);
    if (local !== undefined) {
      return local;
    }

    return this.parent?.lookup(name);
  }
}

export function checkProgram(program: Program): CheckResult {
  return new Checker().checkProgram(program);
}

export function checkSource(program: Program): CheckResult {
  return checkProgram(program);
}

class Checker {
  private readonly diagnostics: Diagnostic[] = [];
  private readonly functions = new Map<string, FunctionSymbol>();
  private readonly globalScope = new Scope();

  public checkProgram(program: Program): CheckResult {
    this.seedBuiltins();
    this.collectFunctionSignatures(program.functions);

    for (const declaration of program.functions) {
      this.checkFunction(declaration);
    }

    return { diagnostics: this.diagnostics, functions: this.functions };
  }

  private seedBuiltins(): void {
    if (this.functions.has("print")) {
      return;
    }

    this.functions.set("print", {
      declarationName: "print",
      type: functionType([primitiveType("Any")], primitiveType("Void")),
    });
  }

  private collectFunctionSignatures(functions: FunctionDeclaration[]): void {
    for (const declaration of functions) {
      if (this.functions.has(declaration.name)) {
        this.diagnostics.push(createDiagnostic(`Duplicate function '${declaration.name}'.`, declaration.line, declaration.column));
        continue;
      }

      const parameters = declaration.parameters.map((parameter) => this.resolveType(parameter.typeAnnotation));
      const returnType = declaration.returnType ? this.resolveType(declaration.returnType) : unknownType;
      this.functions.set(declaration.name, {
        declarationName: declaration.name,
        type: functionType(parameters, returnType),
      });
    }
  }

  private checkFunction(declaration: FunctionDeclaration): void {
    const functionSymbol = this.functions.get(declaration.name);
    if (functionSymbol === undefined) {
      return;
    }

    const scope = new Scope(this.globalScope);
    const context: FunctionContext = {
      returnType: functionSymbol.type.returnType,
      sawReturn: false,
    };

    for (let index = 0; index < declaration.parameters.length; index += 1) {
      const parameter = declaration.parameters[index];
      const parameterType = functionSymbol.type.parameters[index] ?? unknownType;

      if (!scope.declare(parameter.name, { type: parameterType, mutable: false })) {
        this.diagnostics.push(createDiagnostic(`Duplicate parameter '${parameter.name}'.`, parameter.line, parameter.column));
      }
    }

    const bodyType = this.checkExpression(declaration.body, scope, context);

    if (functionSymbol.type.returnType.kind === "UnknownType") {
      functionSymbol.type.returnType = context.sawReturn ? context.returnType : bodyType;
    } else if (!context.sawReturn && !this.isAssignable(bodyType, functionSymbol.type.returnType)) {
      this.diagnostics.push(createDiagnostic(`Function '${declaration.name}' returns ${this.typeToString(bodyType)} but expected ${this.typeToString(functionSymbol.type.returnType)}.`, declaration.line, declaration.column));
    }
  }

  private checkStatement(statement: Statement, scope: Scope, context: FunctionContext): TuffType {
    switch (statement.kind) {
      case "LetStatement":
        return this.checkLetStatement(statement, scope, context);
      case "ReturnStatement":
        return this.checkReturnStatement(statement, scope, context);
      case "ExprStatement":
        this.checkExpression(statement.expression, scope, context);
        return primitiveType("Void");
    }
  }

  private checkLetStatement(statement: LetStatement, scope: Scope, context: FunctionContext): TuffType {
    const initializerType = this.checkExpression(statement.initializer, scope, context);
    const declaredType = statement.typeAnnotation ? this.resolveType(statement.typeAnnotation) : initializerType;

    if (!this.isAssignable(initializerType, declaredType)) {
      this.diagnostics.push(createDiagnostic(`Cannot assign ${this.typeToString(initializerType)} to '${statement.name}' of type ${this.typeToString(declaredType)}.`, statement.line, statement.column));
    }

    if (!scope.declare(statement.name, { type: declaredType, mutable: statement.mutable })) {
      this.diagnostics.push(createDiagnostic(`Duplicate variable '${statement.name}'.`, statement.line, statement.column));
    }

    return declaredType;
  }

  private checkReturnStatement(statement: ReturnStatement, scope: Scope, context: FunctionContext): TuffType {
    const valueType = statement.value ? this.checkExpression(statement.value, scope, context) : primitiveType("Void");

    if (context.returnType.kind === "UnknownType") {
      context.returnType = valueType;
    } else if (!this.isAssignable(valueType, context.returnType)) {
      this.diagnostics.push(createDiagnostic(`Return type ${this.typeToString(valueType)} does not match ${this.typeToString(context.returnType)}.`, statement.line, statement.column));
    }

    context.sawReturn = true;
    return valueType;
  }

  private checkExpression(expression: Expression, scope: Scope, context: FunctionContext): TuffType {
    switch (expression.kind) {
      case "BlockExpression":
        return this.checkBlockExpression(expression, scope, context);
      case "IfExpression":
        return this.checkIfExpression(expression, scope, context);
      case "WhileExpression":
        return this.checkWhileExpression(expression, scope, context);
      case "AssignmentExpression":
        return this.checkAssignmentExpression(expression, scope, context);
      case "BinaryExpression":
        return this.checkBinaryExpression(expression, scope, context);
      case "UnaryExpression":
        return this.checkUnaryExpression(expression, scope, context);
      case "CallExpression":
        return this.checkCallExpression(expression, scope, context);
      case "IdentifierExpression":
        return this.resolveIdentifier(expression, scope);
      case "IntegerLiteralExpression":
        return primitiveType("I32");
      case "FloatLiteralExpression":
        return primitiveType("F64");
      case "StringLiteralExpression":
        return primitiveType("String");
      case "CharLiteralExpression":
        return primitiveType("Char");
      case "BoolLiteralExpression":
        return primitiveType("Bool");
    }
  }

  private checkBlockExpression(expression: BlockExpression, parentScope: Scope, context: FunctionContext): TuffType {
    const scope = new Scope(parentScope);

    for (const statement of expression.statements) {
      this.checkStatement(statement, scope, context);
    }

    return expression.value ? this.checkExpression(expression.value, scope, context) : primitiveType("Void");
  }

  private checkIfExpression(expression: IfExpression, scope: Scope, context: FunctionContext): TuffType {
    this.ensureBoolCondition(expression.condition, scope, context, "If condition");

    const thenType = this.checkExpression(expression.thenBranch, scope, context);
    if (expression.elseBranch === undefined) {
      return primitiveType("Void");
    }

    const elseType = this.checkExpression(expression.elseBranch, scope, context);
    const combined = this.combineTypes(thenType, elseType, expression.line, expression.column);
    return combined ?? elseType;
  }

  private checkWhileExpression(expression: WhileExpression, scope: Scope, context: FunctionContext): TuffType {
    this.ensureBoolCondition(expression.condition, scope, context, "While condition");

    this.checkExpression(expression.body, scope, context);
    return primitiveType("Void");
  }

  private checkAssignmentExpression(expression: AssignmentExpression, scope: Scope, context: FunctionContext): TuffType {
    const symbol = scope.lookup(expression.target.name);

    if (symbol === undefined) {
      this.diagnostics.push(createDiagnostic(`Unknown variable '${expression.target.name}'.`, expression.line, expression.column));
      return unknownType;
    }

    if (!symbol.mutable && expression.operator !== "=") {
      this.diagnostics.push(createDiagnostic(`Variable '${expression.target.name}' is immutable.`, expression.line, expression.column));
    }

    const valueType = this.checkExpression(expression.value, scope, context);

    if (!this.isAssignable(valueType, symbol.type)) {
      this.diagnostics.push(createDiagnostic(`Cannot assign ${this.typeToString(valueType)} to ${this.typeToString(symbol.type)}.`, expression.line, expression.column));
    }

    return symbol.type;
  }

  private checkBinaryExpression(expression: BinaryExpression, scope: Scope, context: FunctionContext): TuffType {
    const leftType = this.checkExpression(expression.left, scope, context);
    const rightType = this.checkExpression(expression.right, scope, context);

    if (expression.operator === "&&" || expression.operator === "||") {
      if (!this.isAssignable(leftType, primitiveType("Bool")) || !this.isAssignable(rightType, primitiveType("Bool"))) {
        this.diagnostics.push(createDiagnostic(`Logical operator '${expression.operator}' requires Bool operands.`, expression.line, expression.column));
      }

      return primitiveType("Bool");
    }

    if (expression.operator === "==" || expression.operator === "!=") {
      if (!this.isAssignable(leftType, rightType) && !this.isAssignable(rightType, leftType)) {
        this.diagnostics.push(createDiagnostic(`Cannot compare ${this.typeToString(leftType)} and ${this.typeToString(rightType)}.`, expression.line, expression.column));
      }

      return primitiveType("Bool");
    }

    if (expression.operator === "<" || expression.operator === "<=" || expression.operator === ">" || expression.operator === ">=") {
      if (!this.requireNumericOperands(leftType, rightType, expression.line, expression.column, `Comparison operator '${expression.operator}'`)) {
        return primitiveType("Bool");
      }

      return primitiveType("Bool");
    }

    if (!this.requireNumericOperands(leftType, rightType, expression.line, expression.column, `Arithmetic operator '${expression.operator}'`)) {
      return unknownType;
    }

    return this.combineNumericTypes(leftType, rightType);
  }

  private checkUnaryExpression(expression: UnaryExpression, scope: Scope, context: FunctionContext): TuffType {
    const operandType = this.checkExpression(expression.operand, scope, context);

    if (expression.operator === "!") {
      if (!this.isAssignable(operandType, primitiveType("Bool"))) {
        this.diagnostics.push(createDiagnostic(`Logical not requires Bool, not ${this.typeToString(operandType)}.`, expression.line, expression.column));
      }

      return primitiveType("Bool");
    }

    if (!this.isNumeric(operandType)) {
      this.diagnostics.push(createDiagnostic(`Negation requires a numeric operand, not ${this.typeToString(operandType)}.`, expression.line, expression.column));
      return unknownType;
    }

    return operandType;
  }

  private checkCallExpression(expression: CallExpression, scope: Scope, context: FunctionContext): TuffType {
    if (expression.callee.kind !== "IdentifierExpression") {
      this.diagnostics.push(createDiagnostic("Only named functions can be called in Stage 0.", expression.line, expression.column));
      return unknownType;
    }

    if (expression.callee.name === "print") {
      for (const arg of expression.arguments) {
        this.checkExpression(arg, scope, context);
      }

      return primitiveType("Void");
    }

    const functionSymbol = this.functions.get(expression.callee.name);
    if (functionSymbol === undefined) {
      this.diagnostics.push(createDiagnostic(`Unknown function '${expression.callee.name}'.`, expression.line, expression.column));
      return unknownType;
    }

    const { parameters, returnType } = functionSymbol.type;
    if (expression.arguments.length !== parameters.length) {
      this.diagnostics.push(createDiagnostic(`Function '${expression.callee.name}' expects ${parameters.length} arguments but got ${expression.arguments.length}.`, expression.line, expression.column));
    }

    for (let index = 0; index < expression.arguments.length; index += 1) {
      const argType = this.checkExpression(expression.arguments[index], scope, context);
      const paramType = parameters[index] ?? unknownType;

      if (!this.isAssignable(argType, paramType)) {
        this.diagnostics.push(createDiagnostic(`Argument ${index + 1} of '${expression.callee.name}' must be ${this.typeToString(paramType)}, not ${this.typeToString(argType)}.`, expression.arguments[index].line, expression.arguments[index].column));
      }
    }

    return returnType;
  }

  private resolveIdentifier(expression: IdentifierExpression, scope: Scope): TuffType {
    const symbol = scope.lookup(expression.name);
    if (symbol !== undefined) {
      return symbol.type;
    }

    if (this.functions.has(expression.name)) {
      return this.functions.get(expression.name)?.type ?? unknownType;
    }

    this.diagnostics.push(createDiagnostic(`Unknown identifier '${expression.name}'.`, expression.line, expression.column));
    return unknownType;
  }

  private resolveType(annotation: TypeAnnotation): TuffType {
    switch (annotation.name) {
      case "I32":
      case "F64":
      case "Bool":
      case "String":
      case "Char":
      case "Void":
      case "Any":
        return primitiveType(annotation.name);
      default:
        this.diagnostics.push(createDiagnostic(`Unknown type '${annotation.name}'.`, annotation.line, annotation.column));
        return unknownType;
    }
  }

  private combineTypes(left: TuffType, right: TuffType, line: number, column: number): TuffType | undefined {
    if (this.isAssignable(left, right)) {
      return right;
    }

    if (this.isAssignable(right, left)) {
      return left;
    }

    this.diagnostics.push(createDiagnostic(`Branch types do not match: ${this.typeToString(left)} vs ${this.typeToString(right)}.`, line, column));
    return undefined;
  }

  private combineNumericTypes(left: TuffType, right: TuffType): TuffType {
    if (this.isTypeName(left, "F64") || this.isTypeName(right, "F64")) {
      return primitiveType("F64");
    }

    return primitiveType("I32");
  }

  private ensureBoolCondition(expression: Expression, scope: Scope, context: FunctionContext, label: string): void {
    const conditionType = this.checkExpression(expression, scope, context);

    if (!this.isAssignable(conditionType, primitiveType("Bool"))) {
      this.diagnostics.push(createDiagnostic(`${label} must be Bool, not ${this.typeToString(conditionType)}.`, expression.line, expression.column));
    }
  }

  private requireNumericOperands(left: TuffType, right: TuffType, line: number, column: number, label: string): boolean {
    if (this.isNumeric(left) && this.isNumeric(right)) {
      return true;
    }

    this.diagnostics.push(createDiagnostic(`${label} requires numeric operands.`, line, column));
    return false;
  }

  private isAssignable(source: TuffType, target: TuffType): boolean {
    if (source.kind === "UnknownType" || target.kind === "UnknownType") {
      return true;
    }

    if (this.isTypeName(target, "Any") || this.isTypeName(source, "Any")) {
      return true;
    }

    if (source.kind === "PrimitiveType" && target.kind === "PrimitiveType") {
      if (source.name === target.name) {
        return true;
      }

      return source.name === "I32" && target.name === "F64";
    }

    if (source.kind === "FunctionType" && target.kind === "FunctionType") {
      if (source.parameters.length !== target.parameters.length) {
        return false;
      }

      for (let index = 0; index < source.parameters.length; index += 1) {
        if (!this.isAssignable(source.parameters[index], target.parameters[index])) {
          return false;
        }
      }

      return this.isAssignable(source.returnType, target.returnType);
    }

    return false;
  }

  private isNumeric(type: TuffType): boolean {
    return this.isTypeName(type, "I32") || this.isTypeName(type, "F64");
  }

  private isTypeName(type: TuffType, name: PrimitiveType["name"]): boolean {
    return type.kind === "PrimitiveType" && type.name === name;
  }

  private typeToString(type: TuffType): string {
    switch (type.kind) {
      case "PrimitiveType":
        return type.name;
      case "FunctionType":
        return "function";
      case "UnknownType":
        return "unknown";
    }
  }
}