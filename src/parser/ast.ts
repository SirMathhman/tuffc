export interface NodeBase {
  kind: string;
  line: number;
  column: number;
}

export interface Program extends NodeBase {
  kind: "Program";
  functions: FunctionDeclaration[];
}

export interface FunctionDeclaration extends NodeBase {
  kind: "FunctionDeclaration";
  name: string;
  parameters: Parameter[];
  returnType?: TypeAnnotation;
  body: Expression;
}

export interface Parameter extends NodeBase {
  kind: "Parameter";
  name: string;
  typeAnnotation: TypeAnnotation;
}

export interface TypeAnnotation extends NodeBase {
  kind: "TypeAnnotation";
  name: string;
}

export interface BlockExpression extends NodeBase {
  kind: "BlockExpression";
  statements: Statement[];
  value?: Expression;
}

export interface IfExpression extends NodeBase {
  kind: "IfExpression";
  condition: Expression;
  thenBranch: BlockExpression;
  elseBranch?: Expression;
}

export interface WhileExpression extends NodeBase {
  kind: "WhileExpression";
  condition: Expression;
  body: BlockExpression;
}

export interface AssignmentExpression extends NodeBase {
  kind: "AssignmentExpression";
  target: IdentifierExpression;
  operator: AssignOperator;
  value: Expression;
}

export interface BinaryExpression extends NodeBase {
  kind: "BinaryExpression";
  left: Expression;
  operator: BinaryOperator;
  right: Expression;
}

export interface UnaryExpression extends NodeBase {
  kind: "UnaryExpression";
  operator: UnaryOperator;
  operand: Expression;
}

export interface CallExpression extends NodeBase {
  kind: "CallExpression";
  callee: Expression;
  arguments: Expression[];
}

export interface IdentifierExpression extends NodeBase {
  kind: "IdentifierExpression";
  name: string;
}

export interface IntegerLiteralExpression extends NodeBase {
  kind: "IntegerLiteralExpression";
  value: number;
}

export interface FloatLiteralExpression extends NodeBase {
  kind: "FloatLiteralExpression";
  value: number;
}

export interface StringLiteralExpression extends NodeBase {
  kind: "StringLiteralExpression";
  value: string;
}

export interface CharLiteralExpression extends NodeBase {
  kind: "CharLiteralExpression";
  value: string;
}

export interface BoolLiteralExpression extends NodeBase {
  kind: "BoolLiteralExpression";
  value: boolean;
}

export interface ExprStatement extends NodeBase {
  kind: "ExprStatement";
  expression: Expression;
}

export interface LetStatement extends NodeBase {
  kind: "LetStatement";
  mutable: boolean;
  name: string;
  typeAnnotation?: TypeAnnotation;
  initializer: Expression;
}

export interface ReturnStatement extends NodeBase {
  kind: "ReturnStatement";
  value?: Expression;
}

export type Statement = ExprStatement | LetStatement | ReturnStatement;
export type Expression =
  | BlockExpression
  | IfExpression
  | WhileExpression
  | AssignmentExpression
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | IdentifierExpression
  | IntegerLiteralExpression
  | FloatLiteralExpression
  | StringLiteralExpression
  | CharLiteralExpression
  | BoolLiteralExpression;

export type BinaryOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "&&"
  | "||";

export type UnaryOperator = "-" | "!";
export type AssignOperator = "=" | "+=" | "-=" | "*=" | "/=" | "%=";

export function createTypeAnnotation(name: string, line: number, column: number): TypeAnnotation {
  return { kind: "TypeAnnotation", name, line, column };
}