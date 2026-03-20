export type TuffType = PrimitiveType | FunctionType | UnknownType;

export interface PrimitiveType {
  kind: "PrimitiveType";
  name: "I32" | "F64" | "Bool" | "String" | "Char" | "Void" | "Any";
}

export interface FunctionType {
  kind: "FunctionType";
  parameters: TuffType[];
  returnType: TuffType;
}

export interface UnknownType {
  kind: "UnknownType";
}

export interface VariableSymbol {
  type: TuffType;
  mutable: boolean;
}

export interface FunctionSymbol {
  declarationName: string;
  type: FunctionType;
}

export const unknownType: UnknownType = { kind: "UnknownType" };

export function primitiveType(name: PrimitiveType["name"]): PrimitiveType {
  return { kind: "PrimitiveType", name };
}

export function functionType(parameters: TuffType[], returnType: TuffType): FunctionType {
  return { kind: "FunctionType", parameters, returnType };
}