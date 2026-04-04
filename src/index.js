import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const __tuff_builtin_require = createRequire(import.meta.url);

export function compileTuffToJS(source) {
  const trimmed = source.trim();

  const multiLineSource = parseMultiLineSource(trimmed);
  if (multiLineSource !== undefined) {
    return multiLineSource;
  }

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

  const readEqualityExpression = parseReadEqualityExpression(trimmed);
  if (readEqualityExpression !== undefined) {
    return `return ${readEqualityExpression};`;
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
  const func = new Function(
    "__tuff_read",
    "__tuff_coerce",
    "__tuff_require",
    "__tuff_import_meta_url",
    compiledJS,
  );
  return func(
    runtime.read,
    runtime.coerce,
    __tuff_builtin_require,
    import.meta.url,
  );
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
    "__tuff_require",
    "__tuff_import_meta_url",
    compiledJS,
  );
  return func(
    libExports,
    externModules,
    runtime.read,
    runtime.coerce,
    __tuff_builtin_require,
    import.meta.url,
  );
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
  const libraryExports = {};

  for (const definition of definitions) {
    const trimmedBody = definition.body.trim();
    if (!trimmedBody.startsWith("out fn ")) {
      continue;
    }

    const compiledLibraryJS = compileTuffLibrarySource(definition.body);
    const libraryFunction = new Function(
      "__tuff_read",
      "__tuff_coerce",
      compiledLibraryJS,
    );

    libraryExports[renderModulePath(definition.path)] = libraryFunction(
      runtime.read,
      runtime.coerce,
    );
  }

  return libraryExports;
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
  const moduleImportSource = parseModuleImportSource(
    parsedSource,
    moduleSeparator,
  );
  if (moduleImportSource === undefined) {
    return undefined;
  }

  const { moduleName, callTail } = moduleImportSource;
  const callSeparator = "(); ";
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
  const declarationSeparator = " } = ";

  const parsedSource = parseFunctionSourceNameAndTail(
    statement,
    prefix,
    declarationSeparator,
  );
  if (parsedSource === undefined) {
    return undefined;
  }

  const moduleSeparator = "; ";
  const moduleImportSource = parseModuleImportSource(
    parsedSource,
    moduleSeparator,
  );
  if (moduleImportSource === undefined) {
    return undefined;
  }

  const { moduleName, callTail: callPart } = moduleImportSource;

  if (
    !isValidModulePath(moduleName) ||
    callPart !== `${parsedSource.functionName}()`
  ) {
    return undefined;
  }

  return `const { ${parsedSource.functionName} } = lib[${JSON.stringify(moduleName)}]; return ${parsedSource.functionName}();`;
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

function parseModuleImportSource(parsedSource, moduleSeparator) {
  const moduleSeparatorIndex = parsedSource.tail.indexOf(moduleSeparator);
  if (moduleSeparatorIndex <= 0) {
    return undefined;
  }

  return {
    moduleName: parsedSource.tail.slice(0, moduleSeparatorIndex),
    callTail: parsedSource.tail.slice(
      moduleSeparatorIndex + moduleSeparator.length,
    ),
  };
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
function parseMultiLineSource(source) {
  if (!source.includes("\n")) {
    return undefined;
  }

  const blocks = splitIntoBlocks(source);
  if (blocks.length < 2) {
    return undefined;
  }

  const finalBlock = blocks[blocks.length - 1];
  const functionBlocks = blocks.slice(0, -1);

  const compiledFunctions = [];
  for (const block of functionBlocks) {
    const compiled =
      parseMultiLineFunctionDefinition(block) ??
      parseExternNodeImportBlock(block) ??
      parseExternFnDeclarationBlock(block) ??
      parseLetFunctionCallBlock(block);
    if (compiled === undefined) {
      return undefined;
    }
    compiledFunctions.push(compiled);
  }

  const finalCompiled = compileTuffToJS(finalBlock);
  const nonEmpty = compiledFunctions.filter((s) => s.length > 0);
  return [...nonEmpty, finalCompiled].join(" ");
}

function parseExternNodeImportBlock(block) {
  const prefix = "let { extern ";
  const separator = " } = extern ";
  const suffix = ";";

  const lines = block.split("\n");
  const compiledLines = [];

  for (const line of lines) {
    if (!line.startsWith(prefix) || !line.endsWith(suffix)) {
      return undefined;
    }

    const inner = line.slice(prefix.length, -suffix.length);
    const separatorIndex = inner.indexOf(separator);
    if (separatorIndex <= 0) {
      return undefined;
    }

    const importedName = inner.slice(0, separatorIndex);
    const modulePath = inner.slice(separatorIndex + separator.length);
    const importedNames = importedName.split(", extern ");

    if (
      importedNames.some((name) => !isValidIdentifier(name)) ||
      !isValidModulePath(modulePath)
    ) {
      return undefined;
    }

    const requirePath = modulePath.split("::").join(":");
    compiledLines.push(
      `const { ${importedNames.join(", ")} } = __tuff_require(${JSON.stringify(requirePath)});`,
    );
  }

  if (compiledLines.length === 0) {
    return undefined;
  }

  return compiledLines.join(" ");
}

function stripBlockWrapper(block, prefix) {
  const suffix = ";";
  if (!block.startsWith(prefix) || !block.endsWith(suffix)) {
    return undefined;
  }

  return block.slice(prefix.length, -suffix.length);
}

function parseFunctionCallExpression(str) {
  const parenOpenIndex = str.indexOf("(");
  const parenCloseIndex = str.lastIndexOf(")");

  if (parenOpenIndex <= 0 || parenCloseIndex !== str.length - 1) {
    return undefined;
  }

  const fnName = str.slice(0, parenOpenIndex);
  if (!isValidIdentifier(fnName)) {
    return undefined;
  }

  return { fnName, argsStr: str.slice(parenOpenIndex + 1, parenCloseIndex) };
}

function parseExternFnDeclarationBlock(block) {
  const inner = stripBlockWrapper(block, "extern fn ");
  if (inner === undefined) {
    return undefined;
  }

  const call = parseFunctionCallExpression(inner);
  if (call === undefined) {
    return undefined;
  }

  if (call.argsStr.length > 0) {
    const params = call.argsStr.split(", ");
    if (params.some((p) => !isValidIdentifier(p.trim()))) {
      return undefined;
    }
  }

  return "";
}

function compileFunctionCallArgument(expr) {
  if (expr === "import.meta.url") {
    return "__tuff_import_meta_url";
  }

  if (isValidIdentifier(expr)) {
    return expr;
  }

  return undefined;
}

function parseLetFunctionCallBlock(block) {
  const inner = stripBlockWrapper(block, "let ");
  if (inner === undefined) {
    return undefined;
  }

  const equalsSeparator = " = ";
  const equalsIndex = inner.indexOf(equalsSeparator);

  if (equalsIndex <= 0) {
    return undefined;
  }

  const variableName = inner.slice(0, equalsIndex);
  if (!isValidIdentifier(variableName)) {
    return undefined;
  }

  const callExpr = inner.slice(equalsIndex + equalsSeparator.length);
  const call = parseFunctionCallExpression(callExpr);
  if (call === undefined) {
    return undefined;
  }

  const compiledArg = compileFunctionCallArgument(call.argsStr);
  if (compiledArg === undefined) {
    return undefined;
  }

  return `const ${variableName} = ${call.fnName}(${compiledArg});`;
}

function splitIntoBlocks(source) {
  const lines = source.split("\n");
  const blocks = [];
  let currentLines = [];

  for (const line of lines) {
    if (line.trim().length === 0) {
      if (currentLines.length > 0) {
        blocks.push(currentLines.join("\n"));
        currentLines = [];
      }
    } else {
      const trimmedLine = line.endsWith("\r") ? line.slice(0, -1) : line;
      currentLines.push(trimmedLine);
    }
  }

  if (currentLines.length > 0) {
    blocks.push(currentLines.join("\n"));
  }

  return blocks;
}

function parseMultiLineFunctionDefinition(block) {
  const lines = block.split("\n").map((line) => line.trim());
  const nonEmptyLines = lines.filter((line) => line.length > 0);

  if (nonEmptyLines.length < 2) {
    return undefined;
  }

  const firstLine = nonEmptyLines[0];
  const lastLine = nonEmptyLines[nonEmptyLines.length - 1];
  const bodyLines = nonEmptyLines.slice(1, -1);

  if (lastLine !== "}") {
    return undefined;
  }

  const funcPrefix = "fn ";
  const funcSuffix = "() => {";

  if (!firstLine.startsWith(funcPrefix) || !firstLine.endsWith(funcSuffix)) {
    return undefined;
  }

  const functionName = firstLine.slice(
    funcPrefix.length,
    firstLine.length - funcSuffix.length,
  );

  if (!isValidIdentifier(functionName)) {
    return undefined;
  }

  const compiledBody = parseMultiLineFunctionBody(bodyLines);
  if (compiledBody === undefined) {
    return undefined;
  }

  return `function ${functionName}() { ${compiledBody} }`;
}

function parseMultiLineFunctionBody(bodyLines) {
  if (bodyLines.length === 0) {
    return undefined;
  }

  const compiledStatements = [];
  for (const line of bodyLines) {
    const compiled = parseMultiLineFunctionBodyStatement(line);
    if (compiled === undefined) {
      return undefined;
    }
    compiledStatements.push(compiled);
  }

  return compiledStatements.join(" ");
}

function parseMultiLineFunctionBodyStatement(statement) {
  const returnPrefix = "return ";
  const returnSuffix = ";";

  if (
    !statement.startsWith(returnPrefix) ||
    !statement.endsWith(returnSuffix)
  ) {
    return undefined;
  }

  const expr = statement
    .slice(returnPrefix.length, -returnSuffix.length)
    .trim();
  const compiledExpr = parseBodyExpression(expr);

  if (compiledExpr === undefined) {
    return undefined;
  }

  return `return ${compiledExpr};`;
}

function parseBodyExpression(expr) {
  if (expr === "read()") {
    return "__tuff_coerce(__tuff_read())";
  }

  if (expr.length > 0 && !Number.isNaN(Number(expr))) {
    return expr;
  }

  return undefined;
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

function parseBinaryParts(statement, separator, parseTerm) {
  const terms = statement.split(separator);

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

  return parsedTerms;
}

function parseAdditionParts(statement, parseTerm) {
  const parts = parseBinaryParts(statement, "+", parseTerm);
  if (parts === undefined) {
    return undefined;
  }

  return parts.join(" + ");
}

function parseReadEqualityExpression(statement) {
  const parts = parseBinaryParts(statement, " == ", (term) => {
    if (term.trim() !== "read()") {
      return undefined;
    }

    return "__tuff_read()";
  });

  if (parts === undefined) {
    return undefined;
  }

  if (parts.length === 2) {
    return `Number(${parts[0]} === ${parts[1]})`;
  }

  return `Number([${parts.join(", ")}].every((v, i, a) => i === 0 || v === a[i - 1]))`;
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

export function buildBundleSource(compiledBody) {
  return [
    'import { createInterface } from "node:readline";',
    'import { createRequire } from "node:module";',
    "",
    "const __tuff_require = createRequire(import.meta.url);",
    "",
    "function __tuff_tokenize(input) {",
    "  const str = String(input).trim();",
    "  if (str.length === 0) {",
    "    return [];",
    "  }",
    "",
    "  const tokens = [];",
    '  let current = "";',
    "",
    "  for (const ch of str) {",
    '    if (ch.trim() === "") {',
    "      if (current.length > 0) {",
    "        tokens.push(current);",
    '        current = "";',
    "      }",
    "    } else {",
    "      current += ch;",
    "    }",
    "  }",
    "",
    "  if (current.length > 0) {",
    "    tokens.push(current);",
    "  }",
    "",
    "  return tokens;",
    "}",
    "",
    "function __tuff_coerce(value) {",
    '  if (value === "true") {',
    "    return 1;",
    "  }",
    "",
    '  if (value === "false") {',
    "    return 0;",
    "  }",
    "",
    "  return Number(value);",
    "}",
    "",
    "const rl = createInterface({ input: process.stdin, terminal: false });",
    "const lines = [];",
    'rl.on("line", (line) => lines.push(line));',
    'rl.on("close", () => {',
    '  const __tokens = __tuff_tokenize(lines.join("\\n"));',
    "  let __tokenIndex = 0;",
    "  const __tuff_read = () => __tokens[__tokenIndex++];",
    "  const __result = ((__tuff_read, __tuff_coerce, __tuff_require, __tuff_import_meta_url) => {",
    `    ${compiledBody}`,
    "  })(__tuff_read, __tuff_coerce, __tuff_require, import.meta.url);",
    '  process.stdout.write(String(__result) + "\\n");',
    "});",
  ].join("\n");
}

if (import.meta.main) {
  const tuffSource = readFileSync(
    new URL("main.tuff", import.meta.url),
    "utf8",
  );
  const compiledBody = compileTuffToJS(tuffSource);
  const bundleSource = buildBundleSource(compiledBody);
  mkdirSync(new URL("../dist", import.meta.url), { recursive: true });
  writeFileSync(new URL("../dist/bundle.js", import.meta.url), bundleSource);
}
