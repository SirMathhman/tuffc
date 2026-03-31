export function interpret(source) {
  if (source === "") {
    return 0;
  }

  const scope = {};
  const statements = source
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement !== "");

  let result = 0;

  for (const statement of statements) {
    const assignmentMatch = statement.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);

    if (assignmentMatch) {
      const [, variableName, rhs] = assignmentMatch;
      const value = evaluateExpression(rhs.trim(), scope);
      scope[variableName] = value;
      result = value;
      continue;
    }

    result = evaluateExpression(statement, scope);
  }

  return result;
}

function evaluateExpression(expression, scope) {
  if (/^-?\d+(?:\.\d+)?$/.test(expression)) {
    return Number(expression);
  }

  if (/^[A-Za-z_]\w*$/.test(expression)) {
    return scope[expression];
  }

  return Number(expression);
}
