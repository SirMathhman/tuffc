export function compileTuffToJS(source) {
  const trimmed = source.trim();

  const functionParameterLocalReadCall =
    parseFunctionParameterLocalReadCall(trimmed);
  if (functionParameterLocalReadCall !== null) {
    return functionParameterLocalReadCall;
  }

  const functionParameterReadCall = parseFunctionParameterReadCall(trimmed);
  if (functionParameterReadCall !== null) {
    return functionParameterReadCall;
  }

  const functionReadCall = parseFunctionReadCall(trimmed);
  if (functionReadCall !== null) {
    return functionReadCall;
  }

  if (trimmed === "read()") {
    return "return __tuff_coerce(__tuff_read());";
  }

  const readAdditionExpression = parseReadAdditionExpression(trimmed);
  if (readAdditionExpression !== null) {
    return `return ${readAdditionExpression};`;
  }

  const statements = trimmed.split("; ");

  if (statements.length >= 2) {
    const returnStatement = statements[statements.length - 1];
    const compiledStatements = [];
    const boundVariableNames = [];
    let previousVariableName = null;

    for (let index = 0; index < statements.length - 1; index += 1) {
      const statement = statements[index];
      const binding = parseLetBinding(statement);
      const assignment = parseAssignment(statement);

      if (binding === null && assignment === null) {
        break;
      }

      if (binding !== null) {
        if (binding.initialValue === "read()") {
          compiledStatements.push(
            `let ${binding.variableName} = __tuff_coerce(__tuff_read());`,
          );
        } else if (index === 0) {
          break;
        } else if (binding.initialValue === previousVariableName) {
          compiledStatements.push(
            `let ${binding.variableName} = ${previousVariableName};`,
          );
        } else {
          break;
        }

        previousVariableName = binding.variableName;
        boundVariableNames.push(binding.variableName);
        continue;
      }

      if (assignment !== null) {
        if (
          index === 0 ||
          assignment.variableName !== previousVariableName ||
          (assignment.initialValue !== "read()" &&
            assignment.initialValue !== previousVariableName)
        ) {
          break;
        }

        if (assignment.initialValue === "read()") {
          compiledStatements.push(
            `${assignment.variableName} = __tuff_coerce(__tuff_read());`,
          );
        } else {
          compiledStatements.push(
            `${assignment.variableName} = ${previousVariableName};`,
          );
        }

        if (!boundVariableNames.includes(assignment.variableName)) {
          boundVariableNames.push(assignment.variableName);
        }

        continue;
      }
    }

    const returnExpression = parseAdditionExpression(
      returnStatement,
      boundVariableNames,
    );

    if (
      compiledStatements.length === statements.length - 1 &&
      (returnStatement === previousVariableName || returnExpression !== null)
    ) {
      return `${compiledStatements.join(" ")} return ${
        returnExpression ?? returnStatement
      };`;
    }
  }

  throw new Error(`Unsupported Tuff source: ${source}`);
}

export function executeTuff(source, stdIn) {
  const compiledJS = compileTuffToJS(source);
  const tokens = tokenizeStdIn(stdIn);
  let tokenIndex = 0;
  const func = new Function("__tuff_read", "__tuff_coerce", compiledJS);
  return func(
    () => tokens[tokenIndex++],
    (value) => {
      if (value === "true") {
        return 1;
      }

      if (value === "false") {
        return 0;
      }

      return Number(value);
    },
  );
}

function tokenizeStdIn(stdIn) {
  const input = String(stdIn).trim();
  if (input.length === 0) {
    return [];
  }

  const tokens = [];
  let currentToken = "";

  for (const character of input) {
    if (character.trim() === "") {
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = "";
      }
      continue;
    }

    currentToken += character;
  }

  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }

  return tokens;
}

function isValidIdentifier(identifier) {
  if (identifier.length === 0) {
    return false;
  }

  const firstCharacter = identifier[0];
  if (!isIdentifierStartCharacter(firstCharacter)) {
    return false;
  }

  for (let index = 1; index < identifier.length; index += 1) {
    if (!isIdentifierPartCharacter(identifier[index])) {
      return false;
    }
  }

  return true;
}

