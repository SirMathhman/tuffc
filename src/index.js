export function compileTuffToJS(source) {
  const trimmed = source.trim();

  if (trimmed === "read()") {
    return "return __tuff_coerce(__tuff_read());";
  }

  const statements = trimmed.split("; ");

  if (statements.length === 2) {
    const [bindingStatement, returnStatement] = statements;
    const readBinding = parseReadBinding(bindingStatement);

    if (readBinding !== null && returnStatement === readBinding) {
      return `const ${readBinding} = __tuff_coerce(__tuff_read()); return ${readBinding};`;
    }
  }

  if (statements.length === 3) {
    const [firstBindingStatement, secondBindingStatement, returnStatement] =
      statements;
    const firstBinding = parseReadBinding(firstBindingStatement);
    const secondBinding = parseLetBinding(secondBindingStatement);

    if (
      firstBinding !== null &&
      secondBinding !== null &&
      secondBinding.initialValue === firstBinding &&
      returnStatement === secondBinding.variableName
    ) {
      return `const ${firstBinding} = __tuff_coerce(__tuff_read()); const ${secondBinding.variableName} = ${firstBinding}; return ${secondBinding.variableName};`;
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

function parseReadBinding(statement) {
  const binding = parseLetBinding(statement);
  if (binding === null || binding.initialValue !== "read()") {
    return null;
  }

  return binding.variableName;
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
