export function compile(source) {
  const trimmedSource = source.trim();

  if (trimmedSource === "") {
    return "return 0;";
  }

  const statements = parseStatements(trimmedSource);
  return compileStatements(statements, [], true);
}

export function interpret(source, globals = {}) {
  return runWithGlobals(globals, () => {
    return new Function(compile(source))();
  });
}

export function interpretAll(entryModuleName, modules, jsModules = {}) {
  const moduleExports = {};

  Object.keys(modules).reduce((_, moduleName) => {
    if (moduleName === entryModuleName) {
      return moduleExports;
    }

    const source = modules[moduleName] ?? "";
    const trimmedSource = source.trim();

    if (trimmedSource === "") {
      moduleExports[moduleName] = {};
      return moduleExports;
    }

    const statements = parseStatements(trimmedSource);
    const moduleOutput = compileStatements(statements, [], false, "__exports");

    moduleExports[moduleName] = runWithGlobals(moduleExports, () => {
      return new Function(`const __exports = {};
${moduleOutput}
return __exports;`)();
    });
    return moduleExports;
  }, moduleExports);

  const jsModuleExports = evaluateJsModules(jsModules, moduleExports);

  Object.keys(jsModuleExports).reduce((_, name) => {
    moduleExports[name] = jsModuleExports[name];
    return moduleExports;
  }, moduleExports);

  const entrySource = modules[entryModuleName] ?? "";
  return interpret(entrySource, moduleExports);
}

function evaluateJsModules(jsModules, otherModules) {
  const result = {};

  Object.keys(jsModules).reduce((_, moduleName) => {
    const source = jsModules[moduleName] ?? "";
    const trimmedSource = source.trim();

    if (trimmedSource === "") {
      result[moduleName] = {};
      return result;
    }

    const allModules = Object.keys(otherModules).reduce((acc, key) => {
      acc[key] = otherModules[key];
      return acc;
    }, {});

    Object.keys(result).reduce((acc, key) => {
      acc[key] = result[key];
      return acc;
    }, allModules);

    result[moduleName] = evaluateJsModuleSource(trimmedSource, allModules);
    return result;
  }, result);

  return result;
}

function evaluateJsModuleSource(source, otherModules) {
  const exportedNames = [];
  const importStatements = [];
  let remaining = source;

  remaining = extractJsImports(remaining, importStatements);
  remaining = extractJsExports(remaining, exportedNames);

  let fnBody = buildJsImportCode(importStatements);
  fnBody += remaining;
  fnBody += "\n";

  fnBody = exportedNames.reduce(
    (body, name) => body + "__exports." + name + " = " + name + ";\n",
    fnBody,
  );

  const moduleExports = {};
  const fn = new Function("__exports", "__importedModules", fnBody);
  fn(moduleExports, otherModules);

  return moduleExports;
}

function scanAndStrip(source, keyword, onMatch) {
  return scanAndStripFrom(source, keyword, onMatch, 0, "");
}

function scanAndStripFrom(source, keyword, onMatch, pos, result) {
  if (pos >= source.length) {
    return result;
  }

  const atWordBoundary = pos === 0 || isWhitespace(source[pos - 1]);

  if (atWordBoundary && source.slice(pos, pos + keyword.length) === keyword) {
    return scanAndStripFrom(
      source,
      keyword,
      onMatch,
      onMatch(source, pos),
      result,
    );
  }

  return scanAndStripFrom(
    source,
    keyword,
    onMatch,
    pos + 1,
    result + source[pos],
  );
}

function extractJsImports(source, importStatements) {
  return scanAndStrip(source, "import ", (src, pos) => {
    const semiPos = src.indexOf(";", pos);
    const end = semiPos === -1 ? src.length : semiPos + 1;
    importStatements.push(src.slice(pos, end).trim());
    return end;
  });
}

