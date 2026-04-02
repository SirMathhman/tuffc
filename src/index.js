const message = "Hello from Bun!";

function compileTuffToJS(source) {
  if (source === "") {
    return "return 0;";
  }

  if (/^\d+$/.test(source)) {
    return `return ${source};`;
  }

  return String(source);
}

function executeTuff(source) {
  const compiledJS = compileTuffToJS(source);
  return new Function(compiledJS)();
}

function main() {
  console.log(message);
}

if (import.meta.main) {
  main();
}

export { compileTuffToJS, executeTuff, main, message };
