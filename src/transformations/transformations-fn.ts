import {
  findMatchingParen,
  extractParamNames,
} from "../compilation/compilation-fn-helpers";

function transformFnDeclarations(source: string): string {
  let result = "";
  let i = 0;
  while (i < source.length) {
    const isFn =
      i < source.length - 3 &&
      source.substring(i, i + 3) === "fn " &&
      (i === 0 || source[i - 1] === " " || source[i - 1] === ";");
    if (!isFn) {
      result += source[i];
      i++;
      continue;
    }
    const arrowIdx = source.indexOf("=>", i);
    let semiIdx = -1;
    if (arrowIdx !== -1) {
      semiIdx = source.indexOf(";", arrowIdx + 2);
    }
    if (arrowIdx === -1 || semiIdx === -1) {
      result += source[i];
      i++;
      continue;
    }
    const decl = source.substring(i, arrowIdx).trim();
    const body = source.substring(arrowIdx + 2, semiIdx).trim();
    const openParen = decl.indexOf("(");
    if (openParen === -1) {
      result += source[i];
      i++;
      continue;
    }
    const closeParen = findMatchingParen(decl, openParen);
    if (closeParen === -1) {
      result += source[i];
      i++;
      continue;
    }
    const fnName = decl.substring(3, openParen).trim();
    const paramsRaw = decl.substring(openParen + 1, closeParen);
    const paramNames = extractParamNames(paramsRaw);
    result += `function ${fnName}(${paramNames}) { return ${body}; }`;
    i = semiIdx + 1;
  }
  return result;
}

export { transformFnDeclarations };
