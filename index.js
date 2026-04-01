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

    if (isDestructuringPattern(name)) {
      const boundNames = extractDestructuredNames(name);
      const compiledValue = value;
      const shouldDeclare =
        boundNames.length === 0 ||
        boundNames.some((boundName) => !declaredVariables.includes(boundName));

      if (shouldDeclare) {
        for (const boundName of boundNames) {
          if (!declaredVariables.includes(boundName)) {
            declaredVariables.push(boundName);
          }
        }

        return `let ${name} = ${compiledValue};\n`;
      }

      return `(${name} = ${compiledValue});\n`;
    }

    const compiledValue = compileAssignedValue(value);

    if (declaredVariables.includes(name)) {
      return `${name} = ${compiledValue};\n`;
    }

    declaredVariables.push(name);
    return `let ${name} = ${compiledValue};\n`;
  }

  if (statement.type === "if") {
    return compileIfStatement(statement, declaredVariables);
  }

  if (statement.type === "function") {
    return compileFunctionStatement(statement);
  }

  if (statement.type === "block") {
    return compileStatements(statement.body, declaredVariables, false);
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

  if (params[0] === "this") {
    return `Object.prototype.${name} = function(${params.slice(1).join(", ")}) {\n${bodyOutput}};\n`;
  }

  return `function ${name}(${params.join(", ")}) {\n${bodyOutput}}\n`;
}

function compileValue(value) {
  if (value.startsWith("{")) {
    return value;
  }

  let formattedValue = "";

  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === ".") {
      const prevChar = i > 0 ? value[i - 1] : "";
      const nextChar = i < value.length - 1 ? value[i + 1] : "";

      const isPrevDigit = prevChar >= "0" && prevChar <= "9";
      const isNextLetter =
        (nextChar >= "a" && nextChar <= "z") ||
        (nextChar >= "A" && nextChar <= "Z") ||
        nextChar === "_";

      if (isPrevDigit && isNextLetter) {
        formattedValue += " .";
      } else {
        formattedValue += value[i];
      }
    } else {
      formattedValue += value[i];
    }
  }

  return `Number(${formattedValue})`;
}

function compileAssignedValue(value) {
  return compileValue(value);
}

function isDestructuringPattern(name) {
  return name.startsWith("{") && name.endsWith("}");
}

function extractDestructuredNames(pattern) {
  const inner = pattern.slice(1, -1).trim();

  if (inner === "") {
    return [];
  }

  return inner.split(",").map((part) => {
    const colonIndex = part.indexOf(":");

    if (colonIndex === -1) {
      return part.trim();
    }

    return part.slice(colonIndex + 1).trim();
  });
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
    } else if (source[pos] === "{") {
      if (looksLikeBraceAssignment(source, pos)) {
        const { statement, endPos } = parseSimpleStatement(source, pos);
        statements.push(statement);
        pos = endPos;
      } else if (looksLikeObjectLiteralExpression(source, pos)) {
        const { statement, endPos } = parseSimpleStatement(source, pos);
        statements.push(statement);
        pos = endPos;
      } else {
        const { body, endPos } = parseBlock(source, pos);
        statements.push({ type: "block", body });
        pos = endPos;
      }
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
  let braceDepth = 0;
  let parenDepth = 0;

  while (
    pos < source.length &&
    !(source[pos] === ";" && braceDepth === 0 && parenDepth === 0)
  ) {
    if (source[pos] === "{") {
      braceDepth += 1;
    } else if (source[pos] === "}" && braceDepth > 0) {
      braceDepth -= 1;
    } else if (source[pos] === "(") {
      parenDepth += 1;
    } else if (source[pos] === ")" && parenDepth > 0) {
      parenDepth -= 1;
    }

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

function looksLikeObjectLiteralExpression(source, startPos) {
  let pos = startPos + 1;
  let braceDepth = 1;

  while (pos < source.length && braceDepth > 0) {
    if (source[pos] === "{") {
      braceDepth += 1;
    } else if (source[pos] === "}") {
      braceDepth -= 1;

      if (braceDepth === 0) {
        break;
      }
    } else if (source[pos] === ":" && braceDepth === 1) {
      return true;
    }

    pos += 1;
  }

  return false;
}

function looksLikeBraceAssignment(source, startPos) {
  let pos = startPos + 1;
  let braceDepth = 1;

  while (pos < source.length && braceDepth > 0) {
    if (source[pos] === "{") {
      braceDepth += 1;
    } else if (source[pos] === "}") {
      braceDepth -= 1;

      if (braceDepth === 0) {
        break;
      }
    }

    pos += 1;
  }

  pos = skipWhitespace(source, pos + 1);

  return source[pos] === "=" && source[pos + 1] !== "=";
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
