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

export function compileVariableBinding(source: string): {
  code: string;
  resultVar: string;
} {
  const scope = new Map<string, IntegerType>();
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
  const declaredVars = new Set<string>();

  const parts = source.split(";");
  const trimmedParts = parts.map((p) => p.trim()).filter((p) => p.length > 0);

  if (trimmedParts.length === 0) {
    throw new Error("Empty variable binding program");
  }

  const finalExpr = trimmedParts[trimmedParts.length - 1];
  const bindings = trimmedParts.slice(0, -1);

  // Process bindings: first occurrence declares, subsequent ones reassign (shadowing)
  for (const binding of bindings) {
    const letMatch =
      /^let\s+(\w+)\s*:\s*(U8|U16|U32|U64|I8|I16|I32|I64)\s*=\s*(.+)$/.exec(
        binding,
      );
    if (!letMatch) {
      throw new Error(`Invalid variable binding syntax: ${binding}`);
    }

    const [, name, typeStr, expr] = letMatch;
    const type = typeStr as IntegerType;

    const exprType = inferExpressionType(expr, scope);
    if (!isAssignableTo(exprType, type)) {
      throw new Error(
        `Type mismatch: ${exprType} is not assignable to ${type} in binding "${name}"`,
      );
    }

    const compiledExpr = compileExpression(expr, scope);
    if (declaredVars.has(name)) {
      // Reassign (shadowing)
      bodyStatements.push(`${name} = ${compiledExpr};`);
    } else {
      // First declaration
      bodyStatements.push(`let ${name}: number | bigint = ${compiledExpr};`);
      declaredVars.add(name);
    }

    scope.set(name, type);
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
  scope: Map<string, IntegerType>,
): IntegerType {
  expr = expr.trim();

  if (/^\d+(U8|U16|U32|U64|I8|I16|I32|I64)$/.test(expr)) {
    const match = /^\d+((U8|U16|U32|U64|I8|I16|I32|I64))$/.exec(expr);
    return match![1] as IntegerType;
  }

  if (/^read<(U8|U16|U32|U64|I8|I16|I32|I64)>\(\)$/.test(expr)) {
    const match = /^read<((U8|U16|U32|U64|I8|I16|I32|I64))>\(\)$/.exec(expr);
    return match![1] as IntegerType;
  }

  if (/^\w+$/.test(expr)) {
    const varType = scope.get(expr);
    if (!varType) {
      throw new Error(`Undefined variable: ${expr}`);
    }
    return varType;
  }

  throw new Error(`Invalid expression: ${expr}`);
}

function compileExpression(
  expr: string,
  scope: Map<string, IntegerType>,
): string {
  expr = expr.trim();

  if (/^\d+(U8|U16|U32|U64|I8|I16|I32|I64)$/.test(expr)) {
    const match = /^(\d+)(U8|U16|U32|U64|I8|I16|I32|I64)$/.exec(expr);
    return match![1];
  }

  if (/^read<(U8|U16|U32|U64|I8|I16|I32|I64)>\(\)$/.test(expr)) {
    const match = /^read<((U8|U16|U32|U64|I8|I16|I32|I64))>\(\)$/.exec(expr);
    const typeSuffix = match![1] as IntegerType;
    return compileReadExpressionCore(typeSuffix);
  }

  if (/^\w+$/.test(expr)) {
    if (!scope.has(expr)) {
      throw new Error(`Undefined variable: ${expr}`);
    }
    return expr;
  }

  throw new Error(`Invalid expression: ${expr}`);
}
