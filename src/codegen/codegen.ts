import type * as Ast from "../parser";
import type * as Checker from "../checker";

export function generateProgram(program: Ast.Program, functions: Map<string, Checker.FunctionSymbol>): string {
  return new CodeGenerator(functions).generateProgram(program);
}

class CodeGenerator {
  public constructor(private readonly functions: Map<string, Checker.FunctionSymbol>) {}

  public generateProgram(program: Ast.Program): string {
    const chunks = program.functions.map((declaration) => this.emitFunction(declaration));

    if (this.functions.has("main")) {
      chunks.push("main();");
    }

    return chunks.join("\n\n");
  }

  private emitFunction(declaration: Ast.FunctionDeclaration): string {
    const signature = this.functions.get(declaration.name);
    const parameters = declaration.parameters
      .map((parameter, index) => {
        const parameterType = signature?.type.parameters[index] ?? this.resolveAnnotation(parameter.typeAnnotation.name);
        return `${parameter.name}: ${this.emitType(parameterType)}`;
      })
      .join(", ");

    const returnType = this.emitType(signature?.type.returnType ?? this.resolveAnnotation(declaration.returnType?.name ?? "Any"));
    const body = this.emitExpressionAsReturn(declaration.body, 1, returnType);

    return `function ${declaration.name}(${parameters}): ${returnType} {\n${body}\n}`;
  }

  private emitExpressionAsReturn(expression: Ast.Expression, indentLevel: number, returnType: string): string {
    const indent = this.indent(indentLevel);

    if (expression.kind === "BlockExpression") {
      const lines = this.emitBlockContents(expression, indentLevel, true);
      return lines.length > 0 ? lines.join("\n") : `${indent}return ${returnType === "void" ? "undefined" : "undefined as any"};`;
    }

    return `${indent}return ${this.emitExpression(expression, indentLevel)};`;
  }

  private emitBlockContents(block: Ast.BlockExpression, indentLevel: number, returnValue: boolean): string[] {
    const lines: string[] = [];

    for (const statement of block.statements) {
      lines.push(this.emitStatement(statement, indentLevel));
    }

    if (block.value !== undefined) {
      const expression = this.emitExpression(block.value, indentLevel);
      lines.push(`${this.indent(indentLevel)}${returnValue ? "return" : ""}${returnValue ? " " : ""}${expression}${returnValue ? ";" : ";"}`);
    } else if (returnValue) {
      lines.push(`${this.indent(indentLevel)}return undefined;`);
    }

    return lines;
  }

  private emitStatement(statement: Ast.LetStatement | Ast.ReturnStatement | Ast.ExprStatement, indentLevel: number): string {
    const indent = this.indent(indentLevel);

    switch (statement.kind) {
      case "LetStatement":
        return `${indent}${statement.mutable ? "let" : "const"} ${statement.name} = ${this.emitExpression(statement.initializer, indentLevel)};`;
      case "ReturnStatement":
        return statement.value === undefined ? `${indent}return;` : `${indent}return ${this.emitExpression(statement.value, indentLevel)};`;
      case "ExprStatement":
        return `${indent}${this.emitExpression(statement.expression, indentLevel)};`;
    }
  }

  private emitExpression(expression: Ast.Expression, indentLevel: number): string {
    switch (expression.kind) {
      case "BlockExpression":
        return this.emitBlockExpression(expression, indentLevel);
      case "IfExpression":
        return this.emitIfExpression(expression, indentLevel);
      case "WhileExpression":
        return this.emitWhileExpression(expression, indentLevel);
      case "AssignmentExpression":
        return this.emitAssignmentExpression(expression, indentLevel);
      case "BinaryExpression":
        return `(${this.emitExpression(expression.left, indentLevel)} ${expression.operator} ${this.emitExpression(expression.right, indentLevel)})`;
      case "UnaryExpression":
        return `(${expression.operator}${this.emitExpression(expression.operand, indentLevel)})`;
      case "CallExpression":
        return this.emitCallExpression(expression, indentLevel);
      case "IdentifierExpression":
        return expression.name;
      case "IntegerLiteralExpression":
        return this.emitNumberLiteral(expression);
      case "FloatLiteralExpression":
        return this.emitNumberLiteral(expression);
      case "StringLiteralExpression":
      case "CharLiteralExpression":
        return JSON.stringify(expression.value);
      case "BoolLiteralExpression":
        return expression.value ? "true" : "false";
    }
  }

