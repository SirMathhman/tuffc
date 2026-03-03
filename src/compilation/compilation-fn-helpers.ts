import { findMatchingBrace } from "../extractors/extractors-braces";

function findMatchingParen(text: string, openIdx: number): number {
  let depth = 0;
  let i = openIdx;
  while (i < text.length) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

function findAllAtDepthZero(source: string, char: string): number[] {
  const positions: number[] = [];
  let depth = 0;
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === char && depth === 0) positions.push(i);
    i++;
  }
  return positions;
}

function findLastDepthZeroChar(source: string, char: string): number {
  const positions = findAllAtDepthZero(source, char);
  if (positions.length === 0) return -1;
  return positions[positions.length - 1];
}

function splitAtDepthZeroCommas(paramsRaw: string): string[] {
  const positions = findAllAtDepthZero(paramsRaw, ",");
  if (positions.length === 0) return [paramsRaw];
  const parts: string[] = [];
  let prev = 0;
  let i = 0;
  while (i < positions.length) {
    parts.push(paramsRaw.substring(prev, positions[i]));
    prev = positions[i] + 1;
    i++;
  }
  parts.push(paramsRaw.substring(prev));
  return parts.filter((p) => p.trim() !== "");
}

function extractParamNames(paramsRaw: string): string {
  const trimmed = paramsRaw.trim();
  if (trimmed === "") return "";
  const parts = splitAtDepthZeroCommas(trimmed);
  let out = "";
  let i = 0;
  while (i < parts.length) {
    const p = parts[i].trim();
    const colonIdx = p.indexOf(":");
    let name = p;
    if (colonIdx !== -1) {
      name = p.substring(0, colonIdx).trim();
    }
    // Rename 'this' to '_this' because 'this' is a reserved keyword in JavaScript
    if (name === "this") {
      name = "_this";
    }
    if (out !== "") out += ", ";
    out += name;
    i++;
  }
  return out;
}

export {
  findMatchingParen,
  findMatchingBrace,
  findLastDepthZeroChar,
  extractParamNames,
};
