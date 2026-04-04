export function compileTuffToJS(source) {
  const trimmed = source.trim();

  if (trimmed === "read()") {
    return "return Number(__tuff_read());";
  }

  throw new Error(`Unsupported Tuff source: ${source}`);
}

export function executeTuff(source, stdIn) {
  const compiledJS = compileTuffToJS(source);
  const tokens =
    String(stdIn).trim().length === 0 ? [] : String(stdIn).trim().split(/\s+/);
  let tokenIndex = 0;
  const func = new Function("__tuff_read", compiledJS);
  return func(() => tokens[tokenIndex++]);
}

export function createMessage(name = "world") {
  return `Hello, ${name}!`;
}

if (import.meta.main) {
  console.log(createMessage());
}
