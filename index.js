export function compile(source) {
  const trimmedSource = source.trim();

  if (trimmedSource === "") {
    return "return 0;";
  }

  const statements = parseStatements(trimmedSource);
  const declaredVariables = new Set();

  let output = "";
  const lastIndex = statements.length - 1;

  for (let i = 0; i < lastIndex; i += 1) {
    output += compileStatement(statements[i], declaredVariables);
  }

  const lastStatement = statements[lastIndex];

  if (lastStatement.type === "expression") {
    output += `return ${compileValue(lastStatement.value)};`;
  } else if (lastStatement.type === "if") {
    output += compileIfStatement(lastStatement, declaredVariables);
  } else {
    output += compileStatement(lastStatement, declaredVariables);
  }

  return output;
}

function compileStatement(statement, declaredVariables) {
  if (statement.type === "assignment") {
    const { name, value } = statement;

    if (declaredVariables.has(name)) {
      return `${name} = ${compileValue(value)};\n`;
    }

    declaredVariables.add(name);
    return `let ${name} = ${compileValue(value)};\n`;
  }

  if (statement.type === "if") {
    return compileIfStatement(statement, declaredVariables);
  }

  return "";
}

function compileIfStatement(statement, declaredVariables) {
  const { condition, body } = statement;
  let bodyOutput = "";

  for (const stmt of body) {
    bodyOutput += compileStatement(stmt, declaredVariables);
  }

  return `if (Number(${condition})) {\n${bodyOutput}}\n`;
}

function compileValue(value) {
  return `Number(${value})`;
}

function parseStatements(source) {
  const statements = [];
  let pos = 0;

  while (pos < source.length) {
    pos = skipWhitespace(source, pos);

    if (pos >= source.length) {
      break;
    }

    if (source.substr(pos, 2) === "if") {
      const { statement, endPos } = parseIfStatement(source, pos);
      statements.push(statement);
      pos = endPos;
    } else {
      const { statement, endPos } = parseSimpleStatement(source, pos);
      statements.push(statement);
      pos = endPos;
    }
  }

  return statements;
}

function parseIfStatement(source, startPos) {
  let pos = startPos + 2;
  pos = skipWhitespace(source, pos);

  if (source[pos] !== "(") {
    return parseSimpleStatement(source, startPos);
  }

  pos += 1;

  const conditionStart = pos;
  let parenDepth = 1;

  while (parenDepth > 0 && pos < source.length) {
    if (source[pos] === "(") {
      parenDepth += 1;
    } else if (source[pos] === ")") {
      parenDepth -= 1;
    }

    pos += 1;
  }

  const condition = source.slice(conditionStart, pos - 1).trim();
  pos = skipWhitespace(source, pos);

  if (source[pos] !== "{") {
    return parseSimpleStatement(source, startPos);
  }

  pos += 1;

  const bodyStart = pos;
  let braceDepth = 1;

  while (braceDepth > 0 && pos < source.length) {
    if (source[pos] === "{") {
      braceDepth += 1;
    } else if (source[pos] === "}") {
      braceDepth -= 1;
    }

    pos += 1;
  }

  const bodySource = source.slice(bodyStart, pos - 1);
  const body = parseStatements(bodySource);

  pos = skipWhitespace(source, pos);

  if (source[pos] === ";") {
    pos += 1;
  }

  return { statement: { type: "if", condition, body }, endPos: pos };
}

function parseSimpleStatement(source, startPos) {
  let pos = startPos;

  while (
    pos < source.length &&
    source[pos] !== ";" &&
    source[pos] !== "{" &&
    source[pos] !== "}"
  ) {
    pos += 1;
  }

  const statementText = source.slice(startPos, pos).trim();

  if (
    pos < source.length &&
    (source[pos] === ";" || source[pos] === "{" || source[pos] === "}")
  ) {
    pos += 1;
  }

  const equalsIndex = findAssignmentOperator(statementText);

  if (equalsIndex !== -1) {
    const name = statementText.slice(0, equalsIndex).trim();
    const value = statementText.slice(equalsIndex + 1).trim();

    return { statement: { type: "assignment", name, value }, endPos: pos };
  }

  return {
    statement: { type: "expression", value: statementText },
    endPos: pos,
  };
}

function skipWhitespace(source, startPos) {
  let pos = startPos;

  while (pos < source.length && isWhitespace(source[pos])) {
    pos += 1;
  }

  return pos;
}

function isWhitespace(char) {
  return char === " " || char === "\t" || char === "\n" || char === "\r";
}

function findAssignmentOperator(statementText) {
  for (let i = 0; i < statementText.length; i += 1) {
    if (statementText[i] !== "=") {
      continue;
    }

    const previousChar = statementText[i - 1] ?? "";
    const nextChar = statementText[i + 1] ?? "";

    if (
      previousChar === "<" ||
      previousChar === ">" ||
      previousChar === "!" ||
      previousChar === "=" ||
      nextChar === "="
    ) {
      continue;
    }

    return i;
  }

  return -1;
}