function extractJsExports(source, exportedNames) {
  return scanAndStrip(source, "export function ", (src, pos) => {
    const nameStart = pos + 16;
    const nameEnd = advanceIdentifierEnd(src, nameStart);

    exportedNames.push(src.slice(nameStart, nameEnd));
    return pos + 7;
  });
}

function advanceIdentifierEnd(source, pos) {
  if (pos >= source.length || !isIdentifierChar(source[pos])) {
    return pos;
  }

  return advanceIdentifierEnd(source, pos + 1);
}

function buildJsImportCode(importStatements) {
  return importStatements.reduce((code, stmt) => {
    const fromIndex = stmt.indexOf(" from ");

    if (fromIndex === -1) {
      return code;
    }

    let rawRef = stmt.slice(fromIndex + 6).trim();

    if (rawRef.length > 0 && rawRef[rawRef.length - 1] === ";") {
      rawRef = rawRef.slice(0, -1).trim();
    }

    const moduleName = stripLeadingDotSlash(stripQuotes(rawRef));
    const namesRaw = stmt.slice(stmt.indexOf("{") + 1, stmt.indexOf("}"));

    return namesRaw
      .split(",")
      .map((s) => s.trim())
      .reduce((nextCode, name) => {
        if (name === "") {
          return nextCode;
        }

        return (
          nextCode +
          "const " +
          name +
          " = __importedModules." +
          moduleName +
          "." +
          name +
          ";\n"
        );
      }, code);
  }, "");
}

function stripQuotes(str) {
  let result = str;

  if (result.length > 0 && (result[0] === '"' || result[0] === "'")) {
    result = result.slice(1);
  }

  if (
    result.length > 0 &&
    (result[result.length - 1] === '"' || result[result.length - 1] === "'")
  ) {
    result = result.slice(0, -1);
  }

  return result;
}

function stripLeadingDotSlash(str) {
  if (str.length >= 2 && str[0] === "." && str[1] === "/") {
    return str.slice(2);
  }

  return str;
}

function runWithGlobals(globals, runner) {
  const previousGlobals = Object.entries(globals).reduce(
    (acc, [name, value]) => {
      acc.push([
        name,
        Object.prototype.hasOwnProperty.call(globalThis, name)
          ? { exists: true, value: globalThis[name] }
          : { exists: false },
      ]);
      globalThis[name] = value;
      return acc;
    },
    [],
  );

  try {
    return runner();
  } finally {
    restoreGlobals(previousGlobals, 0);
  }
}

function restoreGlobals(previousGlobals, index) {
  if (index >= previousGlobals.length) {
    return;
  }

  const [name, previousValue] = previousGlobals[index];

  if (previousValue.exists) {
    globalThis[name] = previousValue.value;
  } else {
    delete globalThis[name];
  }

  restoreGlobals(previousGlobals, index + 1);
}

function compileStatements(
  statements,
  declaredVariables,
  returnLastExpression,
  exportTarget = null,
) {
  return statements.reduce((output, statement, index) => {
    const shouldReturnExpression =
      returnLastExpression && index === statements.length - 1;

    return (
      output +
      compileStatement(
        statement,
        declaredVariables,
        shouldReturnExpression,
        exportTarget,
      )
    );
  }, "");
}

