import {
  isIdChar,
  skipWs,
  findBraceEnd,
  parseStructPrefix,
  normalizeFields,
} from "./compilation-struct-helpers";

function rewriteLiterals(source: string, names: string[]): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    let used = false;
    let k = 0;
    while (k < names.length) {
      const name = names[k];
      if (source.substring(i, i + name.length) === name && !(i > 0 && isIdChar(source[i - 1]))) {
        const braceStart = skipWs(source, i + name.length);
        if (source[braceStart] === "{") {
          const braceEnd = findBraceEnd(source, braceStart);
          if (braceEnd !== -1) {
            out += "{" + normalizeFields(source.substring(braceStart + 1, braceEnd)) + "}";
            i = braceEnd + 1;
            used = true;
            break;
          }
        }
      }
      k++;
    }
    if (!used) {
      out += source[i];
      i++;
    }
  }
  return out;
}

function stripStructTypes(source: string, names: string[]): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    if (source[i] !== ":") {
      out += source[i];
      i++;
      continue;
    }
    const typeStart = skipWs(source, i + 1);
    let matched = "";
    let k = 0;
    while (k < names.length) {
      const name = names[k];
      if (source.substring(typeStart, typeStart + name.length) === name) {
        const end = typeStart + name.length;
        if (!(end < source.length && isIdChar(source[end]))) {
          matched = name;
          break;
        }
      }
      k++;
    }
    if (matched === "") {
      out += source[i];
      i++;
      continue;
    }
    i = typeStart + matched.length;
  }
  return out;
}

function normalizeStructSyntax(source: string): string {
  if (source.indexOf("struct ") === -1) return source;
  const parsed = parseStructPrefix(source);
  if (parsed.names.length === 0) return source;
  return stripStructTypes(rewriteLiterals(parsed.rest, parsed.names), parsed.names).trim();
}

export { normalizeStructSyntax };
