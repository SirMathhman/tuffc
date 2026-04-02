const message = "Hello from Bun!";

function isSimpleIdentifier(value) {
  if (value.length === 0) return false;

  const firstChar = value[0];
  if (
    !(
      (firstChar >= "a" && firstChar <= "z") ||
      (firstChar >= "A" && firstChar <= "Z") ||
      firstChar === "_" ||
      firstChar === "$"
    )
  )
    return false;

  for (let index = 1; index < value.length; index += 1)
    if (
      !(
        (value[index] >= "a" && value[index] <= "z") ||
        (value[index] >= "A" && value[index] <= "Z") ||
        (value[index] >= "0" && value[index] <= "9") ||
        value[index] === "_" ||
        value[index] === "$"
      )
    )
      return false;

  return true;
}

function isDoubleQuotedStringLiteral(value) {
  return (
    value.length >= 2 &&
    value[0] === '"' &&
    value[value.length - 1] === '"' &&
    value.slice(1, -1).indexOf('"') === -1
  );
}

function compileTuffToJS(source) {
  if (source === "") {
    return "return 0;";
  }

  const lengthSuffix = ".length";

  if (source.endsWith(lengthSuffix)) {
    const stringLiteral = source.slice(0, -lengthSuffix.length);
    if (isDoubleQuotedStringLiteral(stringLiteral)) {
      return `return ${source};`;
    }
  }

  const semicolonIndex = source.indexOf(";");
  if (semicolonIndex !== -1 && source.indexOf(";", semicolonIndex + 1) === -1) {
    const firstStatement = source.slice(0, semicolonIndex).trim();
    const secondStatement = source.slice(semicolonIndex + 1).trim();
    const equalsIndex = firstStatement.indexOf("=");

    if (
      equalsIndex !== -1 &&
      firstStatement.indexOf("=", equalsIndex + 1) === -1
    ) {
      const identifier = firstStatement.slice(0, equalsIndex).trim();
      const assignedValue = firstStatement.slice(equalsIndex + 1).trim();

      if (
        isSimpleIdentifier(identifier) &&
        isDoubleQuotedStringLiteral(assignedValue) &&
        secondStatement === `${identifier}${lengthSuffix}`
      ) {
        return `return ${assignedValue}${lengthSuffix};`;
      }
    }
  }

  if (Number.isInteger(Number(source)) && String(Number(source)) === source) {
    return `return ${source};`;
  }

  return String(source);
}

function executeTuff(source) {
  const compiledJS = compileTuffToJS(source);
  return new Function(compiledJS)();
}

export { compileTuffToJS, executeTuff, message };
