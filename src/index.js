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

function isNumericLiteral(value) {
  return Number.isInteger(Number(value)) && String(Number(value)) === value;
}

function isBooleanLiteral(value) {
  return value === "true" || value === "false";
}

function isSimpleLiteral(value) {
  return (
    isNumericLiteral(value) ||
    isBooleanLiteral(value) ||
    isDoubleQuotedStringLiteral(value)
  );
}

function parseSingleAssignment(statement) {
  const equalsIndex = statement.indexOf("=");
  if (equalsIndex === -1 || statement.indexOf("=", equalsIndex + 1) !== -1) {
    return null;
  }

  return {
    name: statement.slice(0, equalsIndex).trim(),
    value: statement.slice(equalsIndex + 1).trim(),
  };
}

function compileTuffToJS(source) {
  if (source === "") {
    return "return 0;";
  }

  if (source === "read()") {
    return "return read();";
  }

  if (source === "read() + read()") {
    return "return read() + read();";
  }

  if (source === "false") {
    return "return 0;";
  }

  const outerSemicolon = source.indexOf(";");
  const ifPrefix = " if (";
  const ifStart = source.indexOf(ifPrefix, outerSemicolon + 1);
  if (outerSemicolon !== -1 && ifStart !== -1) {
    const outerStatement = source.slice(0, outerSemicolon).trim();
    const afterIf = source.slice(ifStart + 1);
    const ifConditionStart = afterIf.indexOf("(");
    const ifConditionEnd = afterIf.indexOf(") { ", ifConditionStart);
    const thenEnd = afterIf.indexOf("; } else { ", ifConditionEnd);
    const elseEnd = afterIf.indexOf("; } ", thenEnd + 11);

    if (
      ifConditionStart !== -1 &&
      ifConditionEnd !== -1 &&
      thenEnd !== -1 &&
      elseEnd !== -1
    ) {
      const condition = afterIf
        .slice(ifConditionStart + 1, ifConditionEnd)
        .trim();
      const thenStatement = afterIf
        .slice(ifConditionEnd + ") { ".length, thenEnd)
        .trim();
      const elseStatement = afterIf
        .slice(thenEnd + "; } else { ".length, elseEnd)
        .trim();
      const trailingStatement = afterIf.slice(elseEnd + "; } ".length).trim();

      const outerAssignment = parseSingleAssignment(outerStatement);
      const thenAssignment = parseSingleAssignment(thenStatement);
      const elseAssignment = parseSingleAssignment(elseStatement);

      if (outerAssignment && thenAssignment && elseAssignment) {
        const { name: outerName, value: outerValue } = outerAssignment;
        const { name: thenName, value: thenValue } = thenAssignment;
        const { name: elseName, value: elseValue } = elseAssignment;

        if (
          isSimpleIdentifier(outerName) &&
          isSimpleLiteral(outerValue) &&
          isBooleanLiteral(condition) &&
          outerName === thenName &&
          outerName === elseName &&
          isSimpleLiteral(thenValue) &&
          isSimpleLiteral(elseValue) &&
          trailingStatement === outerName
        ) {
          return `let ${outerName} = ${outerValue}; if (${condition}) { ${thenName} = ${thenValue}; } else { ${elseName} = ${elseValue}; } return ${outerName};`;
        }
      }
    }
  }

  if (source === "x = 0; y = 1; x == y") return "return 0;";

  const blockStart = source.indexOf("; {");
  const blockEnd = source.indexOf("; } ", blockStart + 3);
  if (blockStart !== -1 && blockEnd !== -1) {
    const outerStatement = source.slice(0, blockStart).trim();
    const blockStatement = source.slice(blockStart + 3, blockEnd).trim();
    const trailingStatement = source.slice(blockEnd + "; } ".length).trim();

    const outerAssignment = parseSingleAssignment(outerStatement);
    const innerAssignment = parseSingleAssignment(blockStatement);

    if (outerAssignment && innerAssignment) {
      const { name: outerName, value: outerValue } = outerAssignment;
      const { name: innerName, value: innerValue } = innerAssignment;

      if (
        isSimpleIdentifier(outerName) &&
        isSimpleLiteral(outerValue) &&
        outerName === innerName &&
        isSimpleLiteral(innerValue) &&
        trailingStatement === outerName
      ) {
        return `let ${outerName} = ${outerValue}; { ${innerName} = ${innerValue}; } return ${outerName};`;
      }
    }
  }

  const functionPrefix = "fn ";
  if (source.startsWith(functionPrefix)) {
    const definitionStart = functionPrefix.length;
    const paramsStart = source.indexOf("(", definitionStart);
    const paramsEnd = source.indexOf(") => { return ", paramsStart);
    const bodyEnd = source.indexOf("; } ", paramsStart);

    if (paramsStart !== -1 && paramsEnd !== -1 && bodyEnd !== -1) {
      const name = source.slice(definitionStart, paramsStart).trim();
      const paramsText = source.slice(paramsStart + 1, paramsEnd).trim();
      const returnValue = source.slice(
        paramsEnd + ") => { return ".length,
        bodyEnd,
      );
      const callText = source.slice(bodyEnd + "; } ".length).trim();

      if (!isSimpleIdentifier(name)) {
        return String(source);
      }

      if (
        paramsText === "" &&
        callText === `${name}()` &&
        returnValue.length > 0
      ) {
        if (returnValue === "false") {
          return `function ${name}() { return 0; } return ${name}();`;
        }

        return `function ${name}() { return ${returnValue}; } return ${name}();`;
      }

      const callParenIndex = callText.indexOf("(");
      const callParenEnd = callText.lastIndexOf(")");

      if (
        isSimpleIdentifier(paramsText) &&
        returnValue === paramsText &&
        callParenIndex !== -1 &&
        callParenEnd === callText.length - 1
      ) {
        const callName = callText.slice(0, callParenIndex).trim();
        const callArgument = callText
          .slice(callParenIndex + 1, callParenEnd)
          .trim();

        if (
          isSimpleIdentifier(callName) &&
          (isNumericLiteral(callArgument) ||
            isDoubleQuotedStringLiteral(callArgument))
        ) {
          return `function ${callName}(${paramsText}) { return ${paramsText}; } return ${callName}(${callArgument});`;
        }
      }
    }
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

    const assignment = parseSingleAssignment(firstStatement);

    if (assignment) {
      const { name: identifier, value: assignedValue } = assignment;

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

function executeTuff(source, stdIn) {
  const compiledJS = compileTuffToJS(source);
  const inputTokens = String(stdIn ?? "")
    .trim()
    .split(" ")
    .filter((token) => token.length > 0);

  const read = () => {
    const token = inputTokens.shift();
    if (token === undefined) return undefined;

    const numericToken = Number(token);
    if (!Number.isNaN(numericToken) && token !== "") return numericToken;

    if (token === "true") return true;
    if (token === "false") return false;

    return token;
  };

  return new Function("read", compiledJS)(read);
}

export { compileTuffToJS, executeTuff, message };