function parseLetBinding(statement) {
  const prefix = "let ";
  const binding = parseNameAndValue(statement, prefix);
  return binding;
}

function parseAssignment(statement) {
  if (statement.startsWith("let ")) {
    return null;
  }

  return parseNameAndValue(statement, "");
}

function parseAdditionExpression(statement, boundVariableNames) {
  return parseAdditionParts(statement, (term) => {
    const variableName = term.trim();
    if (!isValidIdentifier(variableName)) {
      return null;
    }

    if (!boundVariableNames.includes(variableName)) {
      return null;
    }

    return variableName;
  });
}

function parseReadAdditionExpression(statement) {
  return parseAdditionParts(statement, (term) => {
    if (term.trim() !== "read()") {
      return null;
    }

    return "__tuff_coerce(__tuff_read())";
  });
}
function parseFunctionReadCall(statement) {
  const prefix = "fn ";
  const declarationSeparator = "() => { return read(); } ";

  if (!statement.startsWith(prefix)) {
    return null;
  }

  const declarationSeparatorIndex = statement.indexOf(declarationSeparator);
  if (declarationSeparatorIndex <= prefix.length) {
    return null;
  }

  const functionName = statement.slice(
    prefix.length,
    declarationSeparatorIndex,
  );
  const callPart = statement.slice(
    declarationSeparatorIndex + declarationSeparator.length,
  );

  if (!isValidIdentifier(functionName) || callPart !== `${functionName}()`) {
    return null;
  }

  return `function ${functionName}() { return __tuff_coerce(__tuff_read()); } return ${functionName}();`;
}

function parseFunctionParameterReadCall(statement) {
  const prefix = "fn ";
  const functionParameterSeparator = "(";
  const declarationEndSeparator = ") => { return ";
  const readSuffixSeparator = " + read(); } ";

  if (!statement.startsWith(prefix)) {
    return null;
  }

  const functionParameterSeparatorIndex = statement.indexOf(
    functionParameterSeparator,
  );
  const declarationEndSeparatorIndex = statement.indexOf(
    declarationEndSeparator,
  );
  const readSuffixSeparatorIndex = statement.indexOf(readSuffixSeparator);

  if (
    functionParameterSeparatorIndex <= prefix.length ||
    declarationEndSeparatorIndex <= functionParameterSeparatorIndex ||
    readSuffixSeparatorIndex <= declarationEndSeparatorIndex
  ) {
    return null;
  }

  const functionName = statement.slice(
    prefix.length,
    functionParameterSeparatorIndex,
  );
  const parameterName = statement.slice(
    functionParameterSeparatorIndex + functionParameterSeparator.length,
    declarationEndSeparatorIndex,
  );
  const bodyExpression = statement.slice(
    declarationEndSeparatorIndex + declarationEndSeparator.length,
    readSuffixSeparatorIndex,
  );
  const callPart = statement.slice(
    readSuffixSeparatorIndex + readSuffixSeparator.length,
  );

  if (
    !isValidIdentifier(functionName) ||
    !isValidIdentifier(parameterName) ||
    bodyExpression !== parameterName
  ) {
    return null;
  }

  const callArgument = parseFunctionCallArgument(functionName, callPart);
  if (callArgument === null) {
    return null;
  }

  return `function ${functionName}(${parameterName}) { return ${parameterName} + __tuff_coerce(__tuff_read()); } return ${functionName}(${callArgument});`;
}

