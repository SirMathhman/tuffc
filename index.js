export function compile(source) {
  const trimmedSource = source.trim();

  if (trimmedSource === "") {
    return "return 0;";
  }

  const statements = trimmedSource
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement !== "");

  const lastIndex = statements.length - 1;
  let output = "";

  for (let i = 0; i < lastIndex; i += 1) {
    const statement = statements[i];
    const equalsIndex = statement.indexOf("=");
    const variableName = statement.slice(0, equalsIndex).trim();
    const rhs = statement.slice(equalsIndex + 1).trim();

    output += `let ${variableName} = ${compileValue(rhs)};\n`;
  }

  output += `return ${compileValue(statements[lastIndex])};`;
  return output;
}

function compileValue(value) {
  if (value === "true") {
    return "1";
  }

  return value;
}
