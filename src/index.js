export function compileTuffToJS(source) {
  const trimmed = source.trim();

  if (trimmed === "read()") {
    return "return __tuff_coerce(__tuff_read());";
  }

  const statements = trimmed.split("; ");

  if (statements.length >= 2) {
    const returnStatement = statements[statements.length - 1];
    const compiledStatements = [];
    let previousVariableName = null;

    for (let index = 0; index < statements.length - 1; index += 1) {
      const binding = parseLetBinding(statements[index]);
      if (binding === null) {
        break;
      }

      if (index === 0) {
        if (binding.initialValue !== "read()") {
          break;
        }

        compiledStatements.push(
          `const ${binding.variableName} = __tuff_coerce(__tuff_read());`,
        );
      } else if (binding.initialValue === previousVariableName) {
        compiledStatements.push(
          `const ${binding.variableName} = ${previousVariableName};`,
        );
      } else {
        break;
      }

      previousVariableName = binding.variableName;
    }

    if (
      compiledStatements.length === statements.length - 1 &&
      returnStatement === previousVariableName
    ) {
      return `${compiledStatements.join(" ")} return ${returnStatement};`;
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
