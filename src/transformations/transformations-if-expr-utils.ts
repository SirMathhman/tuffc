function findExpressionEnd(
  source: string,
  startIdx: number,
): { endIdx: number; foundElse: boolean } {
  let i = startIdx;
  let braceDepth = 0;
  let parenDepth = 0;
  let foundElse = false;

  while (i < source.length) {
    if (source[i] === "{") braceDepth++;
    else if (source[i] === "}") braceDepth--;
    else if (source[i] === "(") parenDepth++;
    else if (source[i] === ")") parenDepth--;
    else if (
      source.substring(i, i + 4) === "else" &&
      braceDepth === 0 &&
      parenDepth === 0
    ) {
      foundElse = true;
    }

    if (
      source[i] === ";" &&
      braceDepth === 0 &&
      parenDepth === 0 &&
      foundElse
    ) {
      break;
    }
    i++;
  }

  return { endIdx: i, foundElse };
}

function skipWhitespace(source: string, startIdx: number): number {
  let i = startIdx;
  while (i < source.length && (source[i] === " " || source[i] === "\t")) {
    i++;
  }
  return i;
}

function extractCondition(
  source: string,
  ifIdx: number,
): { cond: string; endIdx: number } {
  let i = ifIdx + 2;
  while (i < source.length && source[i] !== "(") {
    i++;
  }
  if (i >= source.length) return { cond: "", endIdx: i };

  i++;
  const condStart = i;
  let parenDepth = 1;
  while (i < source.length && parenDepth > 0) {
    if (source[i] === "(") parenDepth++;
    else if (source[i] === ")") parenDepth--;
    if (parenDepth > 0) i++;
  }
  const cond = source.substring(condStart, i);
  return { cond, endIdx: i + 1 };
}

export { findExpressionEnd, skipWhitespace, extractCondition };
