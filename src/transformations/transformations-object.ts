import { findMatchingBrace } from "../extractors/extractors-braces";
import { isAtWordBoundary } from "../extractors/extractors";
import {
  parseObjectName,
  extractMembers,
  buildReturnObject,
} from "./transformations-object-helpers";

function transformObjectDeclarations(source: string): string {
  let result = "";
  let i = 0;
  while (i < source.length) {
    const isObject =
      i < source.length - 7 &&
      source.substring(i, i + 7) === "object " &&
      isAtWordBoundary(source, i);
    if (!isObject) {
      result += source[i];
      i++;
      continue;
    }
    const parsed = parseObjectName(source, i + 7);
    if (parsed === null) {
      result += source[i];
      i++;
      continue;
    }
    const braceEnd = findMatchingBrace(source, parsed.braceStart);
    if (braceEnd === -1) {
      result += source[i];
      i++;
      continue;
    }
    const body = source.substring(parsed.braceStart + 1, braceEnd).trim();
    const members = extractMembers(body);
    const returnObj = buildReturnObject(members.vars, members.fns);
    result += `const ${parsed.name} = (function() { ${body} return ${returnObj}; })();`;
    i = braceEnd + 1;
  }
  return result;
}

function transformNamespaceAccess(source: string): string {
  let result = "";
  let i = 0;
  while (i < source.length) {
    if (i < source.length - 1 && source.substring(i, i + 2) === "::") {
      result += ".";
      i += 2;
    } else {
      result += source[i];
      i++;
    }
  }
  return result;
}

export { transformObjectDeclarations, transformNamespaceAccess };