function compileStatement(
  statement,
  declaredVariables,
  shouldReturnExpression = false,
  exportTarget = null,
) {
  if (statement.type === "assignment") {
    const { name, value } = statement;

    if (isDestructuringPattern(name)) {
      const boundNames = extractDestructuredNames(name);
      const compiledValue = compileDestructuringRhsValue(value);
      const jsPattern = normalizeDestructuringPattern(name);
      const externNames = extractExternDestructuredNames(name);

      if (externNames.length > 0) {
        return externNames.reduce(
          (output, externName) =>
            output +
            `globalThis.${externName} = ${compiledValue}.${externName};\n`,
          "",
        );
      }

      const shouldDeclare =
        boundNames.length === 0 ||
        boundNames.some((boundName) => !declaredVariables.includes(boundName));

      if (shouldDeclare) {
        boundNames
          .filter((boundName) => !declaredVariables.includes(boundName))
          .reduce((_, boundName) => {
            declaredVariables.push(boundName);
            return declaredVariables;
          }, declaredVariables);

        return `let ${jsPattern} = ${compiledValue};\n`;
      }

      return `(${jsPattern} = ${compiledValue});\n`;
    }

    const compiledValue = compileAssignedValue(value);

    if (declaredVariables.includes(name)) {
      return `${name} = ${compiledValue};\n`;
    }

    declaredVariables.push(name);
    return `let ${name} = ${compiledValue};\n`;
  }

  if (statement.type === "if") {
    return compileIfStatement(statement, declaredVariables, exportTarget);
  }

  if (statement.type === "function") {
    return compileFunctionStatement(statement);
  }

  if (statement.type === "outFunction") {
    const functionOutput = compileFunctionStatement(statement);

    if (exportTarget === null) {
      return functionOutput;
    }

    return `${functionOutput}${exportTarget}.${statement.name} = ${statement.name};\n`;
  }

  if (statement.type === "externFunction") {
    return compileExternFunctionStatement(statement);
  }

  if (statement.type === "block") {
    return compileStatements(
      statement.body,
      declaredVariables,
      false,
      exportTarget,
    );
  }

  if (statement.type === "return") {
    return `return ${compileValue(statement.value)};\n`;
  }

  if (statement.type === "expression" && shouldReturnExpression) {
    return `return ${compileValue(statement.value)};`;
  }

  return "";
}

function compileIfStatement(statement, declaredVariables, exportTarget) {
  const { condition, body } = statement;
  const bodyOutput = compileStatements(
    body,
    declaredVariables,
    false,
    exportTarget,
  );

  return `if (Number(${condition})) {\n${bodyOutput}}\n`;
}

function compileFunctionStatement(statement) {
  const { name, params, body } = statement;
  const functionDeclaredVariables = [...params];
  const bodyOutput = compileStatements(body, functionDeclaredVariables, false);

  if (params[0] === "this") {
    return `Object.prototype.${name} = function(${params.slice(1).join(", ")}) {\n${bodyOutput}};\n`;
  }

  return `function ${name}(${params.join(", ")}) {\n${bodyOutput}}\n`;
}

function compileExternFunctionStatement(statement) {
  const { name, params } = statement;

  if (params[0] !== "this") {
    return "";
  }

  const forwardedParams = params.slice(1);
  const forwardedArgs =
    forwardedParams.length === 0
      ? "this"
      : `this, ${forwardedParams.join(", ")}`;

  return `Object.prototype.${name} = function(${forwardedParams.join(", ")}) {
return globalThis.${name}(${forwardedArgs});
};
`;
}
function compileValue(value) {
  if (value.startsWith("{")) {
    return value;
  }

  return `Number(${formatValueCharacters(value, 0, "")})`;
}

function formatValueCharacters(value, index, formattedValue) {
  if (index >= value.length) {
    return formattedValue;
  }

  if (value[index] === ".") {
    const prevChar = index > 0 ? value[index - 1] : "";
    const nextChar = index < value.length - 1 ? value[index + 1] : "";

    const isPrevDigit = prevChar >= "0" && prevChar <= "9";
    const isNextLetter =
      (nextChar >= "a" && nextChar <= "z") ||
      (nextChar >= "A" && nextChar <= "Z") ||
      nextChar === "_";

    if (isPrevDigit && isNextLetter) {
      return formatValueCharacters(value, index + 1, formattedValue + " .");
    }
  }

  return formatValueCharacters(value, index + 1, formattedValue + value[index]);
}

function compileAssignedValue(value) {
  if (value.startsWith("[")) {
    return value;
  }

  if (value.startsWith('"') || value.startsWith("'")) {
    return value;
  }

  if (isExternExpression(value)) {
    return compileExternExpression(value);
  }

  return compileValue(value);
}

