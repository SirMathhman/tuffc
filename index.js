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
    const assignment = parseAssignment(statement);

    if (assignment) {
      const value = evaluateExpression(assignment.rhs, scope);
      scope[assignment.variableName] = value;
      result = value;
      continue;
    }

    result = evaluateExpression(statement, scope);
  }

  return result;
}

function parseAssignment(statement) {
  const equalsIndex = statement.indexOf("=");

  if (equalsIndex <= 0) {
    return null;
  }

  const variableName = statement.slice(0, equalsIndex).trim();
  const rhs = statement.slice(equalsIndex + 1).trim();

  if (rhs === "" || !isIdentifier(variableName)) {
    return null;
  }

  return { variableName, rhs };
}

function evaluateExpression(expression, scope) {
  if (isNumericLiteral(expression)) {
    return Number(expression);
  }

  if (isIdentifier(expression)) {
    return scope[expression];
  }

  return Number(expression);
}

function isNumericLiteral(value) {
  if (value === "") {
    return false;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue);
}

function isIdentifier(value) {
  if (value.length === 0 || !isIdentifierStart(value[0])) {
    return false;
  }

  for (let i = 1; i < value.length; i += 1) {
    if (!isIdentifierPart(value[i])) {
      return false;
    }
  }

  return true;
}

function isIdentifierStart(char) {
  return (
    (char >= "a" && char <= "z") || (char >= "A" && char <= "Z") || char === "_"
  );
}

function isIdentifierPart(char) {
  return isIdentifierStart(char) || (char >= "0" && char <= "9");
}
