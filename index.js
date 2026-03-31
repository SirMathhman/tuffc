export function compile(source) {
  const trimmedSource = source.trim();

  if (trimmedSource === "") {
    return "return 0;";
  }

  const statements = parseStatements(trimmedSource);
  return compileStatements(statements, [], true);
}

function compileStatements(
  statements,
  declaredVariables,
  returnLastExpression,
) {
  let output = "";

  for (let i = 0; i < statements.length; i += 1) {
    const shouldReturnExpression =
      returnLastExpression && i === statements.length - 1;
    output += compileStatement(
      statements[i],
      declaredVariables,
      shouldReturnExpression,
    );
  }

  return output;
}

function compileStatement(
  statement,
  declaredVariables,
  shouldReturnExpression = false,
) {
  if (statement.type === "assignment") {
    const { name, value } = statement;

    if (declaredVariables.includes(name)) {
      return `${name} = ${compileValue(value)};\n`;
    }

    declaredVariables.push(name);
    return `let ${name} = ${compileValue(value)};\n`;
  }

  if (statement.type === "if") {
    return compileIfStatement(statement, declaredVariables);
  }

  if (statement.type === "function") {
    return compileFunctionStatement(statement);
  }

  if (statement.type === "return") {
    return `return ${compileValue(statement.value)};\n`;
  }

  if (statement.type === "expression" && shouldReturnExpression) {
    return `return ${compileValue(statement.value)};`;
  }

  return "";
}

function compileIfStatement(statement, declaredVariables) {
  const { condition, body } = statement;
  const bodyOutput = compileStatements(body, declaredVariables, false);

  return `if (Number(${condition})) {\n${bodyOutput}}\n`;
}

function compileFunctionStatement(statement) {
  const { name, params, body } = statement;
  const functionDeclaredVariables = [...params];
  const bodyOutput = compileStatements(body, functionDeclaredVariables, false);

  return `function ${name}(${params.join(", ")}) {\n${bodyOutput}}\n`;
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

    if (isKeywordAt(source, pos, "fn")) {
      const { statement, endPos } = parseFunctionStatement(source, pos);
      statements.push(statement);
      pos = endPos;
    } else if (isKeywordAt(source, pos, "if")) {
      const { statement, endPos } = parseIfStatement(source, pos);
      statements.push(statement);
      pos = endPos;
    } else if (isKeywordAt(source, pos, "return")) {
      const { statement, endPos } = parseReturnStatement(source, pos);
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

  const block = parseBlock(source, pos);

  return {
    statement: { type: "if", condition, body: block.body },
    endPos: block.endPos,
  };
}

function parseFunctionStatement(source, startPos) {
  let pos = startPos + 2;
  pos = skipWhitespace(source, pos);

  const nameStart = pos;

  while (pos < source.length && isIdentifierChar(source[pos])) {
    pos += 1;
  }

  const name = source.slice(nameStart, pos).trim();

  if (name === "") {
    return parseSimpleStatement(source, startPos);
  }

  pos = skipWhitespace(source, pos);

  if (source[pos] !== "(") {
    return parseSimpleStatement(source, startPos);
  }

  pos += 1;

  const paramsStart = pos;
  while (pos < source.length && source[pos] !== ")") {
    pos += 1;
  }

  if (source[pos] !== ")") {
    return parseSimpleStatement(source, startPos);
  }

  pos += 1;

  const paramsSource = source.slice(paramsStart, pos - 1);
  const params = splitParameters(paramsSource);

  pos = skipWhitespace(source, pos);

  if (source[pos] !== "=" || source[pos + 1] !== ">") {
    return parseSimpleStatement(source, startPos);
  }

  pos += 2;
  pos = skipWhitespace(source, pos);

  if (source[pos] !== "{") {
    return parseSimpleStatement(source, startPos);
  }

  const { body, endPos } = parseBlock(source, pos);

  return { statement: { type: "function", name, params, body }, endPos };
}

function parseReturnStatement(source, startPos) {
  const { text: value, endPos } = scanUntilStatementEnd(source, startPos + 6);
  return { statement: { type: "return", value }, endPos };
}

function parseSimpleStatement(source, startPos) {
  const { text: statementText, endPos } = scanUntilStatementEnd(
    source,
    startPos,
  );

  const equalsIndex = findAssignmentOperator(statementText);

  if (equalsIndex !== -1) {
    const name = statementText.slice(0, equalsIndex).trim();
    const value = statementText.slice(equalsIndex + 1).trim();

    return { statement: { type: "assignment", name, value }, endPos };
  }

  return {
    statement: { type: "expression", value: statementText },
    endPos,
  };
}

function scanUntilStatementEnd(source, startPos) {
  let pos = startPos;

  while (
    pos < source.length &&
    source[pos] !== ";" &&
    source[pos] !== "{" &&
    source[pos] !== "}"
  ) {
    pos += 1;
  }

  const text = source.slice(startPos, pos).trim();

  if (
    pos < source.length &&
    (source[pos] === ";" || source[pos] === "{" || source[pos] === "}")
  ) {
    pos += 1;
  }

  return { text, endPos: pos };
}

function parseBlock(source, startPos) {
  let pos = startPos + 1;
  let braceDepth = 1;

  while (braceDepth > 0 && pos < source.length) {
    if (source[pos] === "{") {
      braceDepth += 1;
    } else if (source[pos] === "}") {
      braceDepth -= 1;
    }

    pos += 1;
  }

  const blockSource = source.slice(startPos + 1, pos - 1);
  const body = parseStatements(blockSource);

  pos = skipWhitespace(source, pos);

  if (source[pos] === ";") {
    pos += 1;
  }

  return { body, endPos: pos };
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

function isKeywordAt(source, startPos, keyword) {
  if (source.slice(startPos, startPos + keyword.length) !== keyword) {
    return false;
  }

  return !isIdentifierChar(source[startPos + keyword.length] ?? "");
}

function isIdentifierChar(char) {
  return (
    char !== "" &&
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$".includes(
      char,
    )
  );
}

function splitParameters(paramsSource) {
  const trimmedParams = paramsSource.trim();

  if (trimmedParams === "") {
    return [];
  }

  const params = [];
  let paramStart = 0;

  for (let i = 0; i < paramsSource.length; i += 1) {
    if (paramsSource[i] !== ",") {
      continue;
    }

    params.push(paramsSource.slice(paramStart, i).trim());
    paramStart = i + 1;
  }

  params.push(paramsSource.slice(paramStart).trim());

  return params;
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
