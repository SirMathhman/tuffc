const message = "Hello from Bun!";

function compileTuffToJS(source) {
  if (source === "") {
    return "return 0;";
  }

  const lengthSuffix = ".length";
  if (source.endsWith(lengthSuffix)) {
    const stringLiteral = source.slice(0, -lengthSuffix.length);
    if (
      stringLiteral.length >= 2 &&
      stringLiteral[0] === '"' &&
      stringLiteral[stringLiteral.length - 1] === '"' &&
      stringLiteral.slice(1, -1).indexOf('"') === -1
    ) {
      return `return ${source};`;
    }
  }

  if (
    source !== "" &&
    Number.isInteger(Number(source)) &&
    String(Number(source)) === source
  ) {
    return `return ${source};`;
  }

  return String(source);
}

function executeTuff(source) {
  const compiledJS = compileTuffToJS(source);
  return new Function(compiledJS)();
}

export { compileTuffToJS, executeTuff, message };
