function makeComparison(before: string, op: string, after: string): string {
  return `((${before} ${op} ${after})) ? 1 : 0`;
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
        while (i >= 0 && (source[i] === " " || source[i] === "\t")) {
          i--;
        }
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
  const ops = ["<=", ">=", "<", ">"];

  for (const op of ops) {
    const index = result.indexOf(op);
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