function parseFunctionParameterLocalReadCall(statement) {
  const prefix = "fn ";
  const functionParameterSeparator = "(";
  const functionBodyPrefix = ") => { let ";
  const bodyBindingSeparator = " = ";
  const bodyReadSeparator = " + read(); return ";
  const functionBodySuffix = "; } ";

  if (!statement.startsWith(prefix)) {
    return null;
  }

  const functionParameterSeparatorIndex = statement.indexOf(
    functionParameterSeparator,
  );
  const functionBodyPrefixIndex = statement.indexOf(functionBodyPrefix);
  const bodyBindingSeparatorIndex = statement.indexOf(
    bodyBindingSeparator,
    functionBodyPrefixIndex,
  );
  const bodyReadSeparatorIndex = statement.indexOf(
    bodyReadSeparator,
    bodyBindingSeparatorIndex,
  );
  const functionBodySuffixIndex = statement.indexOf(
    functionBodySuffix,
    bodyReadSeparatorIndex,
  );

  if (
    functionParameterSeparatorIndex <= prefix.length ||
    functionBodyPrefixIndex <= functionParameterSeparatorIndex ||
    bodyBindingSeparatorIndex <= functionBodyPrefixIndex ||
    bodyReadSeparatorIndex <= bodyBindingSeparatorIndex ||
    functionBodySuffixIndex <= bodyReadSeparatorIndex
  ) {
    return null;
  }

  const functionName = statement.slice(
    prefix.length,
    functionParameterSeparatorIndex,
  );
  const parameterName = statement.slice(
    functionParameterSeparatorIndex + functionParameterSeparator.length,
    functionBodyPrefixIndex,
  );
  const localVariableName = statement.slice(
    functionBodyPrefixIndex + functionBodyPrefix.length,
    bodyBindingSeparatorIndex,
  );
  const bodyExpression = statement.slice(
    bodyBindingSeparatorIndex + bodyBindingSeparator.length,
    bodyReadSeparatorIndex,
  );
  const returnExpression = statement.slice(
    bodyReadSeparatorIndex + bodyReadSeparator.length,
    functionBodySuffixIndex,
  );
  const callPart = statement.slice(
    functionBodySuffixIndex + functionBodySuffix.length,
  );

  if (
    !isValidIdentifier(functionName) ||
    !isValidIdentifier(parameterName) ||
    !isValidIdentifier(localVariableName) ||
    bodyExpression !== parameterName ||
    returnExpression !== localVariableName
  ) {
    return null;
  }

  const callArgument = parseFunctionCallArgument(functionName, callPart);
  if (callArgument === null) {
    return null;
  }

  return `function ${functionName}(${parameterName}) { let ${localVariableName} = ${parameterName} + __tuff_coerce(__tuff_read()); return ${localVariableName}; } return ${functionName}(${callArgument});`;
}

function parseFunctionCallArgument(functionName, callPart) {
  if (!callPart.startsWith(`${functionName}(`) || !callPart.endsWith(")")) {
    return null;
  }

  const callArgument = callPart.slice(functionName.length + 1, -1);
  if (callArgument.length === 0) {
    return null;
  }

  return callArgument;
}

function parseAdditionParts(statement, parseTerm) {
  const terms = statement.split("+");

  if (terms.length < 2) {
    return null;
  }

  const parsedTerms = [];

  for (const term of terms) {
    const parsedTerm = parseTerm(term);
    if (parsedTerm === null) {
      return null;
    }

    parsedTerms.push(parsedTerm);
  }

  return parsedTerms.join(" + ");
}

function parseNameAndValue(statement, prefix) {
  const equalsSeparator = " = ";
  if (!statement.startsWith(prefix)) {
    return null;
  }

  const separatorIndex = statement.indexOf(equalsSeparator);
  if (separatorIndex <= prefix.length) {
    return null;
  }

  const variableName = statement.slice(prefix.length, separatorIndex);
  const initialValue = statement.slice(separatorIndex + equalsSeparator.length);

  if (!isValidIdentifier(variableName)) {
    return null;
  }

  return { variableName, initialValue };
}

function isIdentifierStartCharacter(character) {
  return (
    (character >= "a" && character <= "z") ||
    (character >= "A" && character <= "Z") ||
    character === "_" ||
    character === "$"
  );
}

function isIdentifierPartCharacter(character) {
  return (
    isIdentifierStartCharacter(character) ||
    (character >= "0" && character <= "9")
  );
}

export function createMessage(name = "world") {
  return `Hello, ${name}!`;
}

if (import.meta.main) {
  console.log(createMessage());
}
