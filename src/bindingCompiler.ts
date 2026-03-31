/**
 * Parser and compiler for variable binding expressions.
 * Handles: let x : Type = expr; ... final_expr
 */

import type { IntegerType } from "./compileTuffToTS";
import { compileReadExpressionCore } from "./typeUtils";

export interface Variable {
  name: string;
  type: IntegerType;
}

interface BindingInfo {
  type: IntegerType;
  mutable: boolean;
  compiledName: string;
}

const TYPE_BIT_WIDTHS: Record<IntegerType, number> = {
  U8: 8,
  U16: 16,
  U32: 32,
  U64: 64,
  I8: 8,
  I16: 16,
  I32: 32,
  I64: 64,
};

const SIGNED_TYPES = new Set<IntegerType>(["I8", "I16", "I32", "I64"]);

export function isAssignableTo(
  fromType: IntegerType,
  toType: IntegerType,
): boolean {
  const fromSigned = SIGNED_TYPES.has(fromType);
  const toSigned = SIGNED_TYPES.has(toType);

  if (fromSigned !== toSigned) {
    return false;
  }

  const fromWidth = TYPE_BIT_WIDTHS[fromType];
  const toWidth = TYPE_BIT_WIDTHS[toType];
  return fromWidth <= toWidth;
}

function parseLiteralType(expr: string): IntegerType | undefined {
  const match = /^\d+(U8|U16|U32|U64|I8|I16|I32|I64)$/.exec(expr);
  return match?.[1] as IntegerType | undefined;
}

function parseReadType(expr: string): IntegerType | undefined {
  const match = /^read<(U8|U16|U32|U64|I8|I16|I32|I64)>\(\)$/.exec(expr);
  return match?.[1] as IntegerType | undefined;
}

function getBindingOrThrow(
  scope: Map<string, BindingInfo>,
  name: string,
): BindingInfo {
  const binding = scope.get(name);
  if (!binding) {
    throw new Error(`Undefined variable: ${name}`);
  }
  return binding;
}

function assertAssignable(
  fromType: IntegerType,
  toType: IntegerType,
  context: string,
): void {
  if (!isAssignableTo(fromType, toType)) {
    throw new Error(`Type mismatch: ${fromType} is not assignable to ${toType} in ${context}`);
  }
}

export function compileVariableBinding(source: string): {
  code: string;
  resultVar: string;
} {
  const scope = new Map<string, BindingInfo>();
  const helperCode = [
    "// Helper functions for read<T>() support",
    "const __readU8 = (): number => (__tuff_stdin[__tuff_stdin_offset++] & 0xff);",
    "const __readUnsignedLE = (byteCount: number): bigint => {",
    "  let value = 0n;",
    "  for (let i = 0; i < byteCount; i += 1) {",
    "    value |= BigInt(__readU8()) << BigInt(i * 8);",
    "  }",
    "  return value;",
    "};",
    "const __toSigned = (value: bigint, bits: number): bigint => {",
    "  const full = 1n << BigInt(bits);",
    "  const signBit = 1n << BigInt(bits - 1);",
    "  return (value & signBit) !== 0n ? value - full : value;",
    "};",
  ];

  const bodyStatements: string[] = [];
  let bindingCounter = 0;

  const parts = source.split(";");
  const trimmedParts = parts.map((p) => p.trim()).filter((p) => p.length > 0);

  if (trimmedParts.length === 0) {
    throw new Error("Empty variable binding program");
  }

  const finalExpr = trimmedParts[trimmedParts.length - 1];
  const statements = trimmedParts.slice(0, -1);

  for (const statement of statements) {
    const letMatch =
      /^let\s+(mut\s+)?(\w+)\s*:\s*(U8|U16|U32|U64|I8|I16|I32|I64)\s*=\s*(.+)$/.exec(
        statement,
      );

    if (letMatch) {
      const [, mutToken, name, typeStr, expr] = letMatch;
      const type = typeStr as IntegerType;
      const mutable = typeof mutToken === "string";

      const exprType = inferExpressionType(expr, scope);
      assertAssignable(exprType, type, `binding "${name}"`);

      const compiledExpr = compileExpression(expr, scope);
      const compiledName = `__tuff_${name}_${bindingCounter}`;
      bindingCounter += 1;

      bodyStatements.push(`let ${compiledName}: number | bigint = ${compiledExpr};`);
      scope.set(name, { type, mutable, compiledName });
      continue;
    }

    const assignmentMatch = /^(\w+)\s*=\s*(.+)$/.exec(statement);
    if (assignmentMatch) {
      const [, name, expr] = assignmentMatch;
      const binding = getBindingOrThrow(scope, name);
      if (!binding.mutable) {
        throw new Error(`Cannot reassign immutable variable: ${name}`);
      }

      const exprType = inferExpressionType(expr, scope);
      assertAssignable(exprType, binding.type, `assignment "${name}"`);

      bodyStatements.push(`${binding.compiledName} = ${compileExpression(expr, scope)};`);
      continue;
    }

    throw new Error(`Invalid variable binding syntax: ${statement}`);
  }

  bodyStatements.push(
    `const __tuff_result: number | bigint = ${compileExpression(finalExpr, scope)};`,
  );

  return {
    code: [...helperCode, ...bodyStatements].join("\n"),
    resultVar: finalExpr,
  };
}

function inferExpressionType(
  expr: string,
  scope: Map<string, BindingInfo>,
): IntegerType {
  expr = expr.trim();

  const literalType = parseLiteralType(expr);
  if (literalType) {
    return literalType;
  }

  const readType = parseReadType(expr);
  if (readType) {
    return readType;
  }

  if (/^\w+$/.test(expr)) {
    return getBindingOrThrow(scope, expr).type;
  }

  throw new Error(`Invalid expression: ${expr}`);
}

function compileExpression(
  expr: string,
  scope: Map<string, BindingInfo>,
): string {
  expr = expr.trim();

  const literalType = parseLiteralType(expr);
  if (literalType) {
    const match = /^(\d+)(U8|U16|U32|U64|I8|I16|I32|I64)$/.exec(expr);
    return match![1];
  }

  const readType = parseReadType(expr);
  if (readType) {
    return compileReadExpressionCore(readType);
  }

  if (/^\w+$/.test(expr)) {
    return getBindingOrThrow(scope, expr).compiledName;
  }

  throw new Error(`Invalid expression: ${expr}`);
}