  private emitBlockExpression(expression: Ast.BlockExpression, indentLevel: number): string {
    const inner = this.emitBlockContents(expression, indentLevel + 1, true);
    return ["(() => {", ...inner, `${this.indent(indentLevel)}})()`].join("\n");
  }

  private emitIfExpression(expression: Ast.IfExpression, indentLevel: number): string {
    const indent = this.indent(indentLevel);
    const condition = this.emitExpression(expression.condition, indentLevel);
    const thenBranch = this.emitExpression(expression.thenBranch, indentLevel + 1);
    const elseBranch = expression.elseBranch === undefined ? "undefined" : this.emitExpression(expression.elseBranch, indentLevel + 1);

    return [
      "(() => {",
      `${this.indent(indentLevel + 1)}if (${condition}) {`,
      `${this.indent(indentLevel + 2)}return ${thenBranch};`,
      `${this.indent(indentLevel + 1)}} else {`,
      `${this.indent(indentLevel + 2)}return ${elseBranch};`,
      `${this.indent(indentLevel + 1)}}`,
      `${indent}})()`,
    ].join("\n");
  }

  private emitWhileExpression(expression: Ast.WhileExpression, indentLevel: number): string {
    const condition = this.emitExpression(expression.condition, indentLevel);
    const body = this.emitBlockContents(expression.body, indentLevel + 2, false);
    const bodyLines = body.length > 0 ? body : [`${this.indent(indentLevel + 2)};`];

    return [
      "(() => {",
      `${this.indent(indentLevel + 1)}while (${condition}) {`,
      ...bodyLines,
      `${this.indent(indentLevel + 1)}}`,
      `${this.indent(indentLevel)}return undefined;`,
      `${this.indent(indentLevel)}})()`,
    ].join("\n");
  }

  private emitAssignmentExpression(expression: Ast.AssignmentExpression, indentLevel: number): string {
    return `${expression.target.name} ${expression.operator} ${this.emitExpression(expression.value, indentLevel)}`;
  }

  private emitCallExpression(expression: Ast.CallExpression, indentLevel: number): string {
    if (expression.callee.kind === "IdentifierExpression" && expression.callee.name === "print") {
      return `console.log(${expression.arguments.map((arg) => this.emitExpression(arg, indentLevel)).join(", ")})`;
    }

    return `${this.emitExpression(expression.callee, indentLevel)}(${expression.arguments.map((arg) => this.emitExpression(arg, indentLevel)).join(", ")})`;
  }

  private emitNumberLiteral(expression: Ast.IntegerLiteralExpression | Ast.FloatLiteralExpression): string {
    return Number.isFinite(expression.value) ? String(expression.value) : "0";
  }

  private emitType(type: Checker.TuffType): string {
    switch (type.kind) {
      case "PrimitiveType":
        switch (type.name) {
          case "I32":
          case "F64":
            return "number";
          case "Bool":
            return "boolean";
          case "String":
          case "Char":
            return "string";
          case "Void":
            return "void";
          case "Any":
            return "any";
        }
      case "FunctionType":
        return `(${type.parameters.map((parameter) => this.emitType(parameter)).join(", ")}) => ${this.emitType(type.returnType)}`;
      case "UnknownType":
        return "any";
    }
  }

  private resolveAnnotation(name: string): Checker.TuffType {
    switch (name) {
      case "I32":
      case "F64":
      case "Bool":
      case "String":
      case "Char":
      case "Void":
      case "Any":
        return { kind: "PrimitiveType", name };
      default:
        return { kind: "UnknownType" };
    }
  }

  private indent(level: number): string {
    return "  ".repeat(level);
  }
}