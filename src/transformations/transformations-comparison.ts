function makeComparison(before: string, op: string, after: string): string {
  return `((${before} ${op} ${after})) ? 1 : 0`;
}

function transformComparisonOperators(source: string): string {
  let result = source;
  const ops = ["<=", ">=", "<", ">"];

  for (const op of ops) {
    const index = result.indexOf(op);
    if (index !== -1) {
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