function compileDestructuringRhsValue(value) {
  if (isExternExpression(value)) {
    return compileExternExpression(value);
  }

  return value;
}

function isExternExpression(value) {
  const trimmed = value.trim();
  return trimmed.startsWith("extern ") && !trimmed.startsWith("extern fn ");
}

function compileExternExpression(value) {
  const name = value.trim().slice("extern ".length).trim();
  return `globalThis.${name}`;
}

function isDestructuringPattern(name) {
  return name.startsWith("{") && name.endsWith("}");
}

function destructuringPartBinding(trimmedPart) {
  const colonIndex = trimmedPart.indexOf(":");

  if (colonIndex !== -1) {
    return trimmedPart.slice(colonIndex + 1).trim();
  }

  const spaceIndex = trimmedPart.indexOf(" ");

  if (spaceIndex !== -1) {
    return trimmedPart.slice(spaceIndex + 1).trim();
  }

  return trimmedPart;
}

function normalizeDestructuringPattern(pattern) {
  const inner = pattern.slice(1, -1).trim();

  if (inner === "") {
    return "{}";
  }

  const parts = inner.split(",").map((part) => {
    const trimmedPart = part.trim();
    const binding = destructuringPartBinding(trimmedPart);

    if (binding === trimmedPart) {
      return trimmedPart;
    }

    let keyEnd = trimmedPart.length - binding.length;

    keyEnd = trimTrailingDestructuringKey(trimmedPart, keyEnd);

    const key = trimmedPart.slice(0, keyEnd);
    return key + ": " + binding;
  });

  return "{ " + parts.join(", ") + " }";
}

function extractDestructuredNames(pattern) {
  const inner = pattern.slice(1, -1).trim();

  if (inner === "") {
    return [];
  }

  return inner.split(",").map((part) => destructuringPartBinding(part.trim()));
}

function trimTrailingDestructuringKey(part, keyEnd) {
  if (keyEnd <= 0 || (part[keyEnd - 1] !== ":" && part[keyEnd - 1] !== " ")) {
    return keyEnd;
  }

  return trimTrailingDestructuringKey(part, keyEnd - 1);
}

function extractExternDestructuredNames(pattern) {
  const inner = pattern.slice(1, -1).trim();

  if (inner === "") {
    return [];
  }

  return inner.split(",").reduce((result, part) => {
    const trimmedPart = part.trim();
    const spaceIndex = trimmedPart.indexOf(" ");

    if (spaceIndex !== -1) {
      const keyword = trimmedPart.slice(0, spaceIndex).trim();

      if (keyword === "extern") {
        result.push(trimmedPart.slice(spaceIndex + 1).trim());
      }
    }
    return result;
  }, []);
}

function parseStatements(source) {
  return parseStatementsFrom(source, 0, []);
}

function parseStatementsFrom(source, pos, statements) {
  pos = skipWhitespace(source, pos);

  if (pos >= source.length) {
    return statements;
  }

  if (isKeywordAt(source, pos, "out")) {
    const { statement, endPos } = parseOutFunctionStatement(source, pos);
    statements.push(statement);
    return parseStatementsFrom(source, endPos, statements);
  }

  if (isKeywordAt(source, pos, "extern")) {
    const { statement, endPos } = parseExternFunctionStatement(source, pos);
    statements.push(statement);
    return parseStatementsFrom(source, endPos, statements);
  }

  if (isKeywordAt(source, pos, "fn")) {
    const { statement, endPos } = parseFunctionStatement(source, pos);
    statements.push(statement);
    return parseStatementsFrom(source, endPos, statements);
  }

  if (isKeywordAt(source, pos, "if")) {
    const { statement, endPos } = parseIfStatement(source, pos);
    statements.push(statement);
    return parseStatementsFrom(source, endPos, statements);
  }

  if (source[pos] === "{") {
    if (looksLikeBraceAssignment(source, pos)) {
      return parseAndContinueSimpleStatement(source, pos, statements);
    }

    if (looksLikeObjectLiteralExpression(source, pos)) {
      return parseAndContinueSimpleStatement(source, pos, statements);
    }

    const { body, endPos } = parseBlock(source, pos);
    statements.push({ type: "block", body });
    return parseStatementsFrom(source, endPos, statements);
  }

  if (isKeywordAt(source, pos, "return")) {
    const { statement, endPos } = parseReturnStatement(source, pos);
    statements.push(statement);
    return parseStatementsFrom(source, endPos, statements);
  }

  const { statement, endPos } = parseSimpleStatement(source, pos);
  statements.push(statement);
  return parseStatementsFrom(source, endPos, statements);
}

