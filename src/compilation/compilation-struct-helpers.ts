import { extractIdentifier } from "../extractors/extractors";

function isIdChar(ch: string): boolean {
  return (
    (ch >= "a" && ch <= "z") ||
    (ch >= "A" && ch <= "Z") ||
    (ch >= "0" && ch <= "9") ||
    ch === "_"
  );
}
function skipWs(text: string, idx: number): number {
  let i = idx;
  while (
    i < text.length &&
    (text[i] === " " ||
      text[i] === "\t" ||
      text[i] === "\n" ||
      text[i] === "\r")
  )
    i++;
  return i;
}
function findBraceEnd(text: string, openIdx: number): number {
  let depth = 0;
  let i = openIdx;
  while (i < text.length) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

function parseStructPrefix(source: string): { names: string[]; rest: string } {
  const names: string[] = [];
  let i = skipWs(source, 0);
  while (source.substring(i, i + 6) === "struct") {
    let j = skipWs(source, i + 6);
    const name = extractIdentifier(source, j);
    if (name === "") break;
    names.push(name);
    j = skipWs(source, j + name.length);
    if (source[j] !== "{") break;
    const end = findBraceEnd(source, j);
    if (end === -1) break;
    i = skipWs(source, end + 1);
    if (source[i] === ";") i = skipWs(source, i + 1);
  }
  return { names, rest: source.substring(i) };
}

function normalizeFields(content: string): string {
  let out = "";
  let i = 0;
  while (i < content.length) {
    const name = extractIdentifier(content, i);
    if (name === "") {
      out += content[i];
      i++;
      continue;
    }
    const j = skipWs(content, i + name.length);
    if (content[j] !== ":") {
      out += content.substring(i, i + name.length);
      i += name.length;
      continue;
    }
    out += name + ":";
    i = skipWs(content, j + 1);
  }
  return out;
}

export { isIdChar, skipWs, findBraceEnd, parseStructPrefix, normalizeFields };
