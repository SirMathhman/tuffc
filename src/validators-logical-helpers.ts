/* eslint-disable max-lines */
import { VariableInfo } from "./types";
import { extractIdentifier } from "./extractors";
import { findVariable } from "./metadata";
import { extractBinaryOperands } from "./extractors-operators";

function getExpressionType(expr: string, metadata: VariableInfo[]): string {
  const trimmed = expr.trim();
  if (trimmed === "true" || trimmed === "false") {
    return "Bool";
  }
  const firstChar = trimmed[0];
  if (firstChar >= "a" && firstChar <= "z") {
    const identifier = extractIdentifier(trimmed, 0);
    if (identifier !== "" && identifier === trimmed) {
      const varInfo = findVariable(identifier, metadata);
      if (varInfo !== undefined) {
        return varInfo.inferredType;
      }
    }
  }
  return "";
}

function extractOperands(
  source: string,
  opIndex: number,
): { leftExpr: string; rightExpr: string } | null {
  return extractBinaryOperands(source, opIndex, 2);
}

export { getExpressionType, extractOperands };