function parseAndContinueSimpleStatement(source, pos, statements) {
  const { statement, endPos } = parseSimpleStatement(source, pos);
  statements.push(statement);
  return parseStatementsFrom(source, endPos, statements);
}

function parseIfStatement(source, startPos) {
  let pos = startPos + 2;
  pos = skipWhitespace(source, pos);

  if (source[pos] !== "(") {
    return parseSimpleStatement(source, startPos);
  }

  pos += 1;

  const conditionStart = pos;
  pos = advancePastMatchingParen(source, pos, 1);

  const condition = source.slice(conditionStart, pos - 1).trim();
  pos = skipWhitespace(source, pos);

  if (source[pos] !== "{") {
    return parseSimpleStatement(source, startPos);
  }

  const block = parseBlock(source, pos);

  return {
    statement: { type: "if", condition, body: block.body },
    endPos: block.endPos,
  };
}

function advancePastMatchingParen(source, pos, depth) {
  if (pos >= source.length || depth === 0) {
    return pos;
  }

  const nextDepth =
    source[pos] === "(" ? depth + 1 : source[pos] === ")" ? depth - 1 : depth;

  return advancePastMatchingParen(source, pos + 1, nextDepth);
}

function parseExternFunctionStatement(source, startPos) {
  let pos = startPos + 6;
  pos = skipWhitespace(source, pos);

  if (!isKeywordAt(source, pos, "fn")) {
    return parseSimpleStatement(source, startPos);
  }

  const signature = parseFunctionSignature(source, pos);

  if (signature === null) {
    return parseSimpleStatement(source, startPos);
  }

  pos = skipWhitespace(source, signature.endPos);

  if (source[pos] === ";") {
    pos += 1;
  }

  return {
    statement: {
      type: "externFunction",
      name: signature.name,
      params: signature.params,
    },
    endPos: pos,
  };
}

function parseOutFunctionStatement(source, startPos) {
  let pos = startPos + 3;
  pos = skipWhitespace(source, pos);

  if (!isKeywordAt(source, pos, "fn")) {
    return parseSimpleStatement(source, startPos);
  }

  const parsedFunction = parseFunctionStatement(source, pos);

  if (parsedFunction.statement.type !== "function") {
    return parseSimpleStatement(source, startPos);
  }

  return {
    statement: {
      type: "outFunction",
      name: parsedFunction.statement.name,
      params: parsedFunction.statement.params,
      body: parsedFunction.statement.body,
    },
    endPos: parsedFunction.endPos,
  };
}

function parseFunctionStatement(source, startPos) {
  const signature = parseFunctionSignature(source, startPos);

  if (signature === null) {
    return parseSimpleStatement(source, startPos);
  }

  let pos = skipWhitespace(source, signature.endPos);

  if (source[pos] !== "=" || source[pos + 1] !== ">") {
    return parseSimpleStatement(source, startPos);
  }

  pos += 2;
  pos = skipWhitespace(source, pos);

  if (source[pos] !== "{") {
    return parseSimpleStatement(source, startPos);
  }

  const { body, endPos } = parseBlock(source, pos);

  return {
    statement: {
      type: "function",
      name: signature.name,
      params: signature.params,
      body,
    },
    endPos,
  };
}

