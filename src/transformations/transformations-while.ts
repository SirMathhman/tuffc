function skipWhitespace(source: string, idx: number): number {
  while (idx < source.length && (source[idx] === " " || source[idx] === "\t" || source[idx] === "\n")) {
    idx++;
  }
  return idx;
}

function extractCondition(source: string, idx: number): { cond: string; endIdx: number } | null {
  if (source[idx] !== "(") return null;
  let parenDepth = 0;
  let condEnd = idx;
  while (condEnd < source.length) {
    if (source[condEnd] === "(") parenDepth++;
    else if (source[condEnd] === ")") {
      if (parenDepth === 0) break;
      parenDepth--;
    }
    condEnd++;
  }
  if (condEnd >= source.length) return null;
  return { cond: source.substring(idx + 1, condEnd).trim(), endIdx: condEnd };
}

function extractBody(source: string, idx: number): { body: string; endIdx: number } | null {
  if (source[idx] !== "{") return null;
  let braceDepth = 0;
  let bodyEnd = idx;
  while (bodyEnd < source.length) {
    if (source[bodyEnd] === "{") braceDepth++;
    else if (source[bodyEnd] === "}") {
      if (braceDepth === 0) break;
      braceDepth--;
    }
    bodyEnd++;
  }
  return { body: source.substring(idx, bodyEnd + 1).trim(), endIdx: bodyEnd + 1 };
}

function transformWhileLoops(source: string): string {
  if (!source.includes("while")) return source;
  let result = "";
  let i = 0;
  while (i < source.length) {
    const whileIdx = source.indexOf("while", i);
    if (whileIdx === -1) {
      result += source.substring(i);
      break;
    }
    result += source.substring(i, whileIdx);
    let idx = skipWhitespace(source, whileIdx + 5);
    const condResult = extractCondition(source, idx);
    if (condResult === null) {
      result += "while";
      i = whileIdx + 5;
      continue;
    }
    idx = skipWhitespace(source, condResult.endIdx + 1);
    const bodyResult = extractBody(source, idx);
    if (bodyResult === null) {
      result += "while";
      i = whileIdx + 5;
      continue;
    }
    result += `while (${condResult.cond}) ${bodyResult.body}`;
    i = bodyResult.endIdx;
    if (i < source.length && source[i] === ";") i++;
  }
  return result;
}

export { transformWhileLoops };
