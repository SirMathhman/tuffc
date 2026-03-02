import { isDigit } from "./extractors-characters";

function extractIdentifier(str: string, startIndex: number): string {
  let identifier = "";
  let i = startIndex;
  while (
    i < str.length &&
    ((str[i] >= "a" && str[i] <= "z") ||
      (str[i] >= "A" && str[i] <= "Z") ||
      (str[i] >= "0" && str[i] <= "9") ||
      str[i] === "_")
  ) {
    identifier += str[i];
    i++;
  }
  return identifier;
}

function extractNumericPart(
  source: string,
  startIndex: number,
): { numericPart: string; endIndex: number } {
  let numericPart = "";
  let endIndex = startIndex;
  let i = startIndex;
  while (i < source.length) {
    const char = source[i];
    if (isDigit(char) || char === ".") {
      numericPart += char;
      endIndex = i + 1;
      i++;
    } else {
      break;
    }
  }
  return { numericPart, endIndex };
}

function isAssignmentOperator(source: string, position: number): boolean {
  return source.substring(position, position + 3) === " = ";
}

function advancePast(varStart: number, varName: string): number {
  return varStart + varName.length;
}

function isAtWordBoundary(source: string, i: number): boolean {
  return i === 0 || source[i - 1] === " " || source[i - 1] === ";";
}

export {
  extractIdentifier,
  extractNumericPart,
  isAssignmentOperator,
  advancePast,
  isAtWordBoundary,
};
