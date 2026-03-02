import { isAlpha, isDigit } from "./extractors";
import { extractNumericIfPresent } from "./transformations-numeric-suffix";

function skipTypeAnnotation(source: string, i: number): number {
  if (i < source.length - 1 && source[i] === ":" && source[i + 1] === " ") {
    let j = i + 2;
    while (j < source.length) {
      const char = source[j];
      const isTypePart =
        isAlpha(char) ||
        isDigit(char) ||
        char === "<" ||
        char === ">" ||
        char === "," ||
        char === "*";
      const isSpace =
        char === " " && j + 1 < source.length && isAlpha(source[j + 1]);
      if (isTypePart || isSpace) {
        j++;
      } else {
        break;
      }
    }
    while (j < source.length && source[j] === " ") {
      j++;
    }
    return j;
  }
  return i;
}

function stripTypeAnnotations(source: string): string {
  let result = "";
  let i = 0;
  while (i < source.length) {
    if (i < source.length - 5 && source.substring(i, i + 8) === "let mut ") {
      result += "let ";
      i += 8;
    } else {
      const newI = skipTypeAnnotation(source, i);
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
      while (j < code.length && isDigit(code[j])) {
        j++;
      }
      result += code.substring(i, j);
      let suffixEnd = j;
      while (suffixEnd < code.length && isAlpha(code[suffixEnd])) {
        suffixEnd++;
      }
      i = suffixEnd;
    } else {
      result += char;
      i++;
    }
  }
  return result;
}

export { skipTypeAnnotation, stripTypeAnnotations, stripNumericTypeSuffixes };
