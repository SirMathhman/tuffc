export function compile(source) {
  const trimmedSource = source.trim();

  if (trimmedSource === "") {
    return "return 0;";
  }

  const statements = splitStatements(trimmedSource);

  const lastIndex = statements.length - 1;
  let output = "";
  const declaredVariables = new Set();

  for (let i = 0; i < lastIndex; i += 1) {
    const statement = statements[i];
    const equalsIndex = statement.indexOf("=");
    const variableName = statement.slice(0, equalsIndex).trim();
    const rhs = statement.slice(equalsIndex + 1).trim();

    if (declaredVariables.has(variableName)) {
      output += `${variableName} = ${compileValue(rhs)};\n`;
      continue;
    }

    output += `let ${variableName} = ${compileValue(rhs)};\n`;
    declaredVariables.add(variableName);
  }

  output += `return ${compileValue(statements[lastIndex])};`;
  return output;
}

function compileValue(value) {
  return `Number(${value})`;
}

function splitStatements(source) {
  const statements = [];
  let current = "";

  for (const char of source) {
    if (char === ";" || char === "{" || char === "}") {
      pushStatement(statements, current);
      current = "";
      continue;
    }

    current += char;
  }

  pushStatement(statements, current);
  return statements;
}

function pushStatement(statements, statement) {
  const trimmedStatement = statement.trim();

  if (trimmedStatement !== "") {
    statements.push(trimmedStatement);
  }
}