function parseFunctionSignature(source, startPos) {
  let pos = startPos + 2;
  pos = skipWhitespace(source, pos);

  const nameStart = pos;

  pos = advanceIdentifierEnd(source, pos);

  const name = source.slice(nameStart, pos).trim();

  if (name === "") {
    return null;
  }

  pos = skipWhitespace(source, pos);

  if (source[pos] !== "(") {
    return null;
  }

  pos += 1;

  const paramsStart = pos;

  pos = advanceToChar(source, pos, ")");

  if (source[pos] !== ")") {
    return null;
  }

  pos += 1;

  const paramsSource = source.slice(paramsStart, pos - 1);
  const params = splitParameters(paramsSource);

  return { name, params, endPos: pos };
}

function advanceToChar(source, pos, target) {
  if (pos >= source.length || source[pos] === target) {
    return pos;
  }

  return advanceToChar(source, pos + 1, target);
}

function parseReturnStatement(source, startPos) {
  const { text: value, endPos } = scanUntilStatementEnd(source, startPos + 6);
  return { statement: { type: "return", value }, endPos };
}

function parseSimpleStatement(source, startPos) {
  const { text: statementText, endPos } = scanUntilStatementEnd(
    source,
    startPos,
  );

  const equalsIndex = findAssignmentOperator(statementText);

  if (equalsIndex !== -1) {
    const name = statementText.slice(0, equalsIndex).trim();
    const value = statementText.slice(equalsIndex + 1).trim();

    return { statement: { type: "assignment", name, value }, endPos };
  }

  return {
    statement: { type: "expression", value: statementText },
    endPos,
  };
}

function scanUntilStatementEnd(source, startPos) {
  return scanUntilStatementEndFrom(source, startPos, startPos, 0, 0);
}

function scanUntilStatementEndFrom(
  source,
  startPos,
  pos,
  braceDepth,
  parenDepth,
) {
  if (
    pos >= source.length ||
    (source[pos] === ";" && braceDepth === 0 && parenDepth === 0)
  ) {
    const text = source.slice(startPos, pos).trim();
    let endPos = pos;

    if (
      pos < source.length &&
      (source[pos] === ";" || source[pos] === "{" || source[pos] === "}")
    ) {
      endPos += 1;
    }

    return { text, endPos };
  }

  if (source[pos] === "{") {
    return scanUntilStatementEndFrom(
      source,
      startPos,
      pos + 1,
      braceDepth + 1,
      parenDepth,
    );
  }

  if (source[pos] === "}" && braceDepth > 0) {
    return scanUntilStatementEndFrom(
      source,
      startPos,
      pos + 1,
      braceDepth - 1,
      parenDepth,
    );
  }

  if (source[pos] === "(") {
    return scanUntilStatementEndFrom(
      source,
      startPos,
      pos + 1,
      braceDepth,
      parenDepth + 1,
    );
  }

  if (source[pos] === ")" && parenDepth > 0) {
    return scanUntilStatementEndFrom(
      source,
      startPos,
      pos + 1,
      braceDepth,
      parenDepth - 1,
    );
  }

  return scanUntilStatementEndFrom(
    source,
    startPos,
    pos + 1,
    braceDepth,
    parenDepth,
  );
}

function parseBlock(source, startPos) {
  let pos = advancePastMatchingBrace(source, startPos + 1, 1);

  const blockSource = source.slice(startPos + 1, pos - 1);
  const body = parseStatements(blockSource);

  pos = skipWhitespace(source, pos);

  if (source[pos] === ";") {
    pos += 1;
  }

  return { body, endPos: pos };
}

