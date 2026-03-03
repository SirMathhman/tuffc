function makeComparison(before: string, op: string, after: string): string {
  return `((${before} ${op} ${after})) ? 1 : 0`;
}

function isSpaceOrTab(char: string): boolean {
  return char === " " || char === "\t";
}

function isInsideWhileCondition(source: string, opIndex: number): boolean {
  let i = opIndex - 1;
  let parenDepth = 0;

  while (i >= 0) {
    if (source[i] === ")") {
      parenDepth++;
    } else if (source[i] === "(") {
      if (parenDepth === 0) {
        i--;
        while (i >= 0 && isSpaceOrTab(source[i])) i--;
        if (i >= 4) {
          const word = source.substring(i - 4, i + 1);
          if (word === "while") {
            return true;
          }
        }
        return false;
      }
      parenDepth--;
    }
    i--;
  }
  return false;
}

function transformComparisonOperators(source: string): string {
  let result = source;
  const ops = ["<=", ">=", "==", "!=", "<", ">"];

  for (const op of ops) {
    let index = result.indexOf(op);
    // For single-char ops, skip occurrences that are part of a two-char arrow (=>)
    if (op === ">" || op === "<") {
      while (index !== -1) {
        const precededByEq = op === ">" && index > 0 && result[index - 1] === "=";
        const followedByEq = op === "<" && index + 1 < result.length && result[index + 1] === "=";
        if (!precededByEq && !followedByEq) break;
        index = result.indexOf(op, index + 1);
      }
    }
    if (index !== -1 && !isInsideWhileCondition(result, index)) {
      const before = result.substring(0, index).trim();
      const after = result.substring(index + op.length).trim();

      if (before.length > 0 && after.length > 0) {
        const wrapped = makeComparison(before, op, after);
        result = wrapped;
      }
    }
  }

  return result;
}

export { transformComparisonOperators };
