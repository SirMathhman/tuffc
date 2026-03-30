/**
 * Shared utilities for type compilation and runtime operations.
 */

import type { IntegerType } from "./compileTuffToTS";

export function compileReadExpressionCore(typeSuffix: IntegerType): string {
  const byteWidthByType: Record<IntegerType, number> = {
    U8: 1,
    U16: 2,
    U32: 4,
    U64: 8,
    I8: 1,
    I16: 2,
    I32: 4,
    I64: 8,
  };

  const signedBitWidthByType: Partial<Record<IntegerType, number>> = {
    I8: 8,
    I16: 16,
    I32: 32,
    I64: 64,
  };

  const byteWidth = byteWidthByType[typeSuffix];
  const signedBitWidth = signedBitWidthByType[typeSuffix];

  let resultExpression = `Number(__readUnsignedLE(${byteWidth}))`;
  if (typeSuffix === "U64") {
    resultExpression = "__readUnsignedLE(8)";
  }

  if (typeof signedBitWidth === "number") {
    resultExpression = `__toSigned(__readUnsignedLE(${byteWidth}), ${signedBitWidth})`;
    if (typeSuffix !== "I64") {
      resultExpression = `Number(${resultExpression})`;
    }
  }

  return resultExpression;
}
