export function compileTuffToJS(source) {
  const trimmed = source.trim();

  const functionParameterLocalReadCall =
    parseFunctionParameterLocalReadCall(trimmed);
  if (functionParameterLocalReadCall !== undefined) {
    return functionParameterLocalReadCall;
  }

  const functionParameterReadCall = parseFunctionParameterReadCall(trimmed);
  if (functionParameterReadCall !== undefined) {
    return functionParameterReadCall;
  }

  const functionReadCall = parseFunctionReadCall(trimmed);
  if (functionReadCall !== undefined) {
    return functionReadCall;
  }

  if (trimmed === "read()") {
    return "return __tuff_coerce(__tuff_read());";
  }

  const readAdditionExpression = parseReadAdditionExpression(trimmed);
  if (readAdditionExpression !== undefined) {
    return `return ${readAdditionExpression};`;
  }

  const statements = trimmed.split("; ");

  if (statements.length >= 2) {
    const returnStatement = statements[statements.length - 1];
    const compiledStatements = [];
    const boundVariableNames = [];
    let previousVariableName = undefined;

    for (let index = 0; index < statements.length - 1; index += 1) {
      const statement = statements[index];
      const binding = parseLetBinding(statement);
      const assignment = parseAssignment(statement);

      if (binding === undefined && assignment === undefined) {
        break;
      }

      if (binding !== undefined) {
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

      if (assignment !== undefined) {
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
      (returnStatement === previousVariableName ||
        returnExpression !== undefined)
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
  const runtime = createTuffRuntime(stdIn);
  const func = new Function("__tuff_read", "__tuff_coerce", compiledJS);
  return func(runtime.read, runtime.coerce);
}

export function executeAllTuff(entrypointName, allTuff, stdIn) {
  return executeAllTuffInternal(entrypointName, allTuff, undefined, stdIn);
}

export function executeAllTuffWithNative(
  entrypointName,
  allTuff,
  nativeTuff,
  stdIn,
) {
  return executeAllTuffInternal(entrypointName, allTuff, nativeTuff, stdIn);
}

function executeAllTuffInternal(entrypointName, allTuff, nativeTuff, stdIn) {
  const definitions = collectTuffDefinitions(allTuff);
  const entrypointBody = findTuffEntrypointBody(entrypointName, definitions);
  if (entrypointBody === undefined) {
    throw new Error(`Unsupported Tuff entrypoint: ${entrypointName}`);
  }

  const runtime = createTuffRuntime(stdIn);
  const libExports = buildTuffLibraryExports(definitions, runtime);
  const externModules =
    nativeTuff === undefined ? {} : buildTuffNativeModules(nativeTuff);
  const compiledJS = compileAllTuffSource(entrypointBody);
  const func = new Function(
    "lib",
    "externModules",
    "__tuff_read",
    "__tuff_coerce",
    compiledJS,
  );
  return func(libExports, externModules, runtime.read, runtime.coerce);
}

function createTuffRuntime(stdIn) {
  const tokens = tokenizeStdIn(stdIn);
  let tokenIndex = 0;

  return {
    read: () => tokens[tokenIndex++],
    coerce: (value) => {
      if (value === "true") {
        return 1;
      }

      if (value === "false") {
        return 0;
      }

      return Number(value);
    },
  };
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

function collectTuffDefinitions(allTuff) {
  const definitions = [];
  let pendingPath = undefined;

  for (const item of allTuff) {
    if (Array.isArray(item)) {
      if (
        item.length >= 2 &&
        Array.isArray(item[0]) &&
        typeof item[1] === "string"
      ) {
        definitions.push({ path: item[0], body: item[1] });
        continue;
      }

      if (item.length === 1 && Array.isArray(item[0])) {
        pendingPath = item[0];
        continue;
      }

      const nestedDefinitions = collectTuffDefinitions(item);
      for (const definition of nestedDefinitions) {
        definitions.push(definition);
      }

      continue;
    }

    if (typeof item === "string" && pendingPath !== undefined) {
      definitions.push({ path: pendingPath, body: item });
      pendingPath = undefined;
    }
  }

  return definitions;
}

function findTuffEntrypointBody(entrypointName, definitions) {
  for (const definition of definitions) {
    const { path: functionPath, body } = definition;
    if (
      Array.isArray(functionPath) &&
      functionPath.length === 1 &&
      functionPath[0] === entrypointName &&
      typeof body === "string"
    ) {
      return body;
    }
  }

  return undefined;
}

function buildTuffLibraryExports(definitions, runtime) {
  const libraryBody = findTuffEntrypointBody("lib", definitions);
  if (libraryBody === undefined) {
    return {};
  }

  const compiledLibraryJS = compileTuffLibrarySource(libraryBody);
  const libraryFunction = new Function(
    "__tuff_read",
    "__tuff_coerce",
    compiledLibraryJS,
  );

  return libraryFunction(runtime.read, runtime.coerce);
}

function buildTuffNativeModules(nativeTuff) {
  const nativeDefinitions = collectTuffDefinitions(nativeTuff);
  const nativeModules = {};

  for (const definition of nativeDefinitions) {
    const nativeModuleName = renderModulePath(definition.path);
    const compiledNativeSource = compileTuffNativeSource(definition.body);
    const nativeModuleFunction = new Function(compiledNativeSource);
    nativeModules[nativeModuleName] = nativeModuleFunction();
  }

  return nativeModules;
}

function compileAllTuffSource(source) {
  const trimmed = source.trim();

  const externImport = parseExternImportSource(trimmed);
  if (externImport !== undefined) {
    return externImport;
  }

  const libraryImportCall = parseLibraryImportCall(trimmed);
  if (libraryImportCall !== undefined) {
    return libraryImportCall;
  }

  return compileTuffToJS(trimmed);
}

function compileTuffLibrarySource(source) {
  const trimmed = source.trim();

  const outFunction = parseOutFunctionSource(trimmed);
  if (outFunction !== undefined) {
    return outFunction;
  }

  throw new Error(`Unsupported Tuff library source: ${source}`);
}

function compileTuffNativeSource(source) {
  const trimmed = source.trim();

  const nativeExport = parseNativeExportSource(trimmed);
  if (nativeExport !== undefined) {
    return nativeExport;
  }

  throw new Error(`Unsupported Tuff native source: ${source}`);
}

function parseExternImportSource(statement) {
  const prefix = "let { extern ";
  const declarationSeparator = " } = extern ";

  const parsedSource = parseFunctionSourceNameAndTail(
    statement,
    prefix,
    declarationSeparator,
  );
  if (parsedSource === undefined) {
    return undefined;
  }

  const moduleSeparator = "; extern fn ";
  const callSeparator = "(); ";
  const moduleSeparatorIndex = parsedSource.tail.indexOf(moduleSeparator);
  if (moduleSeparatorIndex <= 0) {
    return undefined;
  }

  const moduleName = parsedSource.tail.slice(0, moduleSeparatorIndex);
  const callTail = parsedSource.tail.slice(
    moduleSeparatorIndex + moduleSeparator.length,
  );
  const callSeparatorIndex = callTail.indexOf(callSeparator);
  if (callSeparatorIndex <= 0) {
    return undefined;
  }

  const importedFunctionName = callTail.slice(0, callSeparatorIndex);
  const callPart = callTail.slice(callSeparatorIndex + callSeparator.length);

  if (
    !isValidModulePath(moduleName) ||
    !isValidIdentifier(importedFunctionName) ||
    importedFunctionName !== parsedSource.functionName ||
    callPart !== `${importedFunctionName}()`
  ) {
    return undefined;
  }

  return `const { ${importedFunctionName} } = externModules[${JSON.stringify(moduleName)}]; return ${importedFunctionName}();`;
}

function parseNativeExportSource(statement) {
  const prefix = "export function ";
  const declarationSeparator = "() { return ";

  const parsedSource = parseFunctionSourceNameAndTail(
    statement,
    prefix,
    declarationSeparator,
  );
  if (parsedSource === undefined || !parsedSource.tail.endsWith("; }")) {
    return undefined;
  }

  const returnExpression = parsedSource.tail.slice(0, -3);
  if (returnExpression.length === 0) {
    return undefined;
  }

  return `return { ${parsedSource.functionName}: function ${parsedSource.functionName}() { return ${returnExpression}; } };`;
}

function parseLibraryImportCall(statement) {
  const prefix = "let { ";
  const declarationSeparator = " } = lib; ";

  const parsedSource = parseFunctionSourceNameAndTail(
    statement,
    prefix,
    declarationSeparator,
  );
  if (
    parsedSource === undefined ||
    parsedSource.tail !== `${parsedSource.functionName}()`
  ) {
    return undefined;
  }

  return `const { ${parsedSource.functionName} } = lib; return ${parsedSource.functionName}();`;
}

function parseOutFunctionSource(statement) {
  const prefix = "out fn ";
  const declarationSeparator = "() => { return read(); }";

  const parsedSource = parseFunctionSourceNameAndTail(
    statement,
    prefix,
    declarationSeparator,
  );
  if (parsedSource === undefined || parsedSource.tail.length !== 0) {
    return undefined;
  }

  return `function ${parsedSource.functionName}() { return __tuff_coerce(__tuff_read()); } return { ${parsedSource.functionName} };`;
}

function parseFunctionSourceNameAndTail(
  statement,
  prefix,
  declarationSeparator,
) {
  if (!statement.startsWith(prefix)) {
    return undefined;
  }

  const declarationSeparatorIndex = statement.indexOf(declarationSeparator);
  if (declarationSeparatorIndex <= prefix.length) {
    return undefined;
  }

  const functionName = statement.slice(
    prefix.length,
    declarationSeparatorIndex,
  );
  if (!isValidIdentifier(functionName)) {
    return undefined;
  }

  const tail = statement.slice(
    declarationSeparatorIndex + declarationSeparator.length,
  );

  return { functionName, tail };
}

function renderModulePath(path) {
  return path.join("::");
}

function isValidModulePath(modulePath) {
  const pathParts = modulePath.split("::");
  if (pathParts.length === 0) {
    return false;
  }

  for (const pathPart of pathParts) {
    if (!isValidIdentifier(pathPart)) {
      return false;
    }
  }

  return true;
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
    return undefined;
  }

  return parseNameAndValue(statement, "");
}

function parseAdditionExpression(statement, boundVariableNames) {
  return parseAdditionParts(statement, (term) => {
    const variableName = term.trim();
    if (!isValidIdentifier(variableName)) {
      return undefined;
    }

    if (!boundVariableNames.includes(variableName)) {
      return undefined;
    }

    return variableName;
  });
}

function parseReadAdditionExpression(statement) {
  return parseAdditionParts(statement, (term) => {
    if (term.trim() !== "read()") {
      return undefined;
    }

    return "__tuff_coerce(__tuff_read())";
  });
}
function parseFunctionReadCall(statement) {
  const prefix = "fn ";
  const declarationSeparator = "() => { return read(); } ";

  const parsedSource = parseFunctionSourceNameAndTail(
    statement,
    prefix,
    declarationSeparator,
  );
  if (
    parsedSource === undefined ||
    parsedSource.tail !== `${parsedSource.functionName}()`
  ) {
    return undefined;
  }

  return `function ${parsedSource.functionName}() { return __tuff_coerce(__tuff_read()); } return ${parsedSource.functionName}();`;
}

function parseFunctionParameterReadCall(statement) {
  const prefix = "fn ";
  const functionParameterSeparator = "(";
  const declarationEndSeparator = ") => { return ";
  const readSuffixSeparator = " + read(); } ";

  if (!statement.startsWith(prefix)) {
    return undefined;
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
    return undefined;
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
    return undefined;
  }

  return renderFunctionCall(
    functionName,
    parameterName,
    callPart,
    `return ${parameterName} + __tuff_coerce(__tuff_read());`,
  );
}

function parseFunctionParameterLocalReadCall(statement) {
  const prefix = "fn ";
  const functionParameterSeparator = "(";
  const functionBodyPrefix = ") => { let ";
  const bodyBindingSeparator = " = ";
  const bodyReadSeparator = " + read(); return ";
  const functionBodySuffix = "; } ";

  if (!statement.startsWith(prefix)) {
    return undefined;
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
    return undefined;
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
    return undefined;
  }

  return renderFunctionCall(
    functionName,
    parameterName,
    callPart,
    `let ${localVariableName} = ${parameterName} + __tuff_coerce(__tuff_read()); return ${localVariableName};`,
  );
}

function renderFunctionCall(functionName, parameterName, callPart, body) {
  const callArgument = parseFunctionCallArgument(functionName, callPart);
  if (callArgument === undefined) {
    return undefined;
  }

  return `function ${functionName}(${parameterName}) { ${body} } return ${functionName}(${callArgument});`;
}

function parseFunctionCallArgument(functionName, callPart) {
  if (!callPart.startsWith(`${functionName}(`) || !callPart.endsWith(")")) {
    return undefined;
  }

  const callArgument = callPart.slice(functionName.length + 1, -1);
  if (callArgument.length === 0) {
    return undefined;
  }

  return callArgument;
}

function parseAdditionParts(statement, parseTerm) {
  const terms = statement.split("+");

  if (terms.length < 2) {
    return undefined;
  }

  const parsedTerms = [];

  for (const term of terms) {
    const parsedTerm = parseTerm(term);
    if (parsedTerm === undefined) {
      return undefined;
    }

    parsedTerms.push(parsedTerm);
  }

  return parsedTerms.join(" + ");
}

function parseNameAndValue(statement, prefix) {
  const equalsSeparator = " = ";
  if (!statement.startsWith(prefix)) {
    return undefined;
  }

  const separatorIndex = statement.indexOf(equalsSeparator);
  if (separatorIndex <= prefix.length) {
    return undefined;
  }

  const variableName = statement.slice(prefix.length, separatorIndex);
  const initialValue = statement.slice(separatorIndex + equalsSeparator.length);

  if (!isValidIdentifier(variableName)) {
    return undefined;
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