function advancePastMatchingBrace(source, pos, depth) {
  if (pos >= source.length || depth === 0) {
    return pos;
  }

  const nextDepth =
    source[pos] === "{" ? depth + 1 : source[pos] === "}" ? depth - 1 : depth;

  return advancePastMatchingBrace(source, pos + 1, nextDepth);
}

function skipWhitespace(source, startPos) {
  return skipWhitespaceFrom(source, startPos);
}

function skipWhitespaceFrom(source, pos) {
  if (pos >= source.length || !isWhitespace(source[pos])) {
    return pos;
  }

  return skipWhitespaceFrom(source, pos + 1);
}

function isWhitespace(char) {
  return char === " " || char === "\t" || char === "\n" || char === "\r";
}

function findMatchingBraceIndex(source, startPos) {
  return findMatchingBraceIndexFrom(source, startPos + 1, 1);
}

function findMatchingBraceIndexFrom(source, pos, braceDepth) {
  if (pos >= source.length) {
    return -1;
  }

  if (source[pos] === "{") {
    return findMatchingBraceIndexFrom(source, pos + 1, braceDepth + 1);
  }

  if (source[pos] === "}") {
    if (braceDepth === 1) {
      return pos;
    }

    return findMatchingBraceIndexFrom(source, pos + 1, braceDepth - 1);
  }

  return findMatchingBraceIndexFrom(source, pos + 1, braceDepth);
}

function looksLikeObjectLiteralExpression(source, startPos) {
  const closeBraceIndex = findMatchingBraceIndex(source, startPos);

  if (closeBraceIndex === -1) {
    return false;
  }

  let pos = startPos + 1;
  return containsTopLevelObjectColon(source, pos, closeBraceIndex, 0);
}

function containsTopLevelObjectColon(source, pos, closeBraceIndex, braceDepth) {
  if (pos >= closeBraceIndex) {
    return false;
  }

  if (source[pos] === "{") {
    return containsTopLevelObjectColon(
      source,
      pos + 1,
      closeBraceIndex,
      braceDepth + 1,
    );
  }

  if (source[pos] === "}") {
    return containsTopLevelObjectColon(
      source,
      pos + 1,
      closeBraceIndex,
      braceDepth - 1,
    );
  }

  if (source[pos] === ":" && braceDepth === 0) {
    return true;
  }

  return containsTopLevelObjectColon(
    source,
    pos + 1,
    closeBraceIndex,
    braceDepth,
  );
}

function looksLikeBraceAssignment(source, startPos) {
  const closeBraceIndex = findMatchingBraceIndex(source, startPos);

  if (closeBraceIndex === -1) {
    return false;
  }

  const pos = skipWhitespace(source, closeBraceIndex + 1);

  return source[pos] === "=" && source[pos + 1] !== "=";
}

function isKeywordAt(source, startPos, keyword) {
  if (source.slice(startPos, startPos + keyword.length) !== keyword) {
    return false;
  }

  return !isIdentifierChar(source[startPos + keyword.length] ?? "");
}

function isIdentifierChar(char) {
  return (
    char !== "" &&
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$".includes(
      char,
    )
  );
}

function splitParameters(paramsSource) {
  const trimmedParams = paramsSource.trim();

  if (trimmedParams === "") {
    return [];
  }

  return paramsSource.split(",").map((param) => param.trim());
}

function findAssignmentOperator(statementText) {
  return findAssignmentOperatorFrom(statementText, 0);
}

function findAssignmentOperatorFrom(statementText, index) {
  if (index >= statementText.length) {
    return -1;
  }

  if (statementText[index] !== "=") {
    return findAssignmentOperatorFrom(statementText, index + 1);
  }

  const previousChar = statementText[index - 1] ?? "";
  const nextChar = statementText[index + 1] ?? "";

  if (
    previousChar === "<" ||
    previousChar === ">" ||
    previousChar === "!" ||
    previousChar === "=" ||
    nextChar === "="
  ) {
    return findAssignmentOperatorFrom(statementText, index + 1);
  }

  return index;
}
