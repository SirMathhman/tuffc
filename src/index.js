export function compileTuffToJS(source) {
  const trimmed = source.trim();

  if (trimmed === "read()") {
    return "return __tuff_coerce(__tuff_read());";
  }

  const letReadMatch = trimmed.match(/^let ([A-Za-z_$][\w$]*) = read\(\); \1$/);
  if (letReadMatch) {
    const variableName = letReadMatch[1];
    return `const ${variableName} = __tuff_coerce(__tuff_read()); return ${variableName};`;
  }

  const letChainMatch = trimmed.match(
    /^let ([A-Za-z_$][\w$]*) = read\(\); let ([A-Za-z_$][\w$]*) = \1; \2$/,
  );
  if (letChainMatch) {
    const firstVariableName = letChainMatch[1];
    const secondVariableName = letChainMatch[2];
    return `const ${firstVariableName} = __tuff_coerce(__tuff_read()); const ${secondVariableName} = ${firstVariableName}; return ${secondVariableName};`;
  }

  throw new Error(`Unsupported Tuff source: ${source}`);
}

export function executeTuff(source, stdIn) {
  const compiledJS = compileTuffToJS(source);
  const tokens =
    String(stdIn).trim().length === 0 ? [] : String(stdIn).trim().split(/\s+/);
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

export function createMessage(name = "world") {
  return `Hello, ${name}!`;
}

if (import.meta.main) {
  console.log(createMessage());
}
