import { isAlpha, isDigit } from "../extractors/extractors";
import { extractNumericIfPresent } from "./transformations-numeric-suffix";
import { skipGenericParameters } from "./transformations-generic-stripping";
import { findMatchingBrace } from "../extractors/extractors-braces";
import { skipWhitespace } from "./transformations-if-expr-utils";

function skipTypeAnnotation(source: string, i: number, braceDepth: number): number {
  if (braceDepth > 0) return i;
  if (i < source.length - 1 && source[i] === ":" && source[i + 1] === " ") {
    let j = skipWhitespace(source, i + 2);
    if (source[j] === "{") {
      const end = findMatchingBrace(source, j);
      if (end !== -1) {
        return skipWhitespace(source, end + 1);
      }
    }
    while (j < source.length) {
      const char = source[j];
      const isTypePart = isAlpha(char) || isDigit(char) || char === "<" || char === ">" || char === "," || char === "*";
      const isSpace = char === " " && j + 1 < source.length && isAlpha(source[j + 1]);
      if (isTypePart || isSpace) j++;
      else break;
    }
    return skipWhitespace(source, j);
  }
  return i;
}

function stripTypeAnnotations(source: string): string {
  let result = "";
  let i = 0;
  let braceDepth = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === "{") {
      braceDepth++;
      result += char;
      i++;
    } else if (char === "}") {
      braceDepth--;
      result += char;
      i++;
    } else if (i < source.length - 5 && source.substring(i, i + 8) === "let mut ") {
      result += "let ";
      i += 8;
    } else {
      const genericEnd = skipGenericParameters(source, i);
      if (genericEnd > i) {
        i = genericEnd;
        continue;
      }
      const newI = skipTypeAnnotation(source, i, braceDepth);
      if (newI > i) {
        i = newI;
      } else {
        const suffix = extractNumericIfPresent(source, i);
        if (suffix.newIndex > i) {
          result += suffix.result;
          i = suffix.newIndex;
        } else {
          result += source[i];
          i++;
        }
      }
    }
  }
  return result;
}

function stripNumericTypeSuffixes(code: string): string {
  let result = "";
  let i = 0;
  while (i < code.length) {
    const char = code[i];
    if (isDigit(char)) {
      let j = i;
      while (j < code.length && isDigit(code[j])) j++;
      result += code.substring(i, j);
      let suffixEnd = j;
      while (suffixEnd < code.length && isAlpha(code[suffixEnd])) suffixEnd++;
      i = suffixEnd;
    } else {
      result += char;
      i++;
    }
  }
  return result;
}
export { skipTypeAnnotation, stripTypeAnnotations, stripNumericTypeSuffixes };
